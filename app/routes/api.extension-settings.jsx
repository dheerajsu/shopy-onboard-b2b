import { PrismaClient } from "@prisma/client";

let prisma;
if (!globalThis.prisma) {
  globalThis.prisma = new PrismaClient();
}
prisma = globalThis.prisma;

function validApiKey(request) {
  const key = request.headers.get("x-api-key") || "";
  return key && key === (process.env.FLUTTER_API_KEY || "");
}

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shopId = url.searchParams.get("shopId");
  if (!shopId) {
    return new Response(JSON.stringify({ error: "Missing shopId" }), { status: 400, headers: { "Content-Type": "application/json" }});
  }

  // AUTH: fallback API-key only (for Postman/Flutter). Replace/augment later with Shopify session validation.
  if (!validApiKey(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" }});
  }

  const setting = await prisma.setting.findUnique({ where: { shopId } });
  if (!setting) {
    return new Response(JSON.stringify({ error: "Shop not found" }), { status: 404, headers: { "Content-Type": "application/json" }});
  }

  return new Response(JSON.stringify({ autoApproval: Boolean(setting.autoApproval) }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
