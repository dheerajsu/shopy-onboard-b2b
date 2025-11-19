import '@shopify/ui-extensions/preact';
// @ts-ignore
import { render } from 'preact';
import { useEffect, useState } from "preact/hooks";

import { BASE_URL } from "../config";
import { parsePhoneNumberFromString } from "libphonenumber-js";
//import { loadCountries, getPhoneHint } from "../countries"; // same folder
import { loadCountries, loadStates, getPhoneHint } from "../../../b2-b-registration/src/countriesstate";


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

export default function UpdateLocation({ maincompanyLocationId, onLocationUpdated }) {
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

    const locationmembers = `${BASE_URL}/apps/proxy/location-team-members`;
    const fetchurl = `${BASE_URL}/api/update-location`;

    // @ts-ignore
    const [loadingProxy, setLoadingProxy] = useState(false);
    // @ts-ignore
    const [proxyError, setProxyError] = useState(null);

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

    async function loadLocationData() {
        setLoadingProxy(true);
        setProxyError(null);
        try {
            const PAGE_SIZE = 5;
            // @ts-ignore
            const token = await shopify.sessionToken.get();
            const after = null;
            const params = new URLSearchParams();
            params.set("locationId", maincompanyLocationId);
            params.set("first", String(PAGE_SIZE));
            if (after) params.set("after", after);

            const url = `${locationmembers}?${params.toString()}`;
            const resp = await fetch(url, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` },
                mode: "cors",
            });

            const json = await resp.json().catch(() => null);

            // fill values from proxy (example assumes billing)
            const billing = json.billingaddress;
            const shipping = json.shippingaddress;
            const locationdetails = json.location.name;
            const isBillShipSame = json.isshippingBillingSame;

            setBillingSame(isBillShipSame);

            if (locationdetails) {
                setLocationName(locationdetails || "");
            }

            if (billing) {
                setBillFirst(billing.firstName || "");
                setBillLast(billing.lastName || "");
                setBillAddress1(billing.address1 || "");
                setBillAddress2(billing.address2 || "");
                setBillCountryIso(billing.countryCode || "");
                setBillPhoneRaw(billing.phone || "");
                setBillZip(billing.zip || "");
                setBillCity(billing.city || "");
            }
            if (shipping) {
                setShipFirst(shipping.firstName || "");
                setShipLast(shipping.lastName || "");
                setShipAddress1(shipping.address1 || "");
                setShipAddress2(shipping.address2 || "");
                setShipCity(shipping.city || "");
                setShipCountryIso(shipping.countryCode || "");
                setPhoneRaw(shipping.phone || "");
                setShipZip(shipping.zip || "");
            }
        } catch (err) {
            setProxyError(err.message);
        } finally {
            setLoadingProxy(false);
        }
    }

    // Fetch proxy data
    useEffect(() => {
        if (!maincompanyLocationId) return;
        loadLocationData();

    }, [maincompanyLocationId]);

    // Submit handler

    const handleUpdate = async () => {
        setLoading(true);
        setMessage("");
        setError("");

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



        try {
            // @ts-ignore
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

            const payload = { input, locationName, maincompanyLocationId };

            const resp = await fetch(fetchurl, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ payload }),
                mode: "cors",
            });
            const text = await resp.text();
            const resultparsed = JSON.parse(text);
            
            let result = null;
            try { result = text ? JSON.parse(text) : null; } catch (e) { result = null; }

            if (!resp.ok) {
                setError(result?.message || `Server error ${resp.status}`);
                setLoading(false);
                return;
            }

            if (result?.success) {
                const updatedvalues = result.assignResults[0].companyName;
                onLocationUpdated(result.assignResults[0].companyName);
                loadLocationData();
                
                setMessage(result.message || "Location updated");

                setLoading(false);
                return;
            }

            setError(result?.message || "Failed to update location");
        } catch (err) {
            console.error("update location error", err);
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <s-stack direction='inline' gap="base">
            <s-button command="--show" commandFor="modal-2">Update Location</s-button>
            <s-modal id="modal-2" heading="Edit Location">
                {message && <s-banner tone="success"><s-text>{message}</s-text></s-banner>}
                {error && <s-banner tone="critical"><s-text>{error}</s-text></s-banner>}


                <s-stack gap="base" >
                    <s-text-field label="Location Name" value={locationName} onChange={(e) => setLocationName(e.currentTarget.
                        // @ts-ignore
                        value)} />

                    <s-heading>Shipping address</s-heading>
                    <s-stack gap="base">
                        <s-text-field label="First name" value={shipFirst} onChange={(e) => setShipFirst(e.currentTarget.
                            // @ts-ignore
                            value)} />
                        <s-text-field label="Last name" value={shipLast} onChange={(e) => setShipLast(e.currentTarget.
                            // @ts-ignore
                            value)} />
                    </s-stack>
                    <s-select label="Country" value={shipCountryIso || ""}
                        // @ts-ignore
                        onChange={(e) => setShipCountryIso(e.currentTarget.value)}
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
                        // @ts-ignore
                        onChange={(e) => setPhoneRaw(e.currentTarget.value)}
                        placeholder={phoneHint ? `${phoneHint} 1234567890` : "Enter phone"} />

                    <s-text-field label="Address line 1 *" value={shipAddress1} onChange={(e) => setShipAddress1(e.currentTarget.
                        // @ts-ignore
                        value)} required />
                    <s-text-field label="City" value={shipCity} onChange={(e) => setShipCity(e.currentTarget.
                        // @ts-ignore
                        value)} />
                    <s-text-field label="ZIP / Postal code" value={shipZip} onChange={(e) => setShipZip(e.currentTarget.
                        // @ts-ignore
                        value)} />

                    <s-heading>Billing address</s-heading>


                    <s-checkbox label="Same as shipping address" checked={billingSame} value='billingSame'
                        onChange={(e) => {
                            const val = /** @type {HTMLInputElement} */ (e.target).checked;
                            setBillingSame(val);
                        }} />


                    {!billingSame && (
                        <>
                            <s-stack gap="base">
                                <s-text-field label="First name" value={billFirst} onChange={(e) => setBillFirst(e.currentTarget.
                                    // @ts-ignore
                                    value)} />
                                <s-text-field label="Last name" value={billLast} onChange={(e) => setBillLast(e.currentTarget.
                                    // @ts-ignore
                                    value)} />
                            </s-stack>

                            <s-select label="Billing country" value={billCountryIso || ""}
                                // @ts-ignore
                                onChange={(e) => setBillCountryIso(e.currentTarget.value)}
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
                                // @ts-ignore
                                onChange={(e) => setBillPhoneRaw(e.currentTarget.value)}
                                placeholder={billphoneHint ? `${billphoneHint} 1234567890` : "Enter phone"} />



                            <s-text-field label="Address line 1 *" value={billAddress1} onChange={(e) => setBillAddress1(e.currentTarget.
                                // @ts-ignore                            
                                value)} required />

                            <s-text-field label="City" value={billCity} onChange={(e) => setBillCity(e.currentTarget.
                                // @ts-ignore
                                value)} />

                            <s-text-field label="ZIP / Postal code" value={billZip} onChange={(e) => setBillZip(e.currentTarget.
                                // @ts-ignore
                                value)} />
                        </>
                    )}
                    {/* billing and shipping form END */}
                    <s-stack direction='inline'>
                        <s-button onClick={handleUpdate} loading={loading} disabled={loading} >Save location</s-button>
                        <s-button command='--hide' commandFor="modal-2" >Cancel</s-button>
                    </s-stack>
                </s-stack>
            </s-modal>

        </s-stack>

    );
}
