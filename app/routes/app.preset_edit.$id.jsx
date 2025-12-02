import prisma from "../db.server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useLoaderData, useNavigate,useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import { paymentTerms } from "./query";
import {boundary} from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request, params }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const id = Number(params.id);
  if (!id || Number.isNaN(id)) {
    return new Response("Invalid preset id", { status: 400 });
  }
  // load preset from DB
  const preset = await prisma.preset.findFirst({
    where: { id, shopId: shop },
  });

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
        translatedName: "No payment terms",
      },
    ];
  }

  return Response.json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
    preset,
    paymentTermsTemplates,
  });
};


export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const id = Number(params.id);
  if (!id || Number.isNaN(id)) {
    return Response.json({ success: false, error: "Invalid preset id" }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const companyData = JSON.parse(formData.get("companyData") || "{}");
    //console.log(companyData);
    // Map form fields → Prisma model
    await prisma.preset.update({
      where: { id },
      data: {
        shopId: shop,
        presetTitle: companyData.presetTitle || "",
        paymentTerms: companyData.paymentTerms || null,
        checkoutOrderDraft: !!companyData.submitAutomatically,
        taxes: companyData.taxExempt ?? null,
        contactRole: companyData.contactRole || null,
        communication: companyData.customMessage || null,
        requireDeposit: companyData.requireDeposit ? String(companyData.depositPercent || "") : null,
        allowOneTimeShipAddress: !!companyData.allowOneTimeShipAddress,
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to update preset:", error);
    return Response.json(
      { success: false, error: "Failed to update preset" },
      { status: 500 }
    );
  }
};

export default function EditPresetPage() {
  const {
    preset,
    apiKey,
    paymentTermsTemplates = []
  } = useLoaderData();
  //console.log("saved values are",preset);
  const navigate = useNavigate();
  const fetcher = useFetcher();

  // Track loading state based on fetcher
  const isLoading = fetcher.state === 'submitting' || fetcher.state === 'loading';
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  console.log("default value is",preset.checkoutOrderDraft);
  const [formData, setFormData] = useState({
    isDefault: preset.isDefault,
    // Staff assignment
    presetTitle: preset.presetTitle || "",
    contactRole: preset.contactRole || "location-admin",

    paymentTermsGid: preset.paymentTerms?.gid || "",
    paymentTermsName: preset.paymentTerms?.name || "",

    // Catalogs
    selectedCatalogs: [],

    // Payment terms - uses template ID
    //paymentTerms: paymentTermsTemplates?.[0]?.id || "no-payment-terms",
    paymentTerms: "",
    // Deposit
    requireDeposit: !!preset.requireDeposit,
    depositPercent: preset.requireDeposit || "",

    // Checkout
    skipShippingAddress: false,
    submitAutomatically: preset.checkoutOrderDraft ?? true,
    allowOneTimeShipAddress: preset.allowOneTimeShipAddress ?? true,

    customMessage: preset.communication || "",
    sendEmail: false,
    taxExempt: preset.taxes ?? "true",
  });

  // Handle action response
  useEffect(() => {
    if (fetcher.data) {
      //console.log('Fetcher response:', fetcher.data);

      if (fetcher.data.success) {
        setNotification({
          show: true,
          message: "Preset updated successfully!",
          type: 'success'
        });
      } else {
        setNotification({ show: true, message: `Failed: ${fetcher.data.error}`, type: 'error' });
      }
    }
  }, [fetcher.data, navigate]);

  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [notification.show]);


  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };

      // when payment term changes, also set name + reset deposit if cleared
      if (field === "paymentTermsGid") {
        const selectedTerm = paymentTermsTemplates.find(
          (t) => t.id === value,
        );
        next.paymentTermsName = selectedTerm?.name || "";

        if (!value || value === "No payment terms") {
          next.requireDeposit = false;
          next.depositPercent = "";
        }
      }

      if (field === "requireDeposit" && !value) {
        next.depositPercent = "";
      }

      return next;
    });
  };

  const handlePaymentTermsChange = (gid) => handleInputChange("paymentTermsGid", gid);


  const handleSubmit = (e) => {
    e.preventDefault();
    setNotification({ show: false, message: '', type: '' });

    const companyData = {
      // Include form settings
      ...formData,
      paymentTerms: formData.paymentTermsGid
      ? {
          gid: formData.paymentTermsGid,
          name: formData.paymentTermsName,
        }
      : null,
    };

    if(!formData.presetTitle){
      setNotification({
        show: true,
        message: "please enter Preset Title",
        type: "error",
      });
      return;
    }
    
    if (companyData.requireDeposit && !companyData.depositPercent) {
      setNotification({
        show: true,
        message: "Please enter a deposit percentage.",
        type: "error",
      });
      return;
    }

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
    navigate(`/app/approval_presets`);
  };

  //const contact = company.companycontact ?? {};

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
              <s-heading>Update approval preset</s-heading>
            </s-stack>

            <s-stack direction="inline" gap="small-200">
              <s-button variant="secondary" onClick={() => navigate(`/app/approval_presets`)}>
                Cancel
              </s-button>
              <s-button
                variant="primary"
                onClick={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Update preset"}
              </s-button>
            </s-stack>
          </s-grid>

          <s-text tone="subdued">
            Configure settings for this approval preset. You can change these later.
          </s-text>

          {/* Main form grid */}
          <s-grid gridTemplateColumns="2fr 1fr" gap="base">
            {/* Left column - Main configuration */}
            <s-stack gap="base">
                {/* Preset title  */}
                {console.log("iddefault value is",formData.isDefault)}
                {!formData.isDefault && (
                    <s-box padding="base" border="base" borderRadius="base" background="base">
                        <s-stack direction="block" gap="base">
                        <s-heading accessibilityRole="heading">Preset title</s-heading>

                        <s-text-field 
                        required
                        value={formData.presetTitle} 
                        onInput={(e) => handleInputChange('presetTitle', e.target.value)}
                        placeholder="i.e. Commercial Fishery Exemptions" 
                        details="Give your preset a title that briefly describes its audience." />
                        </s-stack>
                    </s-box>
              )}

              {/* Payment Terms - Dynamic from GraphQL */}
              <s-box padding="base" border="base" borderRadius="base" background="base">
                <s-stack direction="block" gap="base">
                  <s-heading accessibilityRole="heading">Payment terms</s-heading>

                  {paymentTermsTemplates && paymentTermsTemplates.length > 0 ? (
                    <s-select
                      name="paymentTerms"
                      value={formData.paymentTermsGid}
                      onChange={(e) => handlePaymentTermsChange(e.target.value)}
                    >
                      <s-option value="">No payment terms</s-option>
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

                    {/* Require deposit toggle */}
                    {formData.paymentTermsGid && formData.paymentTermsGid !== "No payment terms" && (
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
                  <s-checkbox  checked={!!formData.allowOneTimeShipAddress}
                    onChange={(e) => handleInputChange('allowOneTimeShipAddress', e.target.checked)}
                    label="Allow customers to ship to any one-time address"/>

                  {/* <s-text>Order submission</s-text> */}
                  <s-choice-list
                    label="Order submission"
                    name="submitAutomatically"
                    //value={formData.submitAutomatically ? "auto" : "draft"}
                    values={[formData.submitAutomatically ? "auto" : "draft"]}  // ✅ use values
                    onChange={(e) => {
                       const selected = Array.isArray(e.currentTarget?.values)
                                        ? e.currentTarget.values[0]
                                        : e.currentTarget?.values;
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

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
