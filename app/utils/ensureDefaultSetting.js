import prisma from "../db.server";

export async function ensureDefaultSetting(shopId) {
  await prisma.setting.upsert({
    where: { shopId },
    update: {}, // don't change existing values
    create: {
      shopId,
      autoApproval: false,
      // add other defaults here
    },
  });
}
