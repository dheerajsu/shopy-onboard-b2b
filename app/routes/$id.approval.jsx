import prisma from "../db.server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useLoaderData, useNavigate, useParams, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import { paymentTerms, companyCreate, assignContactMutation, assignMainMutation, companyContactRole, companyContactAssignRole, shopid } from "./query";
import {boundary} from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request, params }) => {
  const { session, admin } = await authenticate.admin(request);

  const id = Number(params.id);
  if (Number.isNaN(id)) {
    return new Response("Invalid id", { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id },
    include: { companycontact: true },
  });

  if (!company) {
    return new Response("Not found", { status: 404 });
  }

  // Fetch payment terms templates from Shopify
  let paymentTermsTemplates = [];
  try {
    const response = await admin.graphql(paymentTerms);
    const data = await response.json();

    if (data.data?.paymentTermsTemplates) {
      paymentTermsTemplates = data.data.paymentTermsTemplates;
    }
  } catch (error) {
    console.error("Failed to fetch payment terms templates:", error);
    paymentTermsTemplates = [
      {
        id: "no-payment-terms",
        name: "No payment terms",
        description: "No payment terms",
        paymentTermsType: "FIXED",
        translatedName: "No payment terms"
      }
    ];
  }

  // --- NEW: fetch presets for this shop ---
  const presetsRaw = await prisma.preset.findMany({
    where: { shopId: session.shop },
    orderBy: [
      { isDefault: "desc" },
      { id: "asc" }
    ],
  });

  const presets = presetsRaw.map((p) => ({
    ...p,
    createdAt: p.createdAt?.toISOString?.() ?? null,
    updatedAt: p.updatedAt?.toISOString?.() ?? null,
  }));
  // Get current user information only
  let currentUser = {
    id: "current-user",
    email: session.shop,
    firstName: "Store",
    lastName: "Admin",
    fullName: "Store Admin",
    accountOwner: true,
    active: true
  };

  const serialized = {
    ...company,
    createdAt: company.createdAt?.toISOString() ?? null,
    updatedAt: company.updatedAt?.toISOString() ?? null,
    companycontact: company.companycontact ?? null,
  };

  return Response.json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
    company: serialized,
    currentUser,
    paymentTermsTemplates,
    presets,
  });
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    // Parse the form data from the request
    const formData = await request.formData();
    const companyData = JSON.parse(formData.get('companyData') || '{}');

    // Parse billing and shipping data from the company
    let billingData = {};
    let shippingData = {};
    
    try {
      billingData = companyData.billing;
      shippingData = companyData.shipping;
    } catch (parseError) {
      console.error('Error parsing billing/shipping data:', parseError);
    }

    const billingShippingSame = !!companyData.billingshippingsame;
    // If billing & shipping are same, use billing for both
    const finalBillingData = billingShippingSame ? shippingData : billingData;
    const finalShippingData = shippingData; // always billing from billingData

    // Use shipping address if available, otherwise use billing address
    //const addressData = shippingData || billingData || {};

    const buildAddressInput = (addr = {}) => ({
      firstName: addr.firstName || "",
      lastName: addr.lastName || "",
      address1: addr.address1 || "",
      city: addr.city || "City",
      zip: addr.zip || "",
      phone: addr.phone || "",
      countryCode: addr.countryCode || "IN", // adjust if needed
      zoneCode: addr.province || ""
    });

    const variables = {
      input: {
        company: {
          name: companyData.companyName,
          note: companyData.customMessage,
          externalId: companyData.externalId || `${Date.now()}`
        },
        companyLocation: {
          name: companyData.locationName || "Main Location",
          buyerExperienceConfiguration: {
            editableShippingAddress: companyData.allowOneTimeShipAddress,
            paymentTermsTemplateId: companyData.paymentTerms,
            checkoutToDraft: !companyData.submitAutomatically, //need to update
            deposit: companyData.requireDeposit
                      ? { percentage: parseFloat(companyData.depositPercent)} 
                      : null, 
          },
          taxExempt: companyData.taxExempt === 'true', //need to update
          shippingAddress: buildAddressInput(finalShippingData),
          ...(billingShippingSame
          ? {
              billingSameAsShipping: true
              // Shopify uses shippingAddress as billing in this case
            }
          : {
              billingSameAsShipping: false,
              billingAddress: buildAddressInput(finalBillingData)
            })

        }
      }
    };

    console.log("variable value is",variables.input.companyLocation.buyerExperienceConfiguration);
    console.log("variable tax exempt",variables.input.companyLocation.taxExempt);
    //return "wait for min";
    // Execute the GraphQL mutation
    const response = await admin.graphql(companyCreate, { variables });
    const result = await response.json();
    if (result.data?.companyCreate?.company) {
      const shopifyCompany = result.data.companyCreate.company;
      const companyGid = shopifyCompany.id;
      let companyContactId = null;

      const customerId = companyData.customerId;
      try {
        const assignContactVars = {
          companyId: companyGid,
          customerId: customerId
        };
        //console.log("assignb contact variables",assignContactVars);
        const assignContactResponse = await admin.graphql(assignContactMutation, { variables: assignContactVars });
        const assignContactResult = await assignContactResponse.json();
        // console.log('Assign contact result:', assignContactResult);
        if (assignContactResult.data?.companyAssignCustomerAsContact?.companyContact) {
          companyContactId = assignContactResult.data.companyAssignCustomerAsContact.companyContact.id;
          //console.log('Company contact created with ID:', companyContactId);
        } else if (assignContactResult.data?.companyAssignCustomerAsContact?.userErrors?.length > 0) {
          console.error('Assign contact errors:', assignContactResult.data.companyAssignCustomerAsContact.userErrors);
          throw new Error('Failed to assign customer as contact');
        }
      } catch (contactError) {
        console.error('Error assigning customer as contact:', contactError);
      }

      // STEP 2: Assign as main contact (if contact was created successfully)
      let locationId = null;
      if (companyContactId) {
        try {
          const assignMainVars = {
            companyId: companyGid,
            companyContactId: companyContactId
          };
          const assignMainResponse = await admin.graphql(assignMainMutation, { variables: assignMainVars });
          const assignMainResult = await assignMainResponse.json();
          //console.log('Assign main contact result:', assignMainResult);
          if (assignMainResult.data?.companyAssignMainContact?.userErrors?.length > 0) {
            console.error('Assign main contact errors:', assignMainResult.data.companyAssignMainContact.userErrors);
          }

          //get company roles
          const companyroles = await admin.graphql(companyContactRole, {
            variables: {
              companyId: companyGid,
            }
          });
          const companyrolesresult = await companyroles.json();
          const roles = companyrolesresult?.data?.node?.contactRoles?.edges?.map(e => e.node) ?? [];
          const requestedPermissions = companyData.contactRole;
          let chosenRoleId = null;
          if (requestedPermissions && roles.length) {
            const normalize = str => String(str).toLowerCase().replace(/[^a-z0-9]/g, "");
            const p = normalize(requestedPermissions);
            const found = roles.find(r => normalize(r.name).includes(p));
            if (found) chosenRoleId = found.id;
          }


          locationId = shopifyCompany.locations.edges[0].node.id;
          //console.log("company data location id is",locationId);
          await admin.graphql(companyContactAssignRole, {
            variables: {
              companyContactId: companyContactId,
              companyContactRoleId: chosenRoleId,
              companyLocationId: locationId,
            }
          });
        } catch (mainContactError) {
          console.error('Error assigning main contact:', mainContactError);
        }
      }

      // Update the company in your database with approved status and Shopify company GID
      await prisma.company.update({
        where: { id: companyData.companyId },
        data: {
          companyStatus: "approved",
          companyGid: shopifyCompany.id, // Store the Shopify company GID
          updatedAt: new Date()
        }
      });

      // -------------update and and create entry in tables --------------
      //console.log("location id is now ", locationId);
      let companycollection = await prisma.company.findUnique({
        where: { companyGid: companyGid }
      });

      const shopidrespo = await admin.graphql(shopid);
      const shopdata = await shopidrespo.json();
      const shopidis = shopdata.data.shop.myshopifyDomain;
      //console.log("shop id is",shopidis);

      const createdLocation = await prisma.location.create({
        data: {
          companyId: companycollection.id,
          locationGid: locationId,
          name: companycollection.name,
          billing: companycollection.billing, // Pass the billing object as string
          shipping: companycollection.shipping,
          shopId: shopidis,
        },
      });
      //Add main customer in CompanyMember table
      await prisma.companyMember.create({
        data: {
          locationId: createdLocation.id,
          memberContactId: companyContactId,
          firstName: undefined,
          lastName: undefined,
          title: "",
          email: "",
          companyContactRoleId: "",
          shopId: shopidis,
        },
      });


      return {
        success: true,
        company: shopifyCompany,
        contactAssigned: !!companyContactId,
        message: "Company created successfully in Shopify and status updated to approved!"
      };
    } else if (result.data?.companyCreate?.userErrors?.length > 0) {
      const errors = result.data.companyCreate.userErrors;
      const errorMessage = errors.map(error => `${error.field}: ${error.message}`).join(', ');
      return {
        success: false,
        error: errorMessage
      };
    } else {
      return {
        success: false,
        error: "Unknown error occurred"
      };
    }

  } catch (error) {
    console.error('Error in action:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default function CompanyApprovalRoute() {
  const {
    apiKey,
    company,
    currentUser,
    paymentTermsTemplates = [],
    presets = [],   
  } = useLoaderData();

  const defaultPreset = presets.find((p) => p.isDefault) || null;

  const navigate = useNavigate();
  const fetcher = useFetcher();

  // Track loading state based on fetcher
  const isLoading = fetcher.state === 'submitting' || fetcher.state === 'loading';
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

    const [formData, setFormData] = useState(() => {
    // base defaults
    const base = {
      contactRole: "location-admin",
      selectedCatalogs: [],
      paymentTerms: "",
      requireDeposit: false,
      depositPercent: "",
      allowOneTimeShipAddress: true,
      submitAsDrafts: false,
      taxExempt: "true",
      customMessage: "",
      sendEmail: false,
    };

    if (!defaultPreset) return base;

    // apply default preset on first load
    return {
      ...base,
      contactRole: defaultPreset.contactRole || base.contactRole,
      paymentTerms: defaultPreset.paymentTerms?.gid || base.paymentTerms,
      requireDeposit: !!defaultPreset.requireDeposit,
      depositPercent: defaultPreset.requireDeposit || "",
      allowOneTimeShipAddress:
        defaultPreset.allowOneTimeShipAddress ?? base.allowOneTimeShipAddress,
      submitAsDrafts: !defaultPreset.checkoutOrderDraft
        ? base.submitAsDrafts
        : base.submitAsDrafts, // adjust to your meaning if needed
      taxExempt: defaultPreset.taxes ?? base.taxExempt,
      customMessage: defaultPreset.communication || base.customMessage,
    };
  });

  const [selectedPresetId, setSelectedPresetId] = useState(
    defaultPreset ? defaultPreset.id : ""
  );

  

  const applyPresetToForm = (preset) => {
    if (!preset) return;
    setFormData((prev) => ({
      ...prev,

      // Payment terms JSON: { gid, name }
      paymentTerms: preset.paymentTerms?.gid || "",

      requireDeposit: !!preset.requireDeposit,
      depositPercent: preset.requireDeposit || "",

      allowOneTimeShipAddress: preset.allowOneTimeShipAddress ?? prev.allowOneTimeShipAddress,
                                      
      // Assuming checkoutorderDraft in Preset stores your "auto submit" flag
      submitAutomatically: preset.checkoutOrderDraft ?? prev.submitAutomatically,

      taxExempt: preset.taxes ?? prev.taxExempt,

      contactRole: preset.contactRole || prev.contactRole,

      customMessage: preset.communication || prev.customMessage,
    }));
  };


  // Staff search state
  const [staffSearchTerm, setStaffSearchTerm] = useState("");
  
  useEffect(() => {
    if (defaultPreset) {
      applyPresetToForm(defaultPreset);
    }
  }, []); // run once

  // Handle action response
  useEffect(() => {
    if (fetcher.data) {
      //console.log('Fetcher response:', fetcher.data);

      if (fetcher.data.success) {
        setNotification({
          show: true,
          message: "Company approved successfully!",
          type: 'success'
        });
        setTimeout(() => {
          //navigate(`/company/${company.id}`);
          navigate(`/app/companies`);
        }, 1500);

      } else {
        setNotification({ show: true, message: `Failed: ${fetcher.data.error}`, type: 'error' });
      }
    }
  }, [fetcher.data, navigate, company.id]);

  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [notification.show]);


  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setNotification({ show: false, message: '', type: '' });

    console.log("current form data",formData);
  
    const companyData = {
      companyId: company.id, // Pass the company ID for updating
      companyName: company.name || "",
      externalId: company.externalId,
      billing: company.billing, // Pass the billing object as string
      shipping: company.shipping, // Pass the shipping object as string
      contactInfoFirstName: company.contactInfoFirstName,
      contactInfoLastName: company.contactInfoLastName,
      locationName: `${company.name} Location` || "Main Location",
      customerId: company.companycontact?.baseCustomerId,
      billingshippingsame:  company?.billingshippingsame,

      // Include form settings
      ...formData
    };

    //console.log('Submitting company data:', companyData);

    // Submit using fetcher
    fetcher.submit(
      {
        companyData: JSON.stringify(companyData)
      },
      {
        method: "post"
      }
    );
  };

  // Helper function for payment term details
  const renderPaymentTermDetails = (term) => {
    const details = [];

    if (term.description) {
      details.push(term.description);
    }

    if (term.paymentTermsType) {
      const typeLabel = term.paymentTermsType.toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
      details.push(` (${typeLabel})`);
    }

    return details.map((detail, index) => (
      <s-text key={index} tone="subdued" size="small">
        {detail}
      </s-text>
    ));
  };

  const backpage = () => {
    navigate(`/company/${company.id}`);
  };

  const contact = company.companycontact ?? {};

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-page>
        <s-stack direction="block" gap="base">
          {/* Notification Banner */}
          {notification.show && (
            <s-banner
              tone={notification.type === 'success' ? 'success' : 'critical'}
              onDismiss={() => setNotification({ show: false, message: '', type: '' })}
            >
              <s-text>{notification.message}</s-text>
            </s-banner>
          )}

          {/* Header */}
          <s-grid gridTemplateColumns="1fr auto" alignItems="center">
            <s-stack direction="inline" alignItems="center" gap="small-200">
              <s-button icon="arrowLeft" variant="primary" onClick={backpage}>
                <s-icon type="arrow-left" />
              </s-button>
              <s-heading>Configure company</s-heading>
            </s-stack>

            <s-stack direction="inline" gap="small-200">
              
              <s-stack direction="inline" gap="small-100" alignItems="center">
                <s-select
                  title="Approval preset"
                  name="approvalPreset"
                  value={String(formData.selectedPresetId || "")}
                  onChange={(e) => {
                    const id = Number(e.target.value) || null;
                    setSelectedPresetId(id);
                    const preset = presets.find((p) => p.id === id);
                    setFormData((prev) => ({ ...prev, selectedPresetId: id }));
                    applyPresetToForm(preset);
                  }}
                >
                  {presets.map((p) => (
                    <s-option key={p.id} value={String(p.id)}>
                      {p.presetTitle || `Preset #${p.id}`}
                    </s-option>
                  ))}
                </s-select>
              </s-stack>


              <s-button variant="secondary" onClick={() => navigate(`/company/${company.id}`)}>
                Cancel
              </s-button>
              <s-button
                variant="primary"
                onClick={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? "Creating Company..." : "Approve"}
              </s-button>
            </s-stack>
          </s-grid>

          <s-text tone="subdued">
            Configure company settings before approving. You will be able to change these later.
          </s-text>

          {/* Main form grid */}
          <s-grid gridTemplateColumns="2fr 1fr" gap="base">
            {/* Left column - Main configuration */}
            <s-stack gap="base">
              {/* Payment Terms - Dynamic from GraphQL */}
              <s-box padding="base" border="base" borderRadius="base" background="base">
                <s-stack direction="block" gap="base">
                  <s-heading accessibilityRole="heading">Payment terms</s-heading>

                  {paymentTermsTemplates && paymentTermsTemplates.length > 0 ? (
                    <s-select
                      name="paymentTerms"
                      value={formData.paymentTerms}
                      onChange={(e) => handleInputChange('paymentTerms', e.target.value)}
                    >
                      <s-option value="">No payment terms</s-option>
                      {/* Dynamic payment terms from API */}
                      {paymentTermsTemplates.map((term) => (
                        <s-option key={term.id} value={term.id}>
                          <s-stack direction="block" gap="small-100">

                            {renderPaymentTermDetails(term)}
                          </s-stack>
                        </s-option>
                      ))}
                    </s-select>
                  ) : (
                    <s-choice-list
                      name="paymentTerms"
                      value={formData.paymentTerms}
                      onChange={(e) => handleInputChange('paymentTerms', e.target.value)}
                    >
                      <s-choice value="no-payment-terms">
                        <s-stack direction="block" gap="small-100">
                          <s-text weight="bold">No payment terms</s-text>
                          <s-text tone="subdued" size="small">No payment terms configured in your store</s-text>
                        </s-stack>
                      </s-choice>
                    </s-choice-list>
                  )}

                  {formData.paymentTerms && formData.paymentTerms !== "No payment terms" && (
                    <s-checkbox
                      checked={formData.requireDeposit}
                      onChange={(e) => handleInputChange("requireDeposit", e.target.checked)}
                      label="Require deposit on orders created at checkout"
                    />
                    )}

                    {/* Deposit percent field, visible only when checkbox is checked */}
                    {formData.requireDeposit && (
                      <s-text-field
                        type="number"
                        min="0"
                        max="100"
                        placeholder="%"
                        value={formData.depositPercent}
                        onInput={(e) => handleInputChange("depositPercent", e.target.value)}
                      />
                    )}
                </s-stack>
              </s-box>

              {/* Checkout */}
              {/* <s-box padding="base" border="base" borderRadius="base" background="base">
                <s-stack direction="block" gap="base">
                  <s-heading accessibilityRole="heading">Checkout</s-heading>

                  <s-heading accessibilityRole="heading" size="small">Order submission</s-heading>
                  <s-text tone="subdued" size="small">
                    Orders without a shipping addresses will be submitted as draft orders
                  </s-text>

                  <s-checkbox
                    checked={formData.submitAsDrafts}
                    onChange={(e) => handleInputChange('submitAsDrafts', e.target.checked)}
                    label="Submit all orders as drafts for review"
                  />
                </s-stack>
              </s-box> */}
              {/* Checkout */}
              <s-box padding="base" border="base" borderRadius="base" background="base">
                <s-stack direction="block" gap="base">
                  <s-heading accessibilityRole="heading">Checkout</s-heading>

                  <s-text>Ship to address</s-text>
                  <s-checkbox  checked={formData.allowOneTimeShipAddress}
                    onChange={(e) => handleInputChange('allowOneTimeShipAddress', e.target.checked)}
                    label="Allow customers to ship to any one-time address"/>

                  {/* <s-text>Order submission</s-text> */}
                  <s-choice-list
                    label="Order submission"
                    name="submitAutomatically"
                    values={[formData.submitAutomatically ? "auto" : "draft"]}
                    //value={formData.submitAutomatically}
                    onChange={(e) => {
                      const values = e.currentTarget.values || [];
                      const selected = Array.isArray(values) ? values[0] : values;
                      handleInputChange("submitAutomatically", selected === "auto");
                    }}
                  >
                    <s-choice value="auto">
                      Automatically submit orders
                      <s-text slot="details">
                        Orders without shipping addresses will be submitted as draft orders
                      </s-text>
                    </s-choice>
                    
                    <s-choice value="draft">
                      Submit all orders as drafts for review
                    </s-choice>
                  </s-choice-list>

                </s-stack>
              </s-box>


              {/* Taxes */}
              <s-box padding="base" border="base" borderRadius="base" background="base">
                <s-stack direction="block" gap="base">
                  <s-heading accessibilityRole="heading">Taxes</s-heading>

                  <s-select label="Date range" name="taxExempt"
                    value={formData.taxExempt}
                    onChange={(e) => handleInputChange('taxExempt', e.target.value)}>
                    <s-option value="false">Collect Tax</s-option>
                    <s-option value="true">Don't collect Tax</s-option>
                  </s-select>
                </s-stack>
              </s-box>

              <s-box padding="base" border="base" borderRadius="base" background="base">
                <s-stack direction="block" gap="base">
                  <s-heading accessibilityRole="heading">Contact role</s-heading>
                  <s-choice-list
                    name="contactRole"
                    details=""
                    values={[formData.contactRole]}
                    onChange={(e) => {
                      const selected = Array.isArray(e.currentTarget?.values)
                        ? e.currentTarget.values[0]
                        : e.currentTarget?.values;
                      handleInputChange("contactRole", selected);
                    }}
                  //handleInputChange('contactRole', e.target.value)
                  >
                    <s-choice value="location-admin" selected>
                      Location Admin
                      <s-text slot="details">
                        Contact will be able to manage this location and place orders. They can add company contacts to their location through the app's "Manage contacts" page.
                      </s-text>
                    </s-choice>
                    <s-choice value="ordering-only">
                      Ordering only
                      <s-text tone="subdued" size="small" slot="details">
                        Contact will only be able to place orders.
                      </s-text>
                    </s-choice>
                  </s-choice-list>
                </s-stack>
              </s-box>

              {/* Communication */}
              <s-box padding="base" border="base" borderRadius="base" background="base">
                <s-stack direction="block" gap="base">
                  <s-heading accessibilityRole="heading">Communication</s-heading>

                  <s-text tone="subdued">
                    This message will be displayed in the status banner on the application form page. It will also be included in the email if you choose to send one.
                  </s-text>

                  <s-text-area
                    label="Custom message (optional)"
                    placeholder='e.g., "Thanks for doing business with us!"'
                    value={formData.customMessage}
                    onInput={(e) => handleInputChange('customMessage', e.target.value)}
                    rows={4}
                  />
                  <s-stack direction="inline" gap="base">
                    <s-checkbox
                      checked={formData.sendEmail}
                      onChange={(e) => handleInputChange('sendEmail', e.target.checked)}
                    />
                    <s-text> Send email notification</s-text>
                  </s-stack>
                </s-stack>
              </s-box>
            </s-stack>
          </s-grid>
        </s-stack>
      </s-page>
    </AppProvider>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
