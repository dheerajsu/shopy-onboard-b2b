/*
  Warnings:

  - You are about to alter the column `paymentTerms` on the `preset` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.

*/
-- AlterTable
ALTER TABLE `Preset` MODIFY `paymentTerms` JSON NULL;
