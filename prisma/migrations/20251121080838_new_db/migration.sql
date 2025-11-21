-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `shop` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `isOnline` BOOLEAN NOT NULL DEFAULT false,
    `scope` VARCHAR(191) NULL,
    `expires` DATETIME(3) NULL,
    `accessToken` VARCHAR(191) NOT NULL,
    `userId` BIGINT NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `accountOwner` BOOLEAN NOT NULL DEFAULT false,
    `locale` VARCHAR(191) NULL,
    `appapikey` VARCHAR(191) NULL,
    `collaborator` BOOLEAN NULL DEFAULT false,
    `emailVerified` BOOLEAN NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Companycontact` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` VARCHAR(191) NULL,
    `baseCustomerId` VARCHAR(191) NOT NULL,
    `customername` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `companystatus` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Companycontact_baseCustomerId_key`(`baseCustomerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Company` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` VARCHAR(191) NULL,
    `customerId` INTEGER NULL,
    `customerFirstName` VARCHAR(191) NULL,
    `customerLastName` VARCHAR(191) NULL,
    `customerEmail` VARCHAR(191) NULL,
    `customerPhone` VARCHAR(191) NULL,
    `aurthorizedStatus` BOOLEAN NULL DEFAULT false,
    `companyGid` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `externalId` VARCHAR(191) NULL,
    `billing` JSON NULL,
    `shipping` JSON NULL,
    `taxId` VARCHAR(191) NULL,
    `contactInfoFirstName` VARCHAR(191) NULL,
    `contactInfoLastName` VARCHAR(191) NULL,
    `contactInfoJob` VARCHAR(191) NULL,
    `billingshippingsame` BOOLEAN NULL DEFAULT false,
    `companyStatus` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Company_companyGid_key`(`companyGid`),
    UNIQUE INDEX `Company_customerEmail_shopId_key`(`customerEmail`, `shopId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Location` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` VARCHAR(191) NULL,
    `companyId` INTEGER NOT NULL,
    `locationGid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `billing` JSON NOT NULL,
    `shipping` JSON NULL,
    `isShipping` BOOLEAN NOT NULL DEFAULT false,
    `isBilling` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Location_locationGid_key`(`locationGid`),
    INDEX `Location_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompanyMember` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` VARCHAR(191) NULL,
    `locationId` INTEGER NOT NULL,
    `memberContactId` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `companyContactRoleId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CompanyMember_locationId_idx`(`locationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` VARCHAR(191) NULL,
    `autoApproval` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Setting_shopId_key`(`shopId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Company` ADD CONSTRAINT `Company_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Companycontact`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Location` ADD CONSTRAINT `Location_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyMember` ADD CONSTRAINT `CompanyMember_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
