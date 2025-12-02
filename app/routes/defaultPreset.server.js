import prisma from "../db.server";

export async function ensureDefaultPreset(shopId) {
  const existing = await prisma.preset.findFirst({
    where: { shopId, isDefault: true },
  });

  if (existing) return existing;

  return prisma.preset.create({
    data: {
      shopId,
      isDefault: true,
      presetTitle: "Default preset",
      // sensible defaults:
      paymentTerms: {"gid":"gid://shopify/PaymentTermsTemplate/2","name":"Net 7"},             // or some default term
      checkoutOrderDraft: true,       // or false, your choice
      taxes: "true",                  // "Collect"
      contactRole: "location-admin",
      communication: "",
      requireDeposit: null,
      allowOneTimeShipAddress: true,
    },
  });
}