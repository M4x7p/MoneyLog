-- MoneyLog Database Schema
-- PostgreSQL Version
-- Generated from Prisma Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================
-- Table: User
-- =========================================
CREATE TABLE "User" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lineUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Unique index for User.email
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Unique index for User.lineUserId
CREATE UNIQUE INDEX "User_lineUserId_key" ON "User"("lineUserId");

-- =========================================
-- Table: Family
-- =========================================
CREATE TABLE "Family" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- Unique index for Family.inviteCode
CREATE UNIQUE INDEX "Family_inviteCode_key" ON "Family"("inviteCode");

-- =========================================
-- Table: Membership (User <-> Family join table)
-- =========================================
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- Unique constraint for userId + familyId
CREATE UNIQUE INDEX "Membership_userId_familyId_key" ON "Membership"("userId", "familyId");

-- Index for faster lookups
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");
CREATE INDEX "Membership_familyId_idx" ON "Membership"("familyId");

-- =========================================
-- Table: Category
-- =========================================
CREATE TABLE "Category" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '📦',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- Unique constraint for familyId + name
CREATE UNIQUE INDEX "Category_familyId_name_key" ON "Category"("familyId", "name");

-- Index for faster lookups
CREATE INDEX "Category_familyId_idx" ON "Category"("familyId");

-- =========================================
-- Table: ImportBatch
-- =========================================
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "familyId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "sourceBank" TEXT NOT NULL DEFAULT 'KBank',
    "statementMonth" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "totalRowsFound" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedDuplicateCount" INTEGER NOT NULL DEFAULT 0,
    "uncategorizedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- Indexes for ImportBatch
CREATE INDEX "ImportBatch_familyId_idx" ON "ImportBatch"("familyId");
CREATE INDEX "ImportBatch_familyId_statementMonth_idx" ON "ImportBatch"("familyId", "statementMonth");
CREATE INDEX "ImportBatch_fileHash_idx" ON "ImportBatch"("fileHash");

-- =========================================
-- Table: ExpenseTransaction
-- =========================================
CREATE TABLE "ExpenseTransaction" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "familyId" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "dateTime" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "itemType" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "descriptionRaw" TEXT NOT NULL,
    "categoryId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseTransaction_pkey" PRIMARY KEY ("id")
);

-- Unique constraint for fingerprint within family
CREATE UNIQUE INDEX "ExpenseTransaction_familyId_fingerprint_key" ON "ExpenseTransaction"("familyId", "fingerprint");

-- Indexes for ExpenseTransaction
CREATE INDEX "ExpenseTransaction_familyId_idx" ON "ExpenseTransaction"("familyId");
CREATE INDEX "ExpenseTransaction_familyId_dateTime_idx" ON "ExpenseTransaction"("familyId", "dateTime");
CREATE INDEX "ExpenseTransaction_familyId_categoryId_idx" ON "ExpenseTransaction"("familyId", "categoryId");
CREATE INDEX "ExpenseTransaction_ownerUserId_idx" ON "ExpenseTransaction"("ownerUserId");
CREATE INDEX "ExpenseTransaction_importBatchId_idx" ON "ExpenseTransaction"("importBatchId");

-- =========================================
-- Table: CategoryRule
-- =========================================
CREATE TABLE "CategoryRule" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "familyId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "matchType" TEXT NOT NULL DEFAULT 'CONTAINS',
    "channel" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 10,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryRule_pkey" PRIMARY KEY ("id")
);

-- Indexes for CategoryRule
CREATE INDEX "CategoryRule_familyId_idx" ON "CategoryRule"("familyId");
CREATE INDEX "CategoryRule_categoryId_idx" ON "CategoryRule"("categoryId");

-- =========================================
-- Foreign Key Constraints
-- =========================================

-- Membership foreign keys
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_familyId_fkey" 
    FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Category foreign keys
ALTER TABLE "Category" ADD CONSTRAINT "Category_familyId_fkey" 
    FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ImportBatch foreign keys
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_familyId_fkey" 
    FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_uploadedByUserId_fkey" 
    FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_ownerUserId_fkey" 
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ExpenseTransaction foreign keys
ALTER TABLE "ExpenseTransaction" ADD CONSTRAINT "ExpenseTransaction_familyId_fkey" 
    FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExpenseTransaction" ADD CONSTRAINT "ExpenseTransaction_importBatchId_fkey" 
    FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExpenseTransaction" ADD CONSTRAINT "ExpenseTransaction_ownerUserId_fkey" 
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExpenseTransaction" ADD CONSTRAINT "ExpenseTransaction_categoryId_fkey" 
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CategoryRule foreign keys
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_familyId_fkey" 
    FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_categoryId_fkey" 
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =========================================
-- Success message
-- =========================================
-- Database schema created successfully!
-- Tables: User, Family, Membership, Category, ImportBatch, ExpenseTransaction, CategoryRule
