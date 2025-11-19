import { getShopifyAdminContext,graphQLRequest } from "./admin/utils"; 
import { PrismaClient } from '@prisma/client';
import {createCompanyMutation , companyContactRole, companyContactAssignRole, shopid} from './query';
export const prisma = new PrismaClient();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};
const jsonResponse = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: CORS });

export const loader = ({ request }) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS });
  return new Response(null, { status: 405, headers: CORS });
};

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS });
  if (request.method !== "POST") return new Response(null, { status: 405, headers: CORS });

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ success: false, message: "Invalid JSON" }, 400);
  }

  const payload = body.payload ?? body;
  
  const { companyId, companyLocationId, contact } = payload || {};

  const permissionsRaw = payload?.permissions ?? payload?.permission ?? [];
  const requestedPermissions = Array.isArray(permissionsRaw)
  ? permissionsRaw.map(p => String(p || "").trim()).filter(Boolean)
  : (permissionsRaw ? [String(permissionsRaw).trim()] : []); // ensure an array of strings

  if (!companyId || !contact?.email || !contact?.firstName || !contact?.lastName) {
    return jsonResponse({ success: false, message: "companyId and contact (firstName, lastName, email) required" }, 400);
  }

  // Get admin context (verifies incoming session token & finds stored OAuth access token)
  const ctx = await getShopifyAdminContext(request);
  if (ctx.error) return ctx.error;
  try {
    // 1) Create the company contact (creates or links a customer)
    
    const createVars = {
      companyId,
      input: {
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phone: contact.phone ?? undefined,
        title: contact.title ?? undefined,
      },
    };

    const created = await graphQLRequest(ctx, createCompanyMutation, createVars);
    const createPayload = created.companyContactCreate;
    
    if (!createPayload) {
      return jsonResponse({ success: false, message: "No payload from companyContactCreate" }, 500);
    }
    if (createPayload.userErrors?.length) { 
        const errormessage = createPayload.userErrors || [];
      return jsonResponse({ success: false, message: errormessage.map(e => e.message), userErrors: createPayload.userErrors }, 400);
    }
    const companyContact = createPayload.companyContact;
    if (!companyContact?.id) {
      return jsonResponse({ success: false, message: "companyContact not returned" }, 500);
    }

    // 2) Fetch company contactRoles so we can pick an appropriate role id
    
    const rolesData = await graphQLRequest(ctx, companyContactRole, { companyId });
    const roles = rolesData?.node?.contactRoles?.edges?.map(e => e.node) ?? [];
    

    // pick role id by matching permission label (case-insensitive substring)
    let chosenRoleId = null;

    
    if (requestedPermissions && roles.length) {
      const p = String(requestedPermissions).toLowerCase();
      
      const found = roles.find(r => (r.name || "").toLowerCase().includes(p));
      
      if (found) chosenRoleId = found.id;
    }

    // 3) If we have a role id and a location, assign it
    let assignment = null;
    if (chosenRoleId && companyLocationId) {
      const assignVars = {
        companyContactId: companyContact.id,
        companyContactRoleId: chosenRoleId,
        companyLocationId,
      };

      const assignData = await graphQLRequest(ctx, companyContactAssignRole, assignVars);
      const assignPayload = assignData.companyContactAssignRole;
      if (assignPayload.userErrors?.length) {
        return jsonResponse({ success: false, message: "Role assignment failed", userErrors: assignPayload.userErrors, companyContact }, 400);
      }

      const getshopit = await graphQLRequest(ctx, shopid);
      const shopidis = getshopit.shop.myshopifyDomain;
      // create team member schema
      let locationcollection = await prisma.location.findUnique({
        where: { locationGid: companyLocationId}
      });
      //console.log("prisma keys are--",Object.keys(prisma));

      await prisma.companyMember.create({
        data: {
          locationId: locationcollection.id,
          memberContactId: companyContact.id,
          firstName: contact.firstName,
          lastName: contact.lastName ?? undefined,                  // Prisma Json type expects a JS object or null depending on your model
          title: contact.title ?? undefined,
          email: contact.email,
          companyContactRoleId: chosenRoleId,
          shopId: shopidis
        },
      });

      assignment = assignPayload.companyContactRoleAssignment ?? null;
    }

    return jsonResponse({ success: true, companyContact, assignedRole: assignment }, 200);
  } catch (err) {
    console.error("invite-team-member failed:", err);
    return jsonResponse({ success: false, message: "Server error", error: String(err) }, 500);
  }
};