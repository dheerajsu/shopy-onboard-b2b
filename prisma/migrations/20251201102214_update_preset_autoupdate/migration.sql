-- AlterTable
ALTER TABLE `Preset` ADD COLUMN `allowOneTimeShipAddress` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `checkoutOrderDraft` BOOLEAN NOT NULL DEFAULT true;
