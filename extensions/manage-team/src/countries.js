import { countries as _countries } from "countries-list";

/** synchronous builder */
export function getCountries() {
  const list = Object.entries(_countries).map( ([iso, info]) => {
    let callingCode = null;
    if (info && info.phone) {
      const first = String(info.phone).split(",")[0].split("-")[0];
      callingCode = first.replace(/\D/g, "") || null;
    }
    return {
      iso: String(iso).toUpperCase(),
      name: info?.name ?? String(iso).toUpperCase(),
      callingCode,
    };
  });

  list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

/** async wrapper for backward compatibility with code that expects loadCountries() */
export async function loadCountries() {
  return getCountries();
}

/** Return phone hint like "+91" */
export function getPhoneHint(countries, iso) {
  if (!countries || !iso) return "";
  const c = countries.find((x) => x && x.iso === String(iso).toUpperCase());
  return c && c.callingCode ? "+" + String(c.callingCode) : "";
}