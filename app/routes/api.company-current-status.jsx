// /mnt/data/api.company-current-status.jsx
import prisma from "../db.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
  "Content-Type": "application/json",
};

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: CORS });
}

/**
 * Validate x-api-key for the given shopId (shop-specific key stored in session.appapikey).
 * Returns true if matches, false otherwise.
 */
async function validateApiKey(shopId, providedKey) {
  if (!providedKey) return false;
  const session = await prisma.session.findFirst({ where: { shop: shopId } });
  if (!session) return false;
  const shopKey = session.appapikey ?? "";
  // strict match only (no master fallback here). If you want master fallback, add it.
  return providedKey === shopKey;
}

export const loader = async ({ request }) => {
  // Support CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: CORS });
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return new Response(null, { status: 405, headers: CORS });
  }

  // Parse inputs
  let baseCustomerId = null;
  let shopId = null;

  if (request.method === "GET") {
    const url = new URL(request.url);
    baseCustomerId = url.searchParams.get("baseCustomerId");
    shopId = url.searchParams.get("shopId");
  } else {
    // POST
    try {
      const body = await request.json();
      baseCustomerId = body.baseCustomerId ?? body.customerGid ?? null;
      shopId = body.shopId ?? null;
    } catch (err) {
      return jsonResponse({ success: false, message: "Invalid JSON body" }, 400);
    }
  }

  if (!shopId) {
    return jsonResponse({ success: false, message: "Missing shopId" }, 400);
  }
  console.log("id is",baseCustomerId);
  if (!baseCustomerId) {
    return jsonResponse({ success: false, message: "Missing baseCustomerId" }, 400);
  }

  // Validate x-api-key header
  const providedKey = (request.headers.get("x-api-key") || "").trim();
  const validKey = await validateApiKey(shopId, providedKey);
  if (!validKey) {
    return jsonResponse({ success: false, message: "API key not matching" }, 401);
  }

  try {
    const contact = await prisma.companycontact.findUnique({
      where: { baseCustomerId: baseCustomerId },
    });

    if (!contact) {
      return jsonResponse({ success: true, company: null });
    }

    const company = await prisma.company.findFirst({
      where: { customerId: contact.id },
    });

    if (!company) {
      return jsonResponse({ success: true, company: null });
    }

    return jsonResponse({
      success: true,
      local: true,
      company: {
        id: company.id,
        name: company.name,
        externalId: company.externalId ?? null,
        createdAt: company.createdAt?.toISOString?.() ?? null,
        companyStatus: company.companyStatus || "open",
      },
    });
  } catch (err) {
    console.error("Error fetching company status:", err);
    return jsonResponse({ success: false, message: "Server error" }, 500);
  }
};
