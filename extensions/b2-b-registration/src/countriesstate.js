// extension/src/countries.js
const API_BASE = "https://geo-terrain-elvis-photo.trycloudflare.com/api/countryslist"; // matches app/routes/api.countrieslist.jsx

let countriesCache = null;
const statesCache = new Map(); // key: ISO (uppercase) -> states array

export async function loadCountries() {
  if (countriesCache) return countriesCache;

  try {
    const resp = await fetch(API_BASE, { method: "GET", mode: "cors" });
    if (!resp.ok) {
      console.warn("loadCountries: non-OK response", resp.status);
      countriesCache = [];
      return countriesCache;
    }
    const json = await resp.json();
    // Expecting { countries: [...] }
    const list = (json.countries || []).map((c) => ({
      id: c.id,
      name: c.name,
      iso: (c.iso || "").toUpperCase(),
      callingCode: c.callingCode || "",
    }));
    countriesCache = list;
    return list;
  } catch (err) {
    console.error("loadCountries error", err);
    countriesCache = [];
    return countriesCache;
  }
}

/**
 * Fetch states (provinces) for a single country iso (e.g. "US", "IN").
 * Caches per-country results.
 * Returns an array of states: [{ name, code? }, ...]
 */
export async function loadStates(countryIso) {
  if (!countryIso) return [];
  const key = countryIso.toUpperCase();
  if (statesCache.has(key)) return statesCache.get(key);

  try {
    const resp = await fetch(`${API_BASE}?countryCode=${encodeURIComponent(key)}`, {
      method: "GET",
      mode: "cors",
    });
    if (!resp.ok) {
      console.warn("loadStates: non-OK response", resp.status, key);
      statesCache.set(key, []);
      return [];
    }
    const json = await resp.json();
    // We expect { country: {...}, states: [...] }
    const states = (json.states || []).map((s) => ({
      name: s.name,
      code: s.code ?? s.iso ?? s.name,
    }));
    statesCache.set(key, states);
    return states;
  } catch (err) {
    console.error("loadStates error", err);
    statesCache.set(key, []);
    return [];
  }
}

export function getPhoneHint(countries, iso) {
  if (!countries || !iso) return "";
  const c = countries.find((x) => (x.iso || "").toUpperCase() === iso.toUpperCase());
  if (!c) return "";
  return c.callingCode ? `e.g. +${c.callingCode} 123456789` : "";
}
