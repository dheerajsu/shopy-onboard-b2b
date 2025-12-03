import prisma from "../db.server";

export const loader = async ({ request }) => {

  const url = new URL(request.url);
  const shopId = url.searchParams.get("shopId");
  if (!shopId) {
    return new Response(JSON.stringify({ error: "Missing shopId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Read header
  const apiKey = (request.headers.get("x-api-key") || "").trim();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing x-api-key header" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  // Look up session by shop to get shop-specific API key.
  // Using findFirst to be tolerant about the exact field name for the shop column.
  const session = await prisma.session.findFirst({ where: { shop: shopId } });
  if (!session) {
    return new Response(JSON.stringify({ error: "Session for shop not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const shopApiKey = session.appapikey || "";
  //console.log("what is shopapikey",shopApiKey);

  // Allow either the shop-specific key or a global master key in env (backwards compatibility)
  if (!(apiKey === shopApiKey)) {
    return new Response(JSON.stringify({ error: "API key not found" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch settings for shop
  const setting = await prisma.setting.findUnique({ where: { shopId } });
  if (!setting) {
    return new Response(JSON.stringify({ error: "Shop not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ autoApproval: Boolean(setting.autoApproval) }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
