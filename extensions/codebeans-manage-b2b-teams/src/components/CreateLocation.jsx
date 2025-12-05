import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import React, { useEffect, useState } from "preact/hooks";
import { parsePhoneNumberFromString } from "libphonenumber-js";
//import { loadCountries, getPhoneHint } from "../countries"; // same folder
import { loadCountries, loadStates, getPhoneHint } from "../../../codebeans-b2b-registrations/src/countriesstate";
import { BASE_URL } from "../config.js";

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


export default function CreateLocation({ onCreated = () => { } }) {

  const fetchurl = `${BASE_URL}/api/create-location`;

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

  // form fields
  const [locationName, setLocationName] = useState("")
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


  // load countries once
  useEffect(() => {
    let mounted = true;
    (async () => {
      const list = await loadCountries();
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

  const resetForm = () => {
    setShipFirst("");
    setShipLast("");
    setShipCountryIso("");
    setPhoneRaw("");
    setShipAddress1("");
    setShipCity("");
    setShipZip("");
    setBillingSame(true);
    setBillFirst("");
    setBillLast("");
    setBillPhoneRaw("");
    setBillAddress1("");
    setBillCity("");
    setBillZip("");
  };

  const handleCreate = async () => {
    //console.log("location name is--",locationName);
    setLoading(true);
    setMessage("");
    setError("");

    if (!locationName) {
      setError("Location Name is required");
      setLoading(false);
      return;
    }
    if (!shipAddress1) {
      setError("Address line 1 is required");
      setLoading(false);
      return;
    }

    const shipE164 = phoneRaw ? formatPhoneE164(phoneRaw, shipCountryIso || undefined) : undefined;
    if (phoneRaw && !shipE164) {
      setError("Please enter a valid shipping phone number for the selected country.");
      setLoading(false);
      return;
    }

    const billingE164 = !billingSame && billPhoneRaw
      ? formatPhoneE164(billPhoneRaw, billCountryIso || undefined)
      : billingSame ? shipE164 : undefined;
    if (!billingSame && billPhoneRaw && !billingE164) {
      setError("Please enter a valid billing phone number for the selected country.");
      setLoading(false);
      return;
    }

    const shippingAddress = {
      firstName: shipFirst || undefined,
      lastName: shipLast || undefined,
      address1: shipAddress1 || undefined,
      address2: shipAddress2 || undefined,
      city: shipCity || undefined,
      zip: shipZip || undefined,
      phone: shipE164 || undefined,
      countryCode: shipCountryIso || undefined,
    };

    const billingAddress = billingSame ? undefined : {
      firstName: billFirst || undefined,
      lastName: billLast || undefined,
      address1: billAddress1 || undefined,
      address2: billAddress2 || undefined,
      city: billCity || undefined,
      zip: billZip || undefined,
      phone: billingE164 || undefined,
      countryCode: billCountryIso || undefined,
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

    try {
      const token = await shopify.sessionToken.get();
      const input = {
        name: locationName,
        buyerExperienceConfiguration: {
          checkoutToDraft: true,
          editableShippingAddress: true,
        },
        shippingAddress,
        billingSameAsShipping: !!billingSame,
        ...(billingAddress ? { billingAddress } : {}),
      };

      const payload = { input };

      const resp = await fetch(fetchurl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ payload , shipbillprovince }),
        mode: "cors",
      });
      const text = await resp.text();
      let result = null;
      try { result = text ? JSON.parse(text) : null; } catch (e) { result = null; }

      if (!resp.ok) {
        setError(result?.message || `Server error11 ${resp.status}`);
        setLoading(false);
        return;
      }

      if (result?.success) {
        //console.log("created result is--", result);
        const created = result?.companyLocation ?? result?.data ?? null;
        //console.log("created data new is--", created);
        try {
          if (created) {
            // @ts-ignore
            onCreated(created);
          }
        } catch (e) {
          console.error("onCreated callback error", e);
        }

        setMessage(result.message || "Location created");
        shopify.toast.show("created successfully");
        
        setTimeout(() => {
          const modal = document.querySelector("s-modal#my-modal");
          if (modal) {
            modal.dispatchEvent(
              new CustomEvent("command", {
                bubbles: true,
                detail: { command: "--hide" },
              })
            );
          }
          resetForm();
        }, 700);
        setLoading(false);
        return;
      }

      setError(result?.message || "Failed to create location");
    } catch (err) {
      console.error("create location error", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <s-stack gap="base">
      {/* <Button onPress={()=>setPingedvalue(false)}>Test</Button> */}
      
      <s-button commandFor='my-modal'>Create New Location</s-button>
      {/* {isOpen && ( */}
        <s-modal id='my-modal' heading="Add Location">
          
          {/* {error && <s-banner tone="critical"><s-text>{String(error)}</s-text></s-banner>} */}

          <s-stack gap="base" >
          {message && <s-banner tone="success"><s-text>{message}</s-text></s-banner>}
          {error && <s-banner tone="critical"><s-text>{String(error)}</s-text></s-banner>}

            <s-text-field label="Location Name*" value={locationName}
              onChange={(e) => {const val = /** @type {HTMLInputElement} */ (e.target).value; setLocationName(val)}}
              required />
            <s-divider />
            <s-heading>Shipping address</s-heading>
            <s-stack gap="base">
              <s-text-field label="First name" value={shipFirst}
                onChange={(e) => {
                  const val = /** @type {HTMLInputElement} */ (e.target).value;
                  setShipFirst(val);
                }} />
              <s-text-field label="Last name" value={shipLast}
                onChange={(e) => {
                  const val = /** @type {HTMLInputElement} */ (e.target).value;
                  setShipLast(val);
                }} />
            </s-stack>
            <s-select label="Country" value={shipCountryIso || ""}
              onChange={(e) => {
                const val = /** @type {HTMLInputElement} */ (e.target).value;
                setShipCountryIso(val);
              }}
              placeholder="Select country">
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
                onChange={(e) => {
                      const val = /** @type {HTMLInputElement} */ (e.target).value;
                      setShipStateCode(val);
                    }}
                placeholder="Select States"
              >
              {shipStates.map(opt => (
                <s-option key={opt.code} value={opt.code}>
                  {opt.name}
                </s-option>
              ))}
            </s-select>

            <s-text-field label={`Phone ${phoneHint ? `(${phoneHint})` : ""}`} value={phoneRaw}
              onChange={(e) => {
                const val = /** @type {HTMLInputElement} */ (e.target).value;
                setPhoneRaw(val);
              }}
              placeholder={phoneHint ? `${phoneHint} 1234567890` : "Enter phone"} />

            <s-text-field label="Address line 1 *" value={shipAddress1}
              onChange={(e) => {
                const val = /** @type {HTMLInputElement} */ (e.target).value;
                setShipAddress1(val);
              }}
              required />
            <s-text-field label="City" value={shipCity}
              onChange={(e) => {
                const val = /** @type {HTMLInputElement} */ (e.target).value;
                setShipCity(val);
              }} />
            <s-text-field label="ZIP / Postal code" value={shipZip}
              onChange={(e) => {
                const val = /** @type {HTMLInputElement} */ (e.target).value;
                setShipZip(val);
              }} />

            <s-heading >Billing address</s-heading>
            <s-checkbox label="Same as shipping address" checked={billingSame}
              onChange={(e) => {
                const val = /** @type {HTMLInputElement} */ (e.target).checked;
                setBillingSame(val);
              }} />

            {!billingSame && (
              <>
                <s-stack gap="base">
                  <s-text-field label="First name" value={billFirst}
                    onChange={(e) => {
                      const val = /** @type {HTMLInputElement} */ (e.target).value;
                      setBillFirst(val);
                    }} />
                  <s-text-field label="Last name" value={billLast}
                    onChange={(e) => {
                      const val = /** @type {HTMLInputElement} */ (e.target).value;
                      setBillLast(val);
                    }} />
                </s-stack>
                <s-select label="Billing country" value={billCountryIso || ""}
                  onChange={(e) => {
                    const val = /** @type {HTMLInputElement} */ (e.target).value;
                    setBillCountryIso(val);
                  }} placeholder="Select country" >
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
                    //onChange={createFieldHandler(setBillStateCode, 'billStateCode')}
                    onChange={(e) => {
                      const val = /** @type {HTMLInputElement} */ (e.target).value;
                      setBillStateCode(val);
                    }}
                    placeholder="Select States"
                  >
                    {billStates.map(opt => (
                      <s-option key={opt.code} value={opt.code}>
                        {opt.name}
                      </s-option>
                    ))}
                  </s-select>

                <s-text-field label={`Phone ${billphoneHint ? `(${billphoneHint})` : ""}`} value={billPhoneRaw}
                  onChange={(e) => {
                    const val = /** @type {HTMLInputElement} */ (e.target).value;
                    setBillPhoneRaw(val);
                  }}
                  placeholder={billphoneHint ? `${billphoneHint} 1234567890` : "Enter phone"} />

                <s-text-field label="Address line 1 *" value={billAddress1}
                  onChange={(e) => {
                    const val = /** @type {HTMLInputElement} */ (e.target).value;
                    setBillAddress1(val);
                  }} required />
                <s-text-field label="City" value={billCity}
                  onChange={(e) => {
                    const val = /** @type {HTMLInputElement} */ (e.target).value;
                    setBillCity(val);
                  }} />
                <s-text-field label="ZIP / Postal code" value={billZip}
                  onChange={(e) => {
                    const val = /** @type {HTMLInputElement} */ (e.target).value;
                    setBillZip(val);
                  }} />
              </>
            )}
            {/* billing and shipping form END */}
            <s-grid gridTemplateColumns="1fr auto">
              <s-button variant="primary" onClick={handleCreate} loading={loading} disabled={loading}>
                Save location
              </s-button>
              <s-button slot="secondary-actions" command="--hide" commandFor="my-modal">
                Cancel
              </s-button>
            </s-grid>
          </s-stack>
        </s-modal>
      {/* )} */}
    </s-stack>
  )
}