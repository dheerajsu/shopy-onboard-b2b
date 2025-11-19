// app/routes/api.countrieslist.jsx
import { countrieslisting } from "../utils/countries";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function loader({ request }) {
  // handle preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const url = new URL(request.url);
  const countryCode = url.searchParams.get("countryCode"); // e.g. "US" or "IN"

  // If a specific country is requested, return that country and its provinces (states)
  if (countryCode && request.method === "GET") {
    const code = countryCode.trim().toUpperCase();
    const found = (countrieslisting.countries || []).find(
      (c) => (c.code || "").toUpperCase() === code || (c.iso2 || "").toUpperCase() === code
    );

    if (!found) {
      return new Response(JSON.stringify({ error: "Country not found" }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // Return the country object and the provinces (if any).
    // Normalizing to { country, states } makes the client simpler.
    const states = Array.isArray(found.provinces) ? found.provinces : [];
    return new Response(JSON.stringify({ country: found, states }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  // Default: return a lightweight list (id, name, iso, callingCode) — no states
  if (request.method === "GET") {
    const simplifiedList = (countrieslisting.countries || []).map((c) => ({
      id: c.id ?? null,
      name: c.name,
      iso: c.code ?? c.iso2 ?? "",
      callingCode: (c.phoneCode || "").replace("+", ""),
    }));

    return new Response(JSON.stringify({ countries: simplifiedList }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  // unsupported method
  return new Response("Method Not Allowed", {
    status: 405,
    headers: corsHeaders,
  });
}
