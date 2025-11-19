import { PrismaClient } from "@prisma/client";
let prisma;
if (!globalThis.prisma) globalThis.prisma = new PrismaClient();
prisma = globalThis.prisma;

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
