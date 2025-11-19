import { getShopifyAdminContext, graphQLRequest } from "./admin/utils";
import { getLocationOfCustomer } from "./query"; // ensure this is your CustomerContactLocations query

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: CORS });

function buildNameWildcardQuery(q) {
  if (!q) return undefined;
  const raw = String(q || "").trim();
  if (!raw) return undefined;
  const collapsed = raw.replace(/\s+/g, " ");
  const sanitized = collapsed.replace(/[^A-Za-z0-9 _-]/g, "");
  const tokens = sanitized.split(" ").filter(Boolean);
  if (tokens.length === 0) return undefined;
  return `name:*${tokens.join("*")}*`;
}

// tokens-based matching: requires tokens to appear in order in the location name
function tokensMatchInOrder(nameRaw, qRaw) {
  if (!qRaw) return true;
  const name = (nameRaw || "").toLowerCase();
  const clean = String(qRaw || "").trim().replace(/\s+/g, " ").replace(/[^A-Za-z0-9 _-]/g, "");
  const tokens = clean.split(" ").filter(Boolean).map(t => t.toLowerCase());
  if (tokens.length === 0) return true;
  let idx = 0;
  for (const token of tokens) {
    const found = name.indexOf(token, idx);
    if (found === -1) return false;
    idx = found + token.length;
  }
  return true;
}

export const loader = async ({ request }) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS });
  if (request.method !== "GET") return new Response(null, { status: 405, headers: CORS });

  const ctx = await getShopifyAdminContext(request);
  if (ctx.error) return ctx.error;

  const url = new URL(request.url);
  const qRaw = url.searchParams.get("q") || null;

  // decode session token to get customer id
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  const token = auth ? auth.replace(/^Bearer\s+/i, "") : null;
  if (!token) return json({ success: false, message: "Missing session token" }, 401);
  const payloadPart = token.split(".")[1];
  const payload = payloadPart ? JSON.parse(Buffer.from(payloadPart, "base64").toString("utf8")) : null;
  const customerGid = payload?.sub ?? payload?.customerId ?? null;
  if (!customerGid) return json({ success: false, message: "No customer id in session token" }, 401);

  try {
    // Step 1: try Shopify query first (smallish page)
    const firstTry = qRaw ? 50 : 10;
    const shopifyQuery = buildNameWildcardQuery(qRaw); // name:*token1*token2*
    const variables = { customerId: customerGid, first: firstTry, query: shopifyQuery ?? undefined };

    // DEBUG: remove/comment out in production if you want
    //console.log("Proxy DEBUG - calling Shopify with variables:", variables);

    const companydata = await graphQLRequest(ctx, getLocationOfCustomer, variables);
    // DEBUG raw response
    //console.log("Proxy DEBUG - raw companydata:", JSON.stringify(companydata?.customer?.companyContactProfiles?.length ?? "no-data"));

    // Flatten roleAssignments -> companyLocation across all profiles
    const profiles = companydata?.customer?.companyContactProfiles ?? [];

    //console.log("company found or not",profiles);

    if (!profiles.length) {
      return json({ success: false, message: "company not found" }, 200);
      //return { success: false, message: "company not found" };
    }

    let allRoleLocations = [];
    profiles.forEach(profile => {
      const nodes = profile?.roleAssignments?.nodes ?? [];
      nodes.forEach(node => {
        if (node?.companyLocation) allRoleLocations.push(node.companyLocation);
      });
    });

    // Server-side token filtering of the returned set (ensures only true matches)
    let matched = allRoleLocations.filter(loc => tokensMatchInOrder(loc?.name ?? "", qRaw));

    // If user searched (qRaw) but no matches found in the small result set,
    // do a fallback fetch (bigger `first`) without relying on Shopify query,
    // then apply the same token filter locally.
    if (qRaw && matched.length === 0) {
      //console.log("Proxy DEBUG - no matches in first fetch, performing fallback larger fetch");
      const fallbackFirst = 250; // tune as needed
      const fallbackVars = { customerId: customerGid, first: fallbackFirst, query: undefined };
      const fallbackData = await graphQLRequest(ctx, getLocationOfCustomer, fallbackVars);

      // flatten fallback result
      const fallbackProfiles = fallbackData?.customer?.companyContactProfiles ?? [];
      let fallbackAll = [];
      fallbackProfiles.forEach(profile => {
        const nodes = profile?.roleAssignments?.nodes ?? [];
        nodes.forEach(node => {
          if (node?.companyLocation) fallbackAll.push(node.companyLocation);
        });
      });

      // apply token filter on fallbackAll
      matched = fallbackAll.filter(loc => tokensMatchInOrder(loc?.name ?? "", qRaw));
      //console.log("Proxy DEBUG - fallback matched count:", matched.length);
    }

    // If no search, just use deduped allRoleLocations (still dedupe)
    const resultList = qRaw ? matched : allRoleLocations;

    // Dedupe by id preserve order
    const dedupe = new Map();
    resultList.forEach(item => {
      if (item && item.id) dedupe.set(item.id, item);
    });
    const locationdata = Array.from(dedupe.values());

    // Choose company object to return (first profile.company)
    const companyRole = profiles[0]?.company ?? null;

    return json({
      success: true,
      company: companyRole ? { id: companyRole.id, name: companyRole.name } : null,
      locations: locationdata,
    });
  } catch (err) {
    console.error("Proxy error:", err);
    return json({ success: false, message: "Server error fetching locations", error: String(err) }, 500);
  }
};
