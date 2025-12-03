import prisma from "./db.server";

export async function ensureDefaultPreset(shopId) {
  try {
    const existing = await prisma.preset.findFirst({
      where: { shopId, isDefault: true },
    });

    if (existing) return existing;

    return await prisma.preset.create({
      data: {
        shopId,
        isDefault: true,
        presetTitle: "Default preset",
        paymentTerms: {"gid":"gid://shopify/PaymentTermsTemplate/2","name":"Net 7"},             // or some default term
        checkoutOrderDraft: true,       // or false, your choice
        taxes: "true",                  // "Collect"
        contactRole: "location-admin",
        communication: "",
        requireDeposit: null,
        allowOneTimeShipAddress: true,
    },
    });
  } catch (error) {
    console.error("Failed to ensure default preset", { shopId, error });

    // Table does not exist / wrong schema
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    ) {
      // You can choose how to handle this – here we just return null
      return null;
    }

    // Re-throw other unexpected errors so the loader can decide
    throw error;
  }
}
