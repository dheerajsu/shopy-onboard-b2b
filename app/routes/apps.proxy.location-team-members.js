import { getShopifyAdminContext, graphQLRequest } from "./admin/utils";
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: CORS });

const QUERY = `
  query LocationCustomers($locationId: ID!, $first: Int!, $after: String) {
    companyLocation(id: $locationId) {
      id
      name
      roleAssignments(first: $first, after: $after) {
        edges {
          node {
            id
            role {
              id
              name
            }
            companyContact {
              id
              isMainContact
              title
              customer {
                id
                legacyResourceId
                displayName
              }
            }
          }
        }
        pageInfo { endCursor hasNextPage hasPreviousPage startCursor }
      }
        billingAddress {
          address1
          address2
          firstName
          lastName
          phone
          countryCode
          country
          city
          zoneCode
          zip
        }
        shippingAddress {
          firstName
          lastName
          address1
          address2
          city
          countryCode
          country
          phone
          zip
          zoneCode
        }
    }
  }
`;

export const loader = async ({ request }) => {
  // CORS preflight
  if (request.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS });
  if (request.method !== "GET") return new Response(null, { status: 405, headers: CORS });

  // 1) verify token & get admin context (shopDomain + accessToken)
  const ctx = await getShopifyAdminContext(request);
  if (ctx.error) return ctx.error;

  // 2) parse query params
  const url = new URL(request.url);
  const locationId = url.searchParams.get("locationId");
  if (!locationId) return json({ success: false, message: "Missing required query param: locationId" }, 400);

  const firstParam = url.searchParams.get("first");
  
  const after = url.searchParams.get("after") || null;
  
  const first = firstParam ? parseInt(firstParam, 10) : 5;


  // 3) decode session token payload to identify current customer (for isYou flag)
  let currentCustomerGid = null;
  try {
    const auth = request.headers.get("authorization") || request.headers.get("Authorization");
    const token = auth ? auth.replace(/^Bearer\s+/i, "") : null;
    if (token) {
      const payloadPart = token.split(".")[1];
      if (payloadPart) {
        const payload = JSON.parse(Buffer.from(payloadPart, "base64").toString("utf8"));
        currentCustomerGid = payload?.sub ?? payload?.customerId ?? null;
      }
    }
  } catch (e) {
    // non-fatal; just won't mark isYou
    console.warn("Failed to decode session token payload for isYou:", e?.message ?? e);
  }

  try {
    // 4) Call Shopify Admin GraphQL with the user's locationId
    const data = await graphQLRequest(ctx, QUERY, { locationId, first, after });

    const cl = data?.companyLocation;
    if (!cl) {
      return json({ success: true, location: null, members: [], pageInfo: null });
    }

    const rawEdges = cl.roleAssignments?.edges ?? [];
    const pageInfo = cl.roleAssignments?.pageInfo ?? null;
    const billingaddress = cl.billingAddress;
    const shippingaddress = cl.shippingAddress;

    let companycollection = await prisma.location.findUnique({
      where: { locationGid: locationId}
    });

    const isshippingBillingSame = companycollection.isShipping;
    //console.log("billShip value",isshippingBillingSame);

    // map nodes to simple member objects
    const members = rawEdges.map((edge) => {
      const node = edge?.node ?? {};
      const role = node.role ?? {};
      const contact = node.companyContact ?? {};
      const customer = contact.customer ?? {};

      return {
        // role-assignment id (unique per assignment)
        roleAssignmentId: node.id || null,
        roleId: role.id || null,
        roleName: role.name || null,

        // contact / member
        contactId: contact.id || null,
        isMainContact: Boolean(contact.isMainContact),
        title: contact.title || null,

        // customer info
        customerId: customer.id || null,
        legacyResourceId: customer.legacyResourceId ?? null,
        displayName: customer.displayName ?? null,
        defaultAddress: customer.defaultAddress ?? null,

        // convenience: flag whether this is the currently-signed-in customer
        isYou: Boolean(customer.id && currentCustomerGid && customer.id === currentCustomerGid),
      };
    });

    return json({
      success: true,
      location: { id: cl.id, name: cl.name },
      members,
      pageInfo,
      billingaddress,
      shippingaddress,
      isshippingBillingSame

    });
  } catch (err) {
    console.error("Error in location-team-members loader:", err);
    return json({ success: false, message: "Server error fetching members", error: String(err) }, 500);
  }
};