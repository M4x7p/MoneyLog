-- MoneyLog Database Schema
-- SQLite Version (Cloudflare D1 Compatible)
-- Generated from Prisma Schema

-- =========================================
-- Table: User
-- =========================================
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    "email" TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lineUserId" TEXT UNIQUE,
    "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
    "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =========================================
-- Table: Family
-- =========================================
CREATE TABLE IF NOT EXISTS "Family" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    "name" TEXT NOT NULL,
    "inviteCode" TEXT UNIQUE,
    "inviteExpiresAt" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
    "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =========================================
-- Table: Membership (User <-> Family join table)
-- =========================================
CREATE TABLE IF NOT EXISTS "Membership" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE("userId", "familyId"),
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Membership_userId_idx" ON "Membership"("userId");
CREATE INDEX IF NOT EXISTS "Membership_familyId_idx" ON "Membership"("familyId");

-- =========================================
-- Table: Category
-- =========================================
CREATE TABLE IF NOT EXISTS "Category" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '📦',
    "active" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE("familyId", "name"),
    FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Category_familyId_idx" ON "Category"("familyId");

-- =========================================
-- Table: ImportBatch
-- =========================================
CREATE TABLE IF NOT EXISTS "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
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
    "importedAt" TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE,
    FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT,
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "ImportBatch_familyId_idx" ON "ImportBatch"("familyId");
CREATE INDEX IF NOT EXISTS "ImportBatch_familyId_statementMonth_idx" ON "ImportBatch"("familyId", "statementMonth");
CREATE INDEX IF NOT EXISTS "ImportBatch_fileHash_idx" ON "ImportBatch"("fileHash");

-- =========================================
-- Table: ExpenseTransaction
-- =========================================
CREATE TABLE IF NOT EXISTS "ExpenseTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    "familyId" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "dateTime" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "itemType" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "descriptionRaw" TEXT NOT NULL,
    "categoryId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE("familyId", "fingerprint"),
    FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE,
    FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE,
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT,
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "ExpenseTransaction_familyId_idx" ON "ExpenseTransaction"("familyId");
CREATE INDEX IF NOT EXISTS "ExpenseTransaction_familyId_dateTime_idx" ON "ExpenseTransaction"("familyId", "dateTime");
CREATE INDEX IF NOT EXISTS "ExpenseTransaction_familyId_categoryId_idx" ON "ExpenseTransaction"("familyId", "categoryId");
CREATE INDEX IF NOT EXISTS "ExpenseTransaction_ownerUserId_idx" ON "ExpenseTransaction"("ownerUserId");
CREATE INDEX IF NOT EXISTS "ExpenseTransaction_importBatchId_idx" ON "ExpenseTransaction"("importBatchId");

-- =========================================
-- Table: CategoryRule
-- =========================================
CREATE TABLE IF NOT EXISTS "CategoryRule" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    "familyId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "matchType" TEXT NOT NULL DEFAULT 'CONTAINS',
    "channel" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 10,
    "enabled" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
    "updatedAt" TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE,
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "CategoryRule_familyId_idx" ON "CategoryRule"("familyId");
CREATE INDEX IF NOT EXISTS "CategoryRule_categoryId_idx" ON "CategoryRule"("categoryId");

-- =========================================
-- Success!
-- =========================================
-- Database schema for Cloudflare D1 created successfully!
-- Tables: User, Family, Membership, Category, ImportBatch, ExpenseTransaction, CategoryRule
