import { getShopifyAdminContext, graphQLRequest } from "./admin/utils";
import prisma from "../db.server";
import { companyQuery, companyCreate, custoerCompanyContact, assignContactMutation, assignMainMutation } from "./query";
const CORS = {
  "Access-Control-Allow-Origin": "*", // or a specific origin
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

async function getCtxValue(request) {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const decoded = decodeJwt(authHeader);
  const staticcompanyid = decoded?.sub;

  const ctx = await getShopifyAdminContext(request);
  const shopId = ctx.shopDomain; // or however you extract it
  return { ctx, staticcompanyid, decoded, authHeader , shopId};
}

function decodeJwt(token) {
  const payload = token.split(".")[1];
  const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
  return decoded;
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: CORS });
}

// inside app.proxy.b2b-registration.js (or the route file that serves the GET check)
export const loader = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: CORS });
  }

  const { ctx, decoded, staticcompanyid, shopId } = await getCtxValue(request);
  const customerGid = staticcompanyid;

  if (!customerGid) {
    return jsonResponse({ success: false, message: "Missing customer ID" }, 400);
  }
 
  try {
    // 1️⃣ Check local DB first
    const contact = await prisma.companycontact.findUnique({
      where: { baseCustomerId: customerGid },
    });
    //console.log("value found of not",contact);
    if (contact) {
      const company = await prisma.company.findFirst({
        where: { customerId: contact.id },
      });

      if (company) {
        return jsonResponse({
          success: true,
          local: true,
          company: {
            id: company.id,
            name: company.name,
            externalId: company.externalId ?? null,
            createdAt: company.createdAt?.toISOString?.() ?? null,
            companyStatus: company.companyStatus || "open", // fallback safety
          },
        });
      }
    }
    // 2️⃣ If not found locally, check Shopify (optional fallback)
    const variables = { customerId: customerGid };
    const resp = await graphQLRequest(ctx, companyQuery, variables);
    //console.log("what is the response",resp);
    const shopifyCompany = resp?.customer?.companyContactProfiles?.[0]?.company ?? null;

    if (shopifyCompany) {
      return jsonResponse({
        success: true,
        local: false,
        company: {
          id: shopifyCompany.id,
          name: shopifyCompany.name,
          externalId: shopifyCompany.externalId ?? null,
          createdAt: shopifyCompany.createdAt ?? null,
          companyStatus: "autoApprove",
        },
      });
    }

    // 3️⃣ No company found anywhere
    return jsonResponse({ success: true, company: null });

  } catch (err) {
    console.error("Loader error checking company:", err);
    return jsonResponse({ success: false, message: "Server error 112" }, 500);
  }
};



