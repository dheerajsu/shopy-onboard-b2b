import { getShopifyAdminContext,graphQLRequest } from "./admin/utils"; 
import {companyContactUpdate, companyContactRevokeRole, companyContactRole, companyContactAssignRole} from "./query";
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};
const jsonResponse = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: CORS });

export const loader = ({ request }) => {
  if (request.method === "OPTIONS") 
  return new Response(null, { status: 200, headers: CORS });
  //return new Response(null, { status: 405, headers: CORS });
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
  
  const { contactId,title,firstName,lastName, locationid , roleName,roleAssignmentId } = payload || {};

  // Get admin context (verifies incoming session token & finds stored OAuth access token)
  const ctx = await getShopifyAdminContext(request);
  if (ctx.error) return ctx.error;
  try {
    // 1) Create the company contact (creates or links a customer)
    const createMutation = companyContactUpdate;

    const createVars = {
            companyContactId: contactId,
            input : {
                firstName: firstName,
                lastName : lastName,
                title: title
            }
    }

    const created = await graphQLRequest(ctx, createMutation, createVars);
    const createPayload = created.companyContactUpdate;
    
    if (!createPayload) {
      return jsonResponse({ success: false, message: "No payload from companyContactUpdate" }, 500);
    }
    if (createPayload.userErrors?.length) {
      return jsonResponse({ success: false, message: "Failed to update contact", userErrors: createPayload.userErrors }, 400);
    }
    const companyContact = createPayload.companyContact;
    const companyId = createPayload.companyContact.company.id;

    // Revoke assigned role
    const revokeVars = {
        companyContactId: contactId,
        companyContactRoleAssignmentId: roleAssignmentId
        }
    const revokeresp = await graphQLRequest(ctx, companyContactRevokeRole, revokeVars);
    const revokedData = revokeresp.companyContactRevokeRole;
    if (!revokedData) {
      return jsonResponse({ success: false, message: "Roll not Revoked" }, 500);
    }

    
    // 2) Fetch company contactRoles so we can pick an appropriate role id
    const rolesQuery = companyContactRole;
    const rolesData = await graphQLRequest(ctx, rolesQuery, { companyId });
    const roles = rolesData?.node?.contactRoles?.edges?.map(e => e.node) ?? [];
    

    // pick role id by matching permission label (case-insensitive substring)
    let chosenRoleId = null;

    
    if (roleName && roles.length) {
    
      const p = String(roleName).toLowerCase();
      
      const found = roles.find(r => (r.name || "").toLowerCase().includes(p));
      
      if (found) chosenRoleId = found.id;
    }
    
    // 3) If we have a role id and a location, assign it
    let assignment = null;
    let newassignLocationId = null;
    if (chosenRoleId && locationid) {
      const assignMutation = companyContactAssignRole;
      const assignVars = {
        companyContactId: companyContact.id,
        companyContactRoleId: chosenRoleId,
        companyLocationId: locationid,
      };

      const assignData = await graphQLRequest(ctx, assignMutation, assignVars);
      const assignPayload = assignData.companyContactAssignRole;

      if (assignPayload.userErrors?.length) {
        return jsonResponse({ success: false, message: "Role assignment failed", userErrors: assignPayload.userErrors, companyContact }, 400);
      }

      //update contact member prisma
        const companyMemberRecord = await prisma.companyMember.findFirst({
          where: { memberContactId: companyContact.id }
        });

        if (companyMemberRecord) {
          await prisma.companyMember.update({
            where: { id: companyMemberRecord.id },
            data: {
              firstName: firstName,
              lastName: lastName ?? undefined,
              title: title ?? undefined,
              companyContactRoleId: chosenRoleId,
            },
          });
        } else {
          console.error(`CompanyMember not found for contactId: ${companyContact.id}`);
        }

      assignment = assignPayload.companyContactRoleAssignment ?? null;
      newassignLocationId = assignPayload.companyContactRoleAssignment.id ?? null;
    }

    return jsonResponse({ success: true, companyContact, assignedRole: assignment, newassignLocationId }, 200);
  } catch (err) {
    console.error("invite-team-member failed:", err);
    return jsonResponse({ success: false, message: "Server error", error: String(err) }, 500);
  }
};