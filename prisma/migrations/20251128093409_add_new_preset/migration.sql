-- CreateTable
CREATE TABLE `Preset` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` VARCHAR(191) NULL,
    `presetTitle` VARCHAR(191) NULL,
    `paymentTerms` VARCHAR(191) NULL,
    `requireDeposit` VARCHAR(191) NULL,
    `checkoutOrderDraft` BOOLEAN NOT NULL DEFAULT false,
    `taxes` VARCHAR(191) NULL,
    `contactRole` VARCHAR(191) NULL,
    `communication` VARCHAR(191) NULL,
    
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
