import { getShopifyAdminContext, graphQLRequest } from "./admin/utils";
import { getCustomerCompanyId } from "./admin/companyAdmin";
import { companyLocationCreatemutation, companyContactRole, companyContactAssignRole, shopid } from "./query";
import prisma from "../db.server"

const CORS = {
  "Access-Control-Allow-Origin": "*", // or a specific origin
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

function decodeJwt(token) {
  const payload = token.split(".")[1];
  const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
  return decoded;
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: CORS });
}

export const loader = async ({ request }) => {
  return jsonResponse({ ok: true });
};

export const action = async ({ request }) => {

  // Always answer preflight BEFORE any auth checks
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: CORS });
  }
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: CORS });
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({ success: false, message: "Invalid JSON body" }, 400);
  }

  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const decoded = decodeJwt(authHeader);
  const CurrentCustomerid = decoded.sub;

  //Get token and shop domain
  const ctx = await getShopifyAdminContext(request);

  if (ctx.error) return ctx.error; // exit early if auth failed

  const { customerContactId, companyId } = await getCustomerCompanyId(ctx, CurrentCustomerid);


  const input = body.input ?? body.payload?.input ?? body.payload ?? {};

  if (!companyId) {
    return jsonResponse({ success: false, message: "Missing companyId" }, 400);
  }


  function normalize(obj) {
    if (!obj || typeof obj !== "object") return obj;
    for (const k of Object.keys(obj)) {
      if (obj[k] === "") obj[k] = undefined;
      else if (typeof obj[k] === "object") normalize(obj[k]);
    }
    return obj;
  }
  normalize(input);

  const variables = { companyId, input };


  try {
    const resp = await graphQLRequest(ctx, companyLocationCreatemutation, variables);
    
    //console.log("response is",resp);

    if (!resp.companyLocationCreate) {
      //console.log("not fonnd location");
      return jsonResponse({ success: false, message: "No payload from companyContactCreate" }, 500);
    }
    if (resp.companyLocationCreate.userErrors?.length) {
      //console.log("error found");
      const errorMessage = resp.companyLocationCreate.userErrors.map(e => e.message).join(", ");
      return jsonResponse({ success: false, message: errorMessage });
      
    }
    //console.log("out of error");

    const payload = resp?.companyLocationCreate;
    const companyLocationId = payload?.companyLocation?.id;

    // 2) Fetch company contactRoles so we can pick an appropriate role id
    const rolesData = await graphQLRequest(ctx, companyContactRole, { companyId });
    //const roles = rolesData?.node?.contactRoles?.edges?.map(e => e.node) ?? [];
    const edges = rolesData?.node?.contactRoles?.edges ?? [];
    const locationAdmin = edges.find(edge => edge?.node?.name === "Location admin");

    const locationAdminId = locationAdmin?.node?.id ?? "";

    const Rolevariables = {
      companyContactId: customerContactId,
      companyContactRoleId: locationAdminId,
      companyLocationId: companyLocationId
    };
    const mainRoleResp = await graphQLRequest(ctx, companyContactAssignRole, Rolevariables);
    const userErrors = mainRoleResp?.companyContactAssignRole?.userErrors ?? [];
    if (userErrors.length > 0) {
      const errorMessage = userErrors[0]?.message || "Unknown error occurred.";
      return jsonResponse({ success: false, message: errorMessage, userErrors: errorMessage }, 400);
    } else {
      // Optional: save location to your local DB with Prisma
        const location = input;
        const shipping = location.shippingAddress;
        let billing = null;
        if (location.billingSameAsShipping) {
          billing = shipping;
        } else if (location.billingAddress) {
          billing = location.billingAddress;
        } else {
          billing = null;
        }
        
        const getshopit = await graphQLRequest(ctx, shopid);
        const shopidis = getshopit.shop.myshopifyDomain;
        //console.log("shop id is",shopidis);
        let companycollection = await prisma.company.findUnique({
          where: { companyGid: companyId}
        });

        //const companyintid = parseGid(companyId);
        //console.log("final company id is", companycollection);

        const createdLocation = await prisma.location.create({
          data: {
            companyId: companycollection.id,
            locationGid: companyLocationId,
            name: input.name,
            billing: billing ?? {},                  // Prisma Json type expects a JS object or null depending on your model
            shipping: shipping ?? null,
            isShipping: input.isShipping ?? false,
            isBilling: input.isBilling ?? false,
            isActive: true,
            shopId: shopidis
          },
        });
        //console.log("created-location_date",createdLocation);
        //console.log("member contact id is",customerContactId);
        //Add main customer in CompanyMember table
        await prisma.companyMember.create({
          data: {
            locationId: createdLocation.id,
            memberContactId: customerContactId,
            firstName: undefined,
            lastName: undefined,
            title: "",
            email: "",
            companyContactRoleId: "",
            shopId: shopidis
          },
        });

        //console.log("location db is created", localLocation);
      return jsonResponse({ success: true, companyLocation: payload.companyLocation });
    }
  }
  catch (err) {
    //console.log("Error creating company:", err);
    return Response.json({ success: false, message: "Server error" }, { status: 500, headers: CORS });
  }
};