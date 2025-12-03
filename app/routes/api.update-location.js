import { getShopifyAdminContext,graphQLRequest } from "./admin/utils";
import {companyLocationUpdate, companyLocationAssignAddressExample, companyLocationAssignAddressShipping, companyLocationAssignAddressBilling} from "./query";
import prisma from "../db.server"

const CORS = {
  "Access-Control-Allow-Origin": "*", // or a specific origin
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};


function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: CORS });
}

export const loader = async ({ request }) => {
    return jsonResponse({ ok: true });
  //return Response.json({ ok: true }, { headers: CORS });
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
  
  

  //Get token and shop domain
    const ctx = await getShopifyAdminContext(request);
    if (ctx.error) return ctx.error; // exit early if auth failed

  //const input = body.input ?? body.payload?.input ?? body.payload ?? {};
  const payload = body.payload ?? {};
  //console.log("payload is",payload);
  
  const { maincompanyLocationId, locationName } = payload;
  const buyerlocationis = payload.input.buyerExperienceConfiguration;
  const billingShippingSame = payload.input.billingSameAsShipping;

  const shippingAddress = payload.input?.shippingAddress ?? null;
  const billingAddress = payload.input?.billingAddress ?? null;



  try {
    const assignResults = [];

    const createVars = {
        companyLocationId: maincompanyLocationId,
        input : {
            name: locationName,
            buyerExperienceConfiguration: buyerlocationis
        }
    }
    const resp = await graphQLRequest(ctx, companyLocationUpdate, createVars);
    
    if (!resp.companyLocationUpdate) {
      return jsonResponse({ success: false, message: "No payload from companyContactUpdate" }, 500);
    }
    if (resp.companyLocationUpdate.userErrors?.length){
      const errorMessage = resp.companyLocationUpdate.userErrors.map(e => e.message).join(", "); 
      return jsonResponse({ success: false, message: errorMessage });
    }

    assignResults.push({ companyName: resp.companyLocationUpdate.companyLocation.name });
    
    if(billingShippingSame === true){
        // billing ans shipping same
        const Billshippingvars = {
            locationId: maincompanyLocationId,
            address : shippingAddress
        }

        const resp = await graphQLRequest(ctx, companyLocationAssignAddressExample, Billshippingvars);
        const payloadresp = resp?.companyLocationAssignAddress;
        assignResults.push({ type: "BothSame", payload: payloadresp });
        if (payloadresp.userErrors?.length) {
          const errorMessage = payloadresp.userErrors.map(e => e.message).join(", "); 
          return jsonResponse({
            success: false,
            step: "assignAddress",
            message: errorMessage,
            userErrors: payloadresp.userErrors,
            assignResults,
          });
        }

    }else{
        // billing ans shipping both different
        const shippingVars = {
            locationId: maincompanyLocationId,
            address : shippingAddress
        }
        const billVars = {
            locationId: maincompanyLocationId,
            address : billingAddress
        }
        const shipresp = await graphQLRequest(ctx, companyLocationAssignAddressShipping, shippingVars);
        const billresp = await graphQLRequest(ctx, companyLocationAssignAddressBilling, billVars);

        const payloadresp = billresp?.companyLocationAssignAddress;
        assignResults.push({ type: "BillShip", payload: payloadresp });
        if (payloadresp.userErrors?.length) {
          return jsonResponse({
            success: false,
            step: "assignAddress",
            message: "Shipping Billing address assign returned errors",
            userErrors: payloadresp.userErrors,
            assignResults,
          });
        }
    }

    const updatelocation = await prisma.location.update({
      where: { locationGid: maincompanyLocationId },  // unique identifier
      data: {
        name: locationName,
        billing: billingAddress ?? {},                  // Prisma Json type expects a JS object or null depending on your model
        shipping: shippingAddress ?? null,
        isShipping: billingShippingSame ?? false,
        isBilling: billingShippingSame ?? false,
        isActive: true,
      },
    });
    
    return jsonResponse({ success: true, assignResults }, 200);
    //return jsonResponse({ success: true, companyLocation: payload.companyLocation });
  }
  catch (err) {
    //console.log("Error creating company:", err);
    return Response.json({ success: false, message: "Server error" }, { status: 500, headers: CORS });
  }
};