import { useFetcher, useLoaderData } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { useState, useEffect } from "react";
import { get_customer_exist } from "./query";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

export const loader = async ({ request, params }) => {
  const { session, admin } = await authenticate.admin(request);
};

export default function EditAddressesForm() {
  const { company } = useLoaderData() ?? {};
  const fetcher = useFetcher();
  console.log("company data", company);
  
  const s = company?.shipping ?? {};
  const b = company?.billing ?? {};
  const companyIdvalue = company?.id ?? {};
  const customerEmail = company?.customerEmail ?? {};
  const customerPhone = company?.customerPhone ?? {};
  const aurthorizedStatus = company?.aurthorizedStatus ?? {};
  const billShippSameVal = company?.billingshippingsame ?? false;
  
  const [companyid, setCompanyId] = useState(companyIdvalue);
  const [billingSame, setBillingSame] = useState(Boolean(billShippSameVal));
  const [formData, setFormData] = useState({});
  const [countries, setCountries] = useState([]);
  const [shippingProvinces, setShippingProvinces] = useState([]);
  const [billingProvinces, setBillingProvinces] = useState([]);

  // Load countries data on component mount
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const response = await fetch('/countries.json');
        const data = await response.json();
        setCountries(data.countries || []);
        
        // Set initial provinces based on saved country values
        if (s.countryCode) {
          const country = data.countries.find(c => c.code === s.countryCode);
          setShippingProvinces(country?.provinces || []);
        }
        if (b.countryCode) {
          const country = data.countries.find(c => c.code === b.countryCode);
          setBillingProvinces(country?.provinces || []);
        }
      } catch (error) {
        console.error('Failed to load countries:', error);
      }
    };
    
    loadCountries();
  }, [s.countryCode, b.countryCode]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCountryChange = (type, countryCode) => {
    handleInputChange(`${type}_country`, countryCode);
    
    // Update provinces based on selected country
    const country = countries.find(c => c.code === countryCode);
    const provinces = country?.provinces || [];
    
    if (type === 'shipping') {
      setShippingProvinces(provinces);
      // Reset province when country changes
      handleInputChange('shipping_province', '');
    } else {
      setBillingProvinces(provinces);
      // Reset province when country changes
      handleInputChange('billing_province', '');
    }
    
    // Auto-update phone with country code
    if (country && country.phoneCode) {
      const phoneField = type === 'shipping' ? 'shipping_phone' : 'billing_phone';
      const currentPhone = formData[phoneField] || (type === 'shipping' ? s.phone : b.phone);
      
      if (currentPhone && !currentPhone.startsWith(country.phoneCode)) {
        // Remove existing country code and add new one
        const numberOnly = currentPhone.replace(/^\+\d+\s?/, '');
        handleInputChange(phoneField, `${country.phoneCode} ${numberOnly}`);
      } else if (!currentPhone) {
        handleInputChange(phoneField, country.phoneCode + ' ');
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const companyform = {
      savedvalues: company,
      billingshippingsame: billingSame,
      companyId: companyid,
      ...formData
    }

    fetcher.submit(
      {
        companyform: JSON.stringify(companyform)
      },
      {
        method: "post",
        action: "/appeditAddress"
      }
    );
  }

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Updated successfully");
      const modal = document.querySelector("s-modal#openeditpopup");
      if (modal) {
        modal.dispatchEvent(
          new CustomEvent("command", {
            bubbles: true,
            detail: { command: "--hide" },
          })
        );
      }
    } else if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data]);

  // Helper to get current value for a field
  const getFieldValue = (field, defaultValue = '') => {
    return formData[field] !== undefined ? formData[field] : defaultValue;
  };

  return (
    <>
      <s-button commandFor="openeditpopup" variant="secondary">
        Edit
      </s-button>

      <s-modal id="openeditpopup" title="Edit addresses">
        <s-modal-section>
          <s-stack gap="base">
            {/* Shipping section */}
            <s-card title="Shipping address">
              <s-stack gap="base">
                {!aurthorizedStatus ? (
                  <>
                    <s-heading>Customer</s-heading>
                    <s-text-field
                      name="customer_email"
                      label="Customer Email"
                      value={getFieldValue('customer_email', customerEmail)}
                      onChange={(e) => handleInputChange('customer_email', e.target.value)}
                    />
                    <s-text-field
                      name="customer_phone"
                      label="Customer phone"
                      value={getFieldValue('customer_phone', customerPhone)}
                      onChange={(e) => handleInputChange('customer_phone', e.target.value)}
                    />
                  </>
                ) : (
                  <s-text></s-text>
                )}

                <s-heading>Shipping Address</s-heading>

                <s-grid gridTemplateColumns="repeat(2, 1fr)" gap="base">
                  <s-text-field
                    name="shipping_firstName"
                    label="First name"
                    value={getFieldValue('shipping_firstName', s.firstName)}
                    onChange={(e) => handleInputChange('shipping_firstName', e.target.value)}
                  />
                  <s-text-field
                    name="shipping_lastName"
                    label="Last name"
                    value={getFieldValue('shipping_lastName', s.lastName)}
                    onChange={(e) => handleInputChange('shipping_lastName', e.target.value)}
                  />
                </s-grid>

                <s-text-field
                  name="shipping_phone"
                  label="Phone"
                  value={getFieldValue('shipping_phone', s.phone)}
                  onChange={(e) => handleInputChange('shipping_phone', e.target.value)}
                />

                <s-grid gridTemplateColumns="repeat(2, 1fr)" gap="base">
                  <s-text-field
                    name="shipping_address1"
                    label="Address line 1"
                    value={getFieldValue('shipping_address1', s.address1)}
                    onChange={(e) => handleInputChange('shipping_address1', e.target.value)}
                  />
                  <s-text-field
                    name="shipping_address2"
                    label="Address line 2"
                    value={getFieldValue('shipping_address2', s.address2)}
                    onChange={(e) => handleInputChange('shipping_address2', e.target.value)}
                  />
                </s-grid>

                {/* NEW: Country and Province Fields */}
                <s-grid gridTemplateColumns="repeat(2, 1fr)" gap="base">
                  <div>
                    <label htmlFor="shipping_country" style={{display: 'block', marginBottom: '8px', fontWeight: '500'}}>
                      Country *
                    </label>
                    <select
                      id="shipping_country"
                      name="shipping_country"
                      value={getFieldValue('shipping_country', s.countryCode)}
                      onChange={(e) => handleCountryChange('shipping', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #c4cdd5',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                      required
                    >
                      <option value="">Select Country</option>
                      {countries.map(country => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="shipping_province" style={{display: 'block', marginBottom: '8px', fontWeight: '500'}}>
                      Province/State *
                    </label>
                    {shippingProvinces.length > 0 ? (
                      <select
                        id="shipping_province"
                        name="shipping_province"
                        value={getFieldValue('shipping_province', s.province)}
                        onChange={(e) => handleInputChange('shipping_province', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #c4cdd5',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                        required
                      >
                        <option value="">Select Province/State</option>
                        {shippingProvinces.map(province => (
                          <option key={province.code} value={province.code}>
                            {province.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        id="shipping_province"
                        name="shipping_province"
                        value={getFieldValue('shipping_province', s.state)}
                        onChange={(e) => handleInputChange('shipping_province', e.target.value)}
                        placeholder="Province/State"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #c4cdd5',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                        required
                      />
                    )}
                  </div>
                </s-grid>

                <s-grid gridTemplateColumns="repeat(2, 1fr)" gap="base">
                  <s-text-field
                    name="shipping_city"
                    label="City"
                    value={getFieldValue('shipping_city', s.city)}
                    onChange={(e) => handleInputChange('shipping_city', e.target.value)}
                  />
                  <s-text-field
                    name="shipping_zip"
                    label="ZIP/Postal code"
                    value={getFieldValue('shipping_zip', s.zip)}
                    onChange={(e) => handleInputChange('shipping_zip', e.target.value)}
                  />
                </s-grid>
              </s-stack>
            </s-card>

            {/* Billing section */}
            <s-card title="Billing address">
              <s-stack gap="base">
                <s-checkbox
                  name="billing_sameAsShipping"
                  label="Same as shipping address"
                  checked={billingSame}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setBillingSame(val);
                    if (val) {
                      // Copy shipping to billing when checked
                      setFormData(prev => ({
                        ...prev,
                        billing_country: prev.shipping_country || s.countryCode,
                        billing_province: prev.shipping_province || s.state,
                        billing_city: prev.shipping_city || s.city,
                        billing_zip: prev.shipping_zip || s.zip,
                        billing_address1: prev.shipping_address1 || s.address1,
                        billing_address2: prev.shipping_address2 || s.address2,
                        billing_firstName: prev.shipping_firstName || s.firstName,
                        billing_lastName: prev.shipping_lastName || s.lastName,
                        billing_phone: prev.shipping_phone || s.phone
                      }));
                    }
                  }}
                />
                {!billingSame && (
                  <>
                    <s-grid gridTemplateColumns="repeat(2, 1fr)" gap="base">
                      <s-text-field
                        name="billing_firstName"
                        label="First name"
                        value={getFieldValue('billing_firstName', b.firstName)}
                        onChange={(e) => handleInputChange('billing_firstName', e.target.value)}
                      />
                      <s-text-field
                        name="billing_lastName"
                        label="Last name"
                        value={getFieldValue('billing_lastName', b.lastName)}
                        onChange={(e) => handleInputChange('billing_lastName', e.target.value)}
                      />
                    </s-grid>

                    <s-text-field
                      name="billing_phone"
                      label="Phone"
                      value={getFieldValue('billing_phone', b.phone)}
                      onChange={(e) => handleInputChange('billing_phone', e.target.value)}
                    />

                    <s-grid gridTemplateColumns="repeat(2, 1fr)" gap="base">
                      <s-text-field
                        name="billing_address1"
                        label="Address line 1"
                        value={getFieldValue('billing_address1', b.address1)}
                        onChange={(e) => handleInputChange('billing_address1', e.target.value)}
                      />
                      <s-text-field
                        name="billing_address2"
                        label="Address line 2"
                        value={getFieldValue('billing_address2', b.address2)}
                        onChange={(e) => handleInputChange('billing_address2', e.target.value)}
                      />
                    </s-grid>

                    {/* NEW: Country and Province Fields for Billing */}
                    <s-grid gridTemplateColumns="repeat(2, 1fr)" gap="base">
                      <div>
                        <label htmlFor="billing_country" style={{display: 'block', marginBottom: '8px', fontWeight: '500'}}>
                          Country *
                        </label>
                        <select id="billing_country" name="billing_country"
                          value={getFieldValue('billing_country', b.countryCode)}
                          onChange={(e) => handleCountryChange('billing', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #c4cdd5',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                          required
                        >
                          <option value="">Select Country</option>
                          {countries.map(country => (
                            <option key={country.code} value={country.code}>
                              {country.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="billing_province" style={{display: 'block', marginBottom: '8px', fontWeight: '500'}}>
                          Province/State *
                        </label>
                        {billingProvinces.length > 0 ? (
                          <select
                            id="billing_province"
                            name="billing_province"
                            value={getFieldValue('billing_province', b.province)}
                            onChange={(e) => handleInputChange('billing_province', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #c4cdd5',
                              borderRadius: '4px',
                              fontSize: '14px'
                            }}
                            required
                          >
                            <option value="">Select Province/State</option>
                            {billingProvinces.map(province => (
                              <option key={province.code} value={province.code}>
                                {province.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            id="billing_province"
                            name="billing_province"
                            value={getFieldValue('billing_province', b.state)}
                            onChange={(e) => handleInputChange('billing_province', e.target.value)}
                            placeholder="Province/State"
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #c4cdd5',
                              borderRadius: '4px',
                              fontSize: '14px'
                            }}
                            required
                          />
                        )}
                      </div>
                    </s-grid>

                    <s-grid gridTemplateColumns="repeat(2, 1fr)" gap="base">
                      <s-text-field
                        name="billing_city"
                        label="City"
                        value={getFieldValue('billing_city', b.city)}
                        onChange={(e) => handleInputChange('billing_city', e.target.value)}
                      />
                      <s-text-field
                        name="billing_zip"
                        label="ZIP/Postal code"
                        value={getFieldValue('billing_zip', b.zip)}
                        onChange={(e) => handleInputChange('billing_zip', e.target.value)}
                      />
                    </s-grid>
                  </>
                )}
              </s-stack>
            </s-card>

            <s-divider />
            <s-stack direction="inline" gap="base">
              <s-button variant="primary" onClick={handleSubmit}>
                Save
              </s-button>
            </s-stack>
          </s-stack>
        </s-modal-section>
      </s-modal>
    </>
  );
}

// Update the action function to handle new fields
export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  
  const form = await request.formData();
  const companyData = JSON.parse(form.get('companyform') || '{}');
  console.log("all Data", companyData);
  
  const customerPhone = companyData.customer_phone;
  const id = companyData.companyId || companyData.savedvalues.id;
  const company_table_mailid = companyData.savedvalues.companytabletada?.customerEmail;
  const customeremailid = companyData.customer_email || companyData.savedvalues.customerEmail;
  const storeshopid = companyData.savedvalues.shopId;

  const shipping = {
    firstName: companyData.shipping_firstName || companyData.savedvalues.shipping.firstName,
    lastName: companyData.shipping_lastName || companyData.savedvalues.shipping.lastName,
    phone: companyData.shipping_phone || companyData.savedvalues.shipping.phone,
    address1: companyData.shipping_address1 || companyData.savedvalues.shipping.address1,
    address2: companyData.shipping_address2 || companyData.savedvalues.shipping.address2,
    city: companyData.shipping_city || companyData.savedvalues.shipping.city,
    province: companyData.shipping_province || companyData.savedvalues.shipping.state,
    zip: companyData.shipping_zip || companyData.savedvalues.shipping.zip,
    countryCode: companyData.shipping_country || companyData.savedvalues.shipping.countryCode,
  };

  let billing = {};
  if (companyData.billingshippingsame) {
    billing = { ...shipping };
  } else {
    billing = {
      firstName: companyData.billing_firstName || companyData.savedvalues.billing.firstName,
      lastName: companyData.billing_lastName || companyData.savedvalues.billing.lastName,
      phone: companyData.billing_phone || companyData.savedvalues.billing.phone,
      address1: companyData.billing_address1 || companyData.savedvalues.billing.address1,
      address2: companyData.billing_address2 || companyData.savedvalues.billing.address2,
      city: companyData.billing_city || companyData.savedvalues.billing.city,
      province: companyData.billing_province || companyData.savedvalues.billing.state,
      zip: companyData.billing_zip || companyData.savedvalues.billing.zip,
      countryCode: companyData.billing_country || companyData.savedvalues.billing.countryCode,
    };
  }

  console.log("shipping billing", shipping);

  try {
    if (company_table_mailid !== customeremailid) {
      const existingSubmission = await prisma.company.findUnique({
        where: {
          unique_email_per_store: {
            customerEmail: customeremailid,
            shopId: storeshopid
          }
        }
      });

      const variables = { emailid: customeremailid };
      const finalexistornot = await admin.graphql(get_customer_exist, {variables});
      const getfinalresult = await finalexistornot.json();

      if (existingSubmission || getfinalresult.data.customerByIdentifier) {
        return { success: false, error: "Could not update customer — duplicate email" };
      }
    }

    const updateprismarespo = await prisma.company.update({
      where: { id },
      data: {
        shipping,
        billing,
        billingshippingsame: companyData.billingshippingsame,
        customerEmail: companyData.customer_email,
        customerPhone: customerPhone
      },
    });

    return { success: true };
  } catch (err) {
    console.error("Error updating company addresses:", err.message);
    return { success: false, error: String(err?.message ?? err) };
  }
}