import prisma from "../db.server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useLoaderData, useNavigate, useParams, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import { paymentTerms, companyCreate, assignContactMutation, assignMainMutation, companyContactRole, companyContactAssignRole, shopid } from "./query";

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
  });
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    // Parse the form data from the request
    const formData = await request.formData();
    const companyData = JSON.parse(formData.get('companyData') || '{}');

    //console.log('Company data received:', companyData);

    // Parse billing and shipping data from the company
    let billingData = {};
    let shippingData = {};

    try {
      billingData = companyData.billing;
      shippingData = companyData.shipping;
    } catch (parseError) {
      console.error('Error parsing billing/shipping data:', parseError);
    }

    // Use shipping address if available, otherwise use billing address
    const addressData = shippingData || billingData || {};

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
            checkoutToDraft: companyData.submitAsDrafts,
            paymentTermsTemplateId: companyData.paymentTerms
          },
          taxExempt: true,
          shippingAddress: {
            firstName: addressData.firstName,
            lastName: addressData.lastName,
            address1: addressData.address1,
            city: "City",
            zip: addressData.zip,
            phone: addressData.phone,
            countryCode: addressData.countryCode
          },
          billingSameAsShipping: true

        }
      }
    };

    // console.log("how to get customer id",companyData);
    // return "testing";
    // Execute the GraphQL mutation
    const response = await admin.graphql(companyCreate, { variables });
    const result = await response.json();
    //console.log("reuslt of company create--",result);
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
    paymentTermsTemplates = []
  } = useLoaderData();

  const navigate = useNavigate();
  const fetcher = useFetcher();

  // Track loading state based on fetcher
  const isLoading = fetcher.state === 'submitting' || fetcher.state === 'loading';
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  const [formData, setFormData] = useState({
    // Staff assignment
    //assignedStaff: [],
    contactRole: "location-admin",

    // Catalogs
    selectedCatalogs: [],

    // Payment terms - uses template ID
    paymentTerms: paymentTermsTemplates?.[0]?.id || "no-payment-terms",

    // Checkout
    skipShippingAddress: false,
    submitAsDrafts: false,

    customMessage: "",
    sendEmail: false
  });

  // Staff search state
  const [staffSearchTerm, setStaffSearchTerm] = useState("");

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
              {/* <s-button icon="arrowLeft" variant="primary" onClick={() => navigate(-1)}> */}
              <s-button icon="arrowLeft" variant="primary" onClick={backpage}>
                <s-icon type="arrow-left" />
              </s-button>
              <s-heading>Configure company</s-heading>
            </s-stack>

            <s-stack direction="inline" gap="small-200">
              <s-button variant="secondary" onClick={() => navigate(`/companies/${company.id}`)}>
                Cancel
              </s-button>
              <s-button
                variant="primary"
                onClick={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? "Creating Company..." : "Save and Continue"}
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
              {/* Assigned Staff */}
              {/* <s-box padding="base" border="base" borderRadius="base" background="base">
              <s-stack direction="block" gap="base">
                <s-heading accessibilityRole="heading">Assigned staff</s-heading>
                <s-text>Choose up to 10 sales staff for this location</s-text>
                
                <s-text-field
                  label="Search staff"
                  placeholder="Search staff members..."
                  labelAccessibilityVisibility="exclusive"
                  value={staffSearchTerm}
                  onInput={(e) => setStaffSearchTerm(e.target.value)}
                />
                
                <s-checkbox
                  checked={formData.assignedStaff.length > 0}
                  onChange={(e) => handleInputChange('assignedStaff', e.target.checked ? ['default-staff'] : [])}
                >
                  Learn more about assigning sales staff
                </s-checkbox>
              </s-stack>
            </s-box> */}

              {/* Catalogs */}
              {/* <s-box padding="base" border="base" borderRadius="base" background="base">
              <s-stack direction="block" gap="base">
                <s-heading accessibilityRole="heading">Catalogs</s-heading>
                
                <s-text tone="subdued">
                  Your store does not have any Company Location (B2B) catalogs. To assign specific catalogs to this company, you will need to create some in Shopify.
                </s-text>
                
                <s-button variant="secondary">Manage catalogs</s-button>
                
                <s-text-field
                  label="Search catalogs"
                  placeholder="Search catalogs..."
                  labelAccessibilityVisibility="exclusive"
                  disabled
                />
                
                <s-text tone="subdued" size="small">
                  You can assign up to 250 Company Location (B2B) catalogs.
                </s-text>
              </s-stack>
            </s-box> */}

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
                </s-stack>
              </s-box>

              {/* Checkout */}
              <s-box padding="base" border="base" borderRadius="base" background="base">
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
              </s-box>

              {/* Taxes */}
              <s-box padding="base" border="base" borderRadius="base" background="base">
                <s-stack direction="block" gap="base">
                  <s-heading accessibilityRole="heading">Taxes</s-heading>

                  <s-select label="Date range" name="taxExempt"
                    value={formData.taxExempt}
                    onChange={(e) => handleInputChange('taxExempt', e.target.value)}>
                    <s-option value="true">Collect Tax</s-option>
                    <s-option value="false">Don't collect Tax</s-option>
                  </s-select>
                </s-stack>
              </s-box>

              <s-box padding="base" border="base" borderRadius="base" background="base">
                <s-stack direction="block" gap="base">
                  <s-heading accessibilityRole="heading">Contact role</s-heading>
                  <s-choice-list
                    name="contactRole"
                    details=""
                    value={formData.contactRole}
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