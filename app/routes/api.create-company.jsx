import prisma from "../db.server";
import { Prisma } from "@prisma/client"; // add this import

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
  "Content-Type": "application/json",
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
  const shipbillprovince = body.shipbillprovince ?? {};
  const staticcompanyid = body.customerId ?? body.staticcompanyid ?? null;

  try {
    const setting = await prisma.setting.findUnique({ where: { shopId } });

    if (setting === null || setting.autoApproval === false) {
      let customerid = staticcompanyid ?? null;
      let displayname = input.company?.name ?? null;
      let customerEmail = input.company?.email ?? undefined;

      // create companycontact -- wrap this to catch unique constraint
      let contact;
      try {
        contact = await prisma.companycontact.create({
          data: {
            baseCustomerId: customerid,
            customername: displayname ?? undefined,
            email: customerEmail ?? undefined,
            companystatus: false,
            shopId: shopId,
          },
        });
      } catch (err) {
        // Prisma unique constraint error code is 'P2002'
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          // err.meta?.target may contain the constrained fields array
          const target = (err.meta && err.meta.target) || ["baseCustomerId"];
          return jsonResponse(
            {
              success: false,
              message: "Unique constraint error: value already exists.",
              code: "unique_constraint",
              fields: target,
            },
            409
          );
        }

        // rethrow non-unique errors so outer catch handles them
        throw err;
      }

      const location = input.companyLocation || {};
      const shippingBase = location.shippingAddress ?? null;
      const shipping = {
        ...shippingBase,
        province: shipbillprovince?.shippingprovince?.province,
      };

      const billingBase = location.billingAddress ?? null;
      const billingadd = {
        ...billingBase,
        province: shipbillprovince?.billingprovince?.province,
      };
      
      const billingshippingsame = location.billingSameAsShipping;
      const billing = location.billingSameAsShipping ? shipping : billingadd;

      const created = await prisma.company.create({
        data: {
          customerId: contact.id,
          companyGid: input.company?.companyGid ?? input.company?.externalId ?? undefined,
          name: input.company?.name || "-",
          externalId: input.company?.externalId ?? undefined,
          billing: billing ?? {},
          shipping: shipping ?? null,
          contactInfoFirstName: contactInfo.contactinfo?.contactfname || "-",
          contactInfoLastName: contactInfo.contactinfo?.contactlname || "-",
          contactInfoJob: contactInfo.contactinfo?.jobtitle || "-",
          companyStatus: input.company?.companyStatus,
          shopId: shopId,
          aurthorizedStatus: true,
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
            externalId: created.externalId ?? null,
            customerContactId: contact.id,
          },
        },
        201
      );
    }

    return jsonResponse(
      { success: false, message: "Auto-approval path not handled by this endpoint." },
      400
    );
  } catch (err) {
    console.error("Error creating local company/contact:", err);
    return jsonResponse({ success: false, message: "Server error" }, 500);
  }
};
