import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useEffect, useState } from "preact/hooks";
import { parsePhoneNumberFromString } from "libphonenumber-js";
//import { loadCountries, getPhoneHint } from "./countries"; // same folder
//import { BASE_URL } from "../../manage-team/src/config.js";
import { loadCountries, loadStates, getPhoneHint } from "./countriesstate";

export default async () => {
  render(<SimpleB2BForm />, document.body);
};

function formatPhoneE164(rawPhone, countryIso) {
  try {
    const phone = rawPhone && rawPhone.trim().startsWith("+")
      ? parsePhoneNumberFromString(rawPhone.trim())
      : parsePhoneNumberFromString(rawPhone || "", countryIso);
    if (!phone || !phone.isValid()) return null;
    return phone.format("E.164");
  } catch (e) {
    return null;
  }
}

function SimpleB2BForm() {

  // shipping country & state
  const [shipStates, setShipStates] = useState([]); // states for selected shipping country
  const [loadingShipStates, setLoadingShipStates] = useState(false);
  const [shipStateCode, setShipStateCode] = useState(""); // selected state code
  const [shipStateFreeText, setShipStateFreeText] = useState(""); // used when no states available

  // billing country & state (if needed)
  const [billStates, setBillStates] = useState([]);
  const [loadingBillStates, setLoadingBillStates] = useState(false);
  const [billStateCode, setBillStateCode] = useState("");
  const [billStateFreeText, setBillStateFreeText] = useState("");

  // NEW: company check state
  const [existingCompany, setExistingCompany] = useState(undefined);
  const [existingCompanyValues, setExistingCompanynameValues] = useState(undefined);
  const [checkingCompany, setCheckingCompany] = useState(true);

  // form state
  const [companyName, setCompanyName] = useState("");
  const [externalId, setExternalId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");

  const [shipFirst, setShipFirst] = useState("");
  const [shipLast, setShipLast] = useState("");
  const [shipAddress1, setShipAddress1] = useState("");
  const [shipAddress2, setShipAddress2] = useState("");
  const [shipCity, setShipCity] = useState("");
  const [shipZip, setShipZip] = useState("");
  const [shipCountryIso, setShipCountryIso] = useState("");
  const [phoneRaw, setPhoneRaw] = useState("");

  const [billingSame, setBillingSame] = useState(true);
  const [billFirst, setBillFirst] = useState("");
  const [billLast, setBillLast] = useState("");
  const [billAddress1, setBillAddress1] = useState("");
  const [billAddress2, setBillAddress2] = useState("");
  const [billCity, setBillCity] = useState("");
  const [billZip, setBillZip] = useState("");
  const [billCountryIso, setBillCountryIso] = useState("");
  const [billPhoneRaw, setBillPhoneRaw] = useState("");

  // UI
  const [countries, setCountries] = useState([]);
  const [phoneHint, setPhoneHint] = useState("");
  const [billphoneHint, setBillPhoneHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // NEW: Field-level validation errors
  const [fieldErrors, setFieldErrors] = useState({
    companyName: "",
    externalId:"",
    firstName: "",
    lastName: "",
    shipAddress1: "",
    phoneRaw: "",
    billAddress1: "",
    billPhoneRaw: ""
  });

  // Validation functions
  const validateField = (fieldName, value) => {
    const newErrors = { ...fieldErrors };
    
    switch (fieldName) {
      case 'companyName':
        newErrors.companyName = value.trim() ? "" : "Company name is required";
        break;
      case 'externalId':
        newErrors.externalId = value.trim() ? "" : "External Id is required";
        break;
      case 'firstName':
        newErrors.firstName = value.trim() ? "" : "First name is required";
        break;
      case 'lastName':
        newErrors.lastName = value.trim() ? "" : "Last name is required";
        break;
      case 'shipAddress1':
        newErrors.shipAddress1 = value.trim() ? "" : "Shipping address is required";
        break;
      case 'phoneRaw':
        if (value.trim()) {
          const shipE164 = formatPhoneE164(value, shipCountryIso || undefined);
          newErrors.phoneRaw = shipE164 ? "" : "Please enter a valid phone number";
        } else {
          newErrors.phoneRaw = "";
        }
        break;
      case 'billAddress1':
        if (!billingSame) {
          newErrors.billAddress1 = value.trim() ? "" : "Billing address is required";
        }
        break;
      case 'billPhoneRaw':
        if (!billingSame && value.trim()) {
          const billE164 = formatPhoneE164(value, billCountryIso || undefined);
          newErrors.billPhoneRaw = billE164 ? "" : "Please enter a valid phone number";
        } else {
          newErrors.billPhoneRaw = "";
        }
        break;
      default:
        break;
    }
    
    setFieldErrors(newErrors);
    return newErrors[fieldName] === "";
  };

  const validateForm = () => {
    const newErrors = { ...fieldErrors };
    let isValid = true;

    // Required fields validation
    if (!companyName.trim()) {
      newErrors.companyName = "Company name is required";
      isValid = false;
    } else {
      newErrors.companyName = "";
    }

    if (!externalId.trim()) {
      newErrors.externalId = "external Id is required";
      isValid = false;
    } else {
      newErrors.externalId = "";
    }

    if (!firstName.trim()) {
      newErrors.firstName = "First name is required";
      isValid = false;
    } else {
      newErrors.firstName = "";
    }

    if (!lastName.trim()) {
      newErrors.lastName = "Last name is required";
      isValid = false;
    } else {
      newErrors.lastName = "";
    }

    if (!shipAddress1.trim()) {
      newErrors.shipAddress1 = "Shipping address is required";
      isValid = false;
    } else {
      newErrors.shipAddress1 = "";
    }

    // Phone validation
    if (phoneRaw.trim()) {
      const shipE164 = formatPhoneE164(phoneRaw, shipCountryIso || undefined);
      if (!shipE164) {
        newErrors.phoneRaw = "Please enter a valid phone number";
        isValid = false;
      } else {
        newErrors.phoneRaw = "";
      }
    } else {
      newErrors.phoneRaw = "";
    }

    // Billing validation if different from shipping
    if (!billingSame) {
      if (!billAddress1.trim()) {
        newErrors.billAddress1 = "Billing address is required";
        isValid = false;
      } else {
        newErrors.billAddress1 = "";
      }

      if (billPhoneRaw.trim()) {
        const billE164 = formatPhoneE164(billPhoneRaw, billCountryIso || undefined);
        if (!billE164) {
          newErrors.billPhoneRaw = "Please enter a valid phone number";
          isValid = false;
        } else {
          newErrors.billPhoneRaw = "";
        }
      } else {
        newErrors.billPhoneRaw = "";
      }
    }

    setFieldErrors(newErrors);
    return isValid;
  };

  // Update field change handlers to include validation
  const createFieldHandler = (setter, fieldName) => (e) => {
    const val = e.target.value;
    setter(val);
    // Validate field on change
    if (val.trim()) {
      validateField(fieldName, val);
    }
  };

  // Blur handlers for validation
  const createBlurHandler = (fieldName, value) => () => {
    validateField(fieldName, value);
  };

  // 🔹 NEW effect: check if customer already has a company
  const fetchurl = `https://shopy-onboard-b2b.onrender.com/apps/proxy/b2b-registration`;
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setCheckingCompany(true);
        // @ts-ignore
        const token = await shopify.sessionToken.get();
        //console.log("complete shopify extensino values",shopify);
        const resp = await fetch(fetchurl, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          mode: "cors",
        });

        const data = await resp.json();
        if (!mounted) return;
        if (!resp.ok) {
          //console.log("checking loading or not");
          console.warn("Failed to check company:", data?.message || resp.status);
          setExistingCompany(null);
        } else {
          if (data?.success && data.company) {
            //console.log("loading success");
            setExistingCompany(data.company.companyStatus);
            setExistingCompanynameValues(data.company);
          } else {
            //console.log("loading not success");
            setExistingCompany(null);
          }
        }
      } catch (err) {
        //console.log("final error id:", err);
        //console.error("Error checking company:", err);
        if (mounted) setExistingCompany(null);
      } finally {
        if (mounted) setCheckingCompany(false);
      }
    })();
    return () => { mounted = false; };
  // @ts-ignore
  }, [shopify.sessionToken]);

  // load countries once
  useEffect(() => {
    let mounted = true;
    (async () => {
      const list = await loadCountries();
      //const listnew = await loadCountriesnew();
      //console.log("old countries",list);
      //console.log("new countries",listnew);
      if (!mounted) return;
      setCountries(list);
      if (list.length && !shipCountryIso) {
        setShipCountryIso(list[0].iso);
      }
      if (list.length && !billCountryIso) {
        setBillCountryIso(list[0].iso);
      }
    })();
    return () => { mounted = false; };
  }, []);
  // Load shipping states when shipCountryIso changes
  useEffect(() => {
    let mounted = true;
    (async () => {
      setShipStates([]);
      setShipStateCode("");
      setShipStateFreeText("");
      if (!shipCountryIso) return;

      setLoadingShipStates(true);
      const states = await loadStates(shipCountryIso);
      if (!mounted) return;
      setShipStates(states || []);
      setLoadingShipStates(false);
    })();
    return () => { mounted = false; };
  }, [shipCountryIso]);
   // Load billing states when billCountryIso changes
  useEffect(() => {
    let mounted = true;
    (async () => {
      setBillStates([]);
      setBillStateCode("");
      setBillStateFreeText("");
      if (!billCountryIso) return;

      setLoadingBillStates(true);
      const states = await loadStates(billCountryIso);
      if (!mounted) return;
      setBillStates(states || []);
      setLoadingBillStates(false);
    })();
    return () => { mounted = false; };
  }, [billCountryIso]);


  useEffect(() => {
    setPhoneHint(getPhoneHint(countries, shipCountryIso));
  }, [countries, shipCountryIso]);

  useEffect(() => {
    setBillPhoneHint(getPhoneHint(countries, billCountryIso));
  }, [countries, billCountryIso]);

  const countryOptions = countries.map((c) => ({
    value: c.iso,
    label: `${c.name} (${c.iso})${c.callingCode ? ` +${c.callingCode}` : ""}`,
  }));

  const handleSubmit = async () => {
    setLoading(true);
    setMessage("");
    setError("");

    // Validate form before submission
    if (!validateForm()) {
      setLoading(false);
      setError("Please fix the validation errors above.");
      return;
    }

    try {
      const shipE164 = phoneRaw ? formatPhoneE164(phoneRaw, shipCountryIso || undefined) : undefined;
      const billingE164 = !billingSame && billPhoneRaw
        ? formatPhoneE164(billPhoneRaw, billCountryIso || undefined)
        : billingSame ? shipE164 : undefined;

      const shippingAddress = {
        firstName: shipFirst || undefined,
        lastName: shipLast || undefined,
        address1: shipAddress1 || undefined,
        address2: shipAddress2 || undefined,
        city: shipCity || undefined,
        zip: shipZip || undefined,
        phone: shipE164 || undefined,
        countryCode: shipCountryIso || undefined
      };
      
      const billingAddress = billingSame ? undefined : {
        firstName: billFirst || undefined,
        lastName: billLast || undefined,
        address1: billAddress1 || undefined,
        address2: billAddress2 || undefined,
        city: billCity || undefined,
        zip: billZip || undefined,
        phone: billingE164 || undefined,
        countryCode: billCountryIso || undefined
      };

      const shippingprovince = {
        province: shipStateCode || undefined,
      }
      const billingprovince = billingSame ? undefined : {
        province: billStateCode || undefined,
      }
      const shipbillprovince = {
        shippingprovince,
          billingSameAsShipping: !!billingSame,
          ...(billingprovince ? { billingprovince } : {}),
      }
      const input = {
        company: { name: companyName, externalId: externalId || undefined },
        companyLocation: {
          name: `${companyName} HQ`,
          shippingAddress,
          billingSameAsShipping: !!billingSame,
          ...(billingAddress ? { billingAddress } : {}),
        }
      };

      const contactInfo = {
        contactinfo: { contactfname: firstName, contactlname: lastName, jobtitle: jobTitle }
      };

      // @ts-ignore
      const token = await shopify.sessionToken.get();
      const response = await fetch(fetchurl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ input, contactInfo, shipbillprovince }),
      });

      const text = await response.text();
      let result = null;
      try { result = text ? JSON.parse(text) : null; } catch (e) { result = null; }
      
      if (!response.ok) {
        const msg = result?.message || `Server error ${response.status}`;
        setError(msg);
        setLoading(false);
        return;
      }
      if (result?.success) {
        setMessage(result.message || "Company created successfully");
        setTimeout(() => {
          navigation.navigate("extension:manage-team/");
          //navigation.navigate("extension:b2-b-registration/");
        }, 300);
        return;
      }

    } catch (err) {
      console.error("Submit error:", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  if (checkingCompany) {
    return (
      <s-page heading="Wholesaler Application">
        <s-section>
          <s-text>Checking company status…</s-text>
        </s-section>
      </s-page>
    );
  }

  //console.log("current company status--",existingCompany);
  if (existingCompany == "autoApprove" || existingCompany == "approved") {
    return (
      <s-page heading="Manage Team">
        <s-stack direction="block" gap="base">
          <s-banner tone="success">
            <s-text>You are already a member of a company: {existingCompanyValues.name}</s-text>
          </s-banner>
          <s-button variant="primary" href="extension:manage-team/">
            Manage Team
          </s-button>
        </s-stack>
      </s-page>
    );
  } else if (existingCompany == "open") {
    return (
      <s-page heading="Manage Team">
        <s-section>
          <s-banner tone="info">
            <s-stack direction='block'>
              <s-text>Awaiting review</s-text>
              <s-text>
                <s-text type="strong">{existingCompanyValues.name} ,</s-text>
                If it is approved you will be able to start placing orders, otherwise you may revise your application and resubmit.
              </s-text>
            </s-stack>
          </s-banner>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Wholesaler Application new">
      <s-stack gap="base">
        <s-heading>Company information</s-heading>
        <s-text-field 
          label="Company name *" 
          value={companyName}
          onChange={createFieldHandler(setCompanyName, 'companyName')}
          onBlur={createBlurHandler('companyName', companyName)}
          error={fieldErrors.companyName}
          required 
        />

        <s-text-field 
          label="External Id *" 
          value={externalId}
          onChange={createFieldHandler(setExternalId, 'externalId')}
          onBlur={createBlurHandler('externalId', externalId)}
          
          error={fieldErrors.externalId}
          required
        />

        <s-heading>Contact information</s-heading>
        
        <s-grid gridTemplateColumns="repeat(2, 1fr)" gap='base'>
          <s-text-field 
            label="First name *" 
            value={firstName}
            onChange={createFieldHandler(setFirstName, 'firstName')}
            onBlur={createBlurHandler('firstName', firstName)}
            error={fieldErrors.firstName}
            required 
          />
          <s-text-field 
            label="Last name *" 
            value={lastName}
            onChange={createFieldHandler(setLastName, 'lastName')}
            onBlur={createBlurHandler('lastName', lastName)}
            error={fieldErrors.lastName}
            required 
          />
        </s-grid>
        
        <s-text-field 
          label="Job title / position" 
          value={jobTitle}
          onChange={createFieldHandler(setJobTitle, 'jobTitle')}
        />

        <s-heading>Shipping address</s-heading>
        <s-grid gridTemplateColumns="repeat(2, 1fr)" gap='base'>
          <s-text-field 
            label="First name" 
            value={shipFirst}
            onChange={createFieldHandler(setShipFirst, 'shipFirst')}
          />
          <s-text-field 
            label="Last name" 
            value={shipLast}
            onChange={createFieldHandler(setShipLast, 'shipLast')}
          />
        </s-grid>

        <s-select
          label="Country"
          value={shipCountryIso || ""}
          onChange={createFieldHandler(setShipCountryIso, 'shipCountryIso')}
          placeholder="Select country"
        >
          {countryOptions.map(opt => (
            <s-option key={opt.value} value={opt.value}>
              {opt.label}
            </s-option>
          ))}
        </s-select>
        {/* state dorpdown */}
        <s-select
          label="State"
          value={shipStateCode || ""}
          onChange={createFieldHandler(setShipStateCode, 'shipStateCode')}
          placeholder="Select States"
        >
          {shipStates.map(opt => (
            <s-option key={opt.code} value={opt.code}>
              {opt.name}
            </s-option>
          ))}
        </s-select>


        <s-text-field 
          label={`Phone ${phoneHint ? `(${phoneHint})` : ""}`} 
          value={phoneRaw}
          onChange={createFieldHandler(setPhoneRaw, 'phoneRaw')}
          onBlur={createBlurHandler('phoneRaw', phoneRaw)}
          
          error={fieldErrors.phoneRaw}
          placeholder={phoneHint ? `${phoneHint} 1234567890` : "Enter phone"} 
        />

        <s-text-field 
          label="Address line 1 *" 
          value={shipAddress1}
          onChange={createFieldHandler(setShipAddress1, 'shipAddress1')}
          onBlur={createBlurHandler('shipAddress1', shipAddress1)}
          
          error={fieldErrors.shipAddress1}
          required 
        />

        <s-text-field 
          label="City" 
          value={shipCity}
          onChange={createFieldHandler(setShipCity, 'shipCity')}
        />

        <s-text-field 
          label="ZIP / Postal code" 
          value={shipZip}
          onChange={createFieldHandler(setShipZip, 'shipZip')}
        />

        <s-heading>Billing address</s-heading>
        <s-checkbox 
          label="Same as shipping address" 
          checked={billingSame}
          onChange={(e) => {
            // @ts-ignore
            const val = e.target.checked;
            setBillingSame(val);
            // Clear billing errors when checkbox is checked
            if (val) {
              setFieldErrors(prev => ({
                ...prev,
                billAddress1: "",
                billPhoneRaw: ""
              }));
            }
          }} 
        />

        {!billingSame && (
          <>
            <s-grid gridTemplateColumns="repeat(2, 1fr)" gap='base'>
              <s-text-field 
                label="First name" 
                value={billFirst}
                onChange={createFieldHandler(setBillFirst, 'billFirst')}
              />
              <s-text-field 
                label="Last name" 
                value={billLast}
                onChange={createFieldHandler(setBillLast, 'billLast')}
              />
            </s-grid>

            <s-select
              label="Billing country"
              value={billCountryIso || ""}
              onChange={createFieldHandler(setBillCountryIso, 'billCountryIso')}
              placeholder="Select country"
            >
              {countryOptions.map(opt => (
                <s-option key={opt.value} value={opt.value}>
                  {opt.label}
                </s-option>
              ))}
            </s-select>
            {/* state dorpdown */}
            <s-select
              label="State"
              value={billStateCode || ""}
              onChange={createFieldHandler(setBillStateCode, 'billStateCode')}
              placeholder="Select States"
            >
              {billStates.map(opt => (
                <s-option key={opt.code} value={opt.code}>
                  {opt.name}
                </s-option>
              ))}
            </s-select>

            <s-text-field 
              label={`Phone ${billphoneHint ? `(${billphoneHint})` : ""}`} 
              value={billPhoneRaw}
              onChange={createFieldHandler(setBillPhoneRaw, 'billPhoneRaw')}
              onBlur={createBlurHandler('billPhoneRaw', billPhoneRaw)}
              
              error={fieldErrors.billPhoneRaw}
              placeholder={billphoneHint ? `${billphoneHint} 1234567890` : "Enter phone"} 
            />

            <s-text-field 
              label="Address line 1 *" 
              value={billAddress1}
              onChange={createFieldHandler(setBillAddress1, 'billAddress1')}
              onBlur={createBlurHandler('billAddress1', billAddress1)}
              
              error={fieldErrors.billAddress1}
            />

            <s-text-field 
              label="City" 
              value={billCity}
              onChange={createFieldHandler(setBillCity, 'billCity')}
            />

            <s-text-field
              label="ZIP / Postal code"
              value={billZip}
              onChange={createFieldHandler(setBillZip, 'billZip')}
            />
          </>
        )}

        <s-press-button onClick={handleSubmit} loading={loading} disabled={loading}>
          Submit
        </s-press-button>

        {message && <s-banner tone="success"><s-text>{message}</s-text></s-banner>}
        {error && <s-banner tone="critical"><s-text>{String(error)}</s-text></s-banner>}
      </s-stack>
    </s-page>
  );
}