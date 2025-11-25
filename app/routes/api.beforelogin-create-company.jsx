import prisma from "../db.server";
import { Prisma } from "@prisma/client"; // add this import

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
  "Content-Type": "application/json",
};

export const loader = async ({ request }) => {
  // Handle preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: CORS });
  }

  // GET (or any other non-POST) -> respond with "method not allowed"
  return new Response(
    JSON.stringify({
      success: false,
      message: "This route only accepts POST requests. Please send a POST to /api/create-company",
    }),
    { status: 405, headers: CORS }
  );
};

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: CORS });
}

async function validateApiKey(shopId, providedKey) {
  if (!providedKey) return false;
  const session = await prisma.session.findFirst({ where: { shop: shopId } });
  if (!session) return false;
  const shopKey = session.appapikey ?? "";
  return providedKey === shopKey;
}

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: CORS });
  }
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: CORS });
  }

  const url = new URL(request.url);
  const shopId = url.searchParams.get("shopId");
  if (!shopId) {
    return jsonResponse({ success: false, message: "Missing shopId" }, 400);
  }

  const providedKey = (request.headers.get("x-api-key") || "").trim();
  const ok = await validateApiKey(shopId, providedKey);
  if (!ok) {
    return jsonResponse({ success: false, message: "API key not matching" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({ success: false, message: "Invalid JSON body" }, 400);
  }

  const input = body.input ?? {};
  const contactInfo = body.contactInfo ?? {};
  //const shipbillprovince = body.shipbillprovince ?? {};

  try {
      const location = input.companyLocation || {};
      const shippingBase = location.shippingAddress ?? null;
      const shipping = {
        ...shippingBase
        
      };

      const billingBase = location.billingAddress ?? null;
      const billingadd = {
        ...billingBase
      };
      
      const billingshippingsame = location.billingSameAsShipping;
      const billing = location.billingSameAsShipping ? shipping : billingadd;

      const created = await prisma.company.create({
        data: {
          customerEmail: contactInfo.contactinfo?.customerEmail,
          customerFirstName:contactInfo.contactinfo?.customerFirstName,
          customerLastName:contactInfo.contactinfo?.customerLastName,
          customerPhone:contactInfo.contactinfo?.customerPhone,
          name: input.company?.name || "-",
          externalId: input.company?.externalId ?? undefined,
          taxId: input.company?.taxId ?? undefined,
          billing: billing ?? {},
          shipping: shipping ?? null,
          contactInfoJob: contactInfo.contactinfo?.jobtitle || "-",
          companyStatus: input.company?.companyStatus,
          shopId: shopId,
          aurthorizedStatus: false,
          billingshippingsame
        },
      });

      return jsonResponse(
        {
          success: true,
          message: "Company request submitted successfully (pending approval).",
          companystatus: created.companyStatus,
          company: {
            id: created.id,
            name: created.name,
            externalId: created.externalId ?? null
          },
        },
        201
      );
  } catch (err) {
    const target = (err.meta && err.meta.target) || ["baseCustomerId"];
    return jsonResponse({ success: false, message: "Server error" , fields: target}, 500);
  }
};