export const action = async ({ request }) => {

  // Always answer preflight BEFORE any auth checks
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: CORS });
  }
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: CORS });
  }

  // 2) Parse body
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({ success: false, message: "Invalid JSON body" }, 400);
  }

  const input = body.input ?? body.payload?.input ?? {};
  const contactInfo = body.contactInfo ?? body.payload?.contactInfo ?? {};
  const shipbillprovince = body.shipbillprovince ?? body.payload?.shipbillprovince ?? {};
  //console.log("final input is",body.shipbillprovince);
  //final input is { shippingprovince: { province: 'AP' }, billingSameAsShipping: true }
  //console.log("province value",shipbillprovince?.shippingprovince?.province);

  //Get token and shop domain
  const { ctx, staticcompanyid, shopId } = await getCtxValue(request);
  try {
    //--------------------- check if company auto create false-----------------------------
    const setting = await prisma.setting.findUnique({
      where: { shopId: shopId }
    });
    
    if (setting === null || setting.autoApproval === false) {
      // Store minimal data in local DB
      try {
        const { ctx, staticcompanyid, shopId } = await getCtxValue(request);
        const variables = { CustomerId: staticcompanyid };
        const companydata = await graphQLRequest(ctx, custoerCompanyContact, variables);
        const customerEmail = companydata.customer.email;
        const customerid = companydata.customer.id;
        const displayname = companydata.customer.displayName;

        const contact = await prisma.companycontact.create({
          data: {
            baseCustomerId: customerid,
            customername: displayname ?? undefined,
            email: customerEmail ?? undefined,
            companystatus: false, // not approved yet
            shopId: shopId
          },
        });
        const location = input.companyLocation || {};
        //const shipping = location.shippingAddress ?? null;
        const shippingBase = location.shippingAddress ?? null;

        const shipping = {
          ...shippingBase,
          province: shipbillprovince?.shippingprovince?.province,
        }
        //shipbillprovince?.shippingprovince?.province

        const billingBase = location.billingAddress ?? null;
        const billingadd = {
          ...billingBase,
          province: shipbillprovince?.billingprovince?.province,
        }

        const billing = location.billingSameAsShipping ? shipping : billingadd;

        await prisma.company.create({
          data: {
            customerId: contact.id,
            companyGid: input.company?.externalId ?? undefined,
            name: input.company?.name || "-",
            externalId: input.company?.externalId ?? undefined,
            billing: billing ?? {},                  // Prisma Json type expects a JS object or null depending on your model
            shipping: shipping ?? null,
            contactInfoFirstName: contactInfo.contactinfo?.contactfname || "-",
            contactInfoLastName: contactInfo.contactinfo?.contactlname || "-",
            contactInfoJob: contactInfo.contactinfo?.jobtitle || "-",
            companyStatus: "open",
            shopId: shopId,
            aurthorizedStatus:true
          },
        });

        return Response.json({
          success: true,
          message: "Request Submited successfully.",
          companystatus: "open",
        }, { headers: CORS });

      } catch (err) {
        console.error("Error saving company locally:", err);
      }
    }

    // --- NEW: fetch presets for this shop ---
    const buildAddressInput = (addr = {}) => ({
      firstName: addr.firstName || "",
      lastName: addr.lastName || "",
      address1: addr.address1 || "",
      city: addr.city || "City",
      zip: addr.zip || "",
      phone: addr.phone || "",
      countryCode: addr.countryCode || "IN", // adjust if needed
      zoneCode: addr.province || ""
    });
    
      const presetsRaw = await prisma.preset.findMany({
        where: { shopId: shopId, isDefault: true },
        orderBy: [
          { isDefault: "desc" },
          { id: "asc" }
        ],
      });
      const preset = presetsRaw[0];
      const variables = { input };
      const getclientvalues = variables.input;
      // console.log("preset values",presetsRaw);
      // console.log("variables are",variables);
      // console.log("variables shipping billing info",getclientvalues.companyLocation.shippingAddress);
      // console.log("company name is",getclientvalues.company.name);
      // console.log("preset table",preset.paymentTerms);
      
      const shippingFromClient = getclientvalues.companyLocation.shippingAddress;
      const billingSameFromClient = getclientvalues.companyLocation.billingSameAsShipping;
      const billingFromClient = getclientvalues.companyLocation.billingAddress;
      
      //console.log(`shipping address ${shippingFromClient}, billing same or not ${billingSameFromClient}, billing address ${billingFromClient}`)

      const newvariable = {
        company: {
          name: getclientvalues.company.name,
          note: preset.communication || "",
          externalId: getclientvalues.company.externalId,
        },
        companyLocation: {
          name: getclientvalues.companyLocation.name || "Main Location",
          buyerExperienceConfiguration: {
            editableShippingAddress: preset.allowOneTimeShipAddress,
            paymentTermsTemplateId: preset.paymentTerms?.gid || null,
            // flip boolean
            checkoutToDraft: !preset.checkoutOrderDraft,
            // convert % string → float
            deposit: preset.requireDeposit
                      ? { percentage: parseFloat(preset.requireDeposit)} 
                      : null, 
          },
          // "true"/"false"/boolean → strict boolean
          taxExempt: preset.taxes === 'true', //need to update

          // addresses
          shippingAddress: buildAddressInput(shippingFromClient),

           ...(billingSameFromClient
              ? {
                  billingSameAsShipping: true,
                }
              : {
                  billingSameAsShipping: false,
                  billingAddress: buildAddressInput(billingFromClient),
                }),
          },
      };

      //console.log("final variable is",newvariable);
      //return "ignore for now";
    
    //console.log("all variables ",variables);
    const companyvariables = { input: newvariable };
    const response = await graphQLRequest(ctx, companyCreate, companyvariables);
    
    
    // Top-level errors from GraphQL (ACCESS_DENIED etc)
    const topLevelErrors = response?.companyCreate?.userErrors;
    //console.log("final response is",topLevelErrors);
    // handle user errors
    const userErrors = response?.companyCreate?.userErrors ?? [];

    if(userErrors.length > 0){
      const errorMessages = userErrors.map(error => error.message).join(', ');
      console.error("Shopify returned userErrors:", errorMessages);
      return Response.json({ success: false, message: errorMessages }, { status: 400, headers: CORS });
    }

    // Created company object (if successful)
    const createdCompany = response?.companyCreate?.company;

    // If GraphQL returned a created company -> treat it as success (but surface warnings)
    if (createdCompany) {
      
      const { ctx, staticcompanyid, shopId } = await getCtxValue(request);
      
      //get current base comsomer details
      const variables = { CustomerId: staticcompanyid };
      const companydata = await graphQLRequest(ctx, custoerCompanyContact, variables);
      const customerEmail = companydata.customer.email;
      const customerid = companydata.customer.id;
      const displayname = companydata.customer.displayName;

      // --- Persist to your MySQL (Prisma) DB ---
      try {
        
        await prisma.companycontact.create({
          data: {
            baseCustomerId: customerid,
            customername: displayname ?? undefined,
            email: customerEmail ?? undefined,
            companystatus: true,
            shopId: shopId
          },
        });
        let customercollection = await prisma.companycontact.findUnique({
          where: { baseCustomerId: customerid }
        });
        const location = input.companyLocation || {};
        // const shipping = location.shippingAddress ?? null;
        // //let billing = null;
        // const billing = location.billingSameAsShipping ? shipping : location.billingAddress ?? null;

        // if (location.billingSameAsShipping) {
        //   billing = shipping;
        // } else if (location.billingAddress) {
        //   billing = location.billingAddress;
        // } else {
        //   billing = null;
        // }

        const shippingBase = location.shippingAddress ?? null;

        const shipping = {
          ...shippingBase,
          province: shipbillprovince?.shippingprovince?.province,
        }

        const billingBase = location.billingAddress ?? null;
        const billingadd = {
          ...billingBase,
          province: shipbillprovince?.billingprovince?.province,
        }

        const billing = location.billingSameAsShipping ? shipping : billingadd;

        await prisma.company.create({
          data: {
            customerId: customercollection.id,
            companyGid: createdCompany.id,
            name: createdCompany.name || input.company?.name || "-",
            externalId: createdCompany.externalId ?? input.company?.externalId ?? undefined,
            billing: billing ?? {},                  // Prisma Json type expects a JS object or null depending on your model
            shipping: shipping ?? null,
            contactInfoFirstName: contactInfo.contactinfo?.contactfname || "-",
            contactInfoLastName: contactInfo.contactinfo?.contactlname || "-",
            contactInfoJob: contactInfo.contactinfo?.jobtitle || "-",
            companyStatus: "autoApprove",
            shopId: shopId,
            aurthorizedStatus:true
          },
        });
      } catch (dbErr) {
        console.error("Error saving company to local DB:", dbErr);
      }

      if (!staticcompanyid) {
        console.warn("No customerGid found in token payload; skipping assign-as-contact.");
        return Response.json({
          success: true,
          message: "Company created",
          company: createdCompany,
          warnings: topLevelErrors.length ? topLevelErrors : undefined,
          userErrors: userErrors.length ? userErrors : undefined,
        }, { headers: CORS });
      }
      const companyGid = createdCompany.id;

      // 2) Assign customer as company contact

      const assignContactVars = { companyId: companyGid, customerId: staticcompanyid };
      const resp1 = await graphQLRequest(ctx, assignContactMutation, assignContactVars);

      const assignPayload = resp1?.companyAssignCustomerAsContact;
      const assignUserErrors = assignPayload?.userErrors ?? [];
      if (assignUserErrors.length) {
        console.warn("User errors assigning contact:", assignUserErrors);
        // return success for creation but surface the userErrors
        return Response.json({
          success: true,
          message: "Company created, but assigning customer as contact returned userErrors",
          company: createdCompany,
          assignUserErrors,
        }, { headers: CORS });
      }

      const companyContact = assignPayload?.companyContact;
      const companyContactId = companyContact?.id;

      // 3) Assign the contact as main contact

      const assignMainVars = { companyId: companyGid, companyContactId };
      const resp2 = await graphQLRequest(ctx, assignMainMutation, assignMainVars);
      const assignMainPayload = resp2?.companyAssignMainContact;
      const assignMainUserErrors = assignMainPayload?.userErrors ?? [];

      if (assignMainUserErrors.length) {
        console.warn("User errors assigning main contact:", assignMainUserErrors);
        return Response.json({
          success: true,
          message: "Company created; assigned contact but failed to set as main contact",
          company: createdCompany,
          assignMainUserErrors,
        }, { headers: CORS });
      }
      // Success: company created + contact assigned + main contact assigned
      return Response.json({
        success: true,
        message: "Company created and customer assigned as main contact",
        company: createdCompany,
        companyContact,
        mainContactResult: assignMainPayload.company,
      }, { headers: CORS });
    }

    // Otherwise, if we have userErrors or top-level errors, return a helpful error
    const errorMessage =
      userErrors?.[0]?.message ||
      topLevelErrors?.[0]?.message ||
      "Company creation failed";

    return Response.json({ success: false, message: errorMessage, raw: data }, { status: 400, headers: CORS });

  } catch (err) {
    //console.log("Error creating company:", err);
    return Response.json({ success: false, message: "Server error" }, { status: 500, headers: CORS });
  }
};