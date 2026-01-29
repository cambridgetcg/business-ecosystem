-- Phase 1: Foundation
-- 001: Jurisdiction vs Governing Law (Contract model additions)
-- 002: Amendment vs Addendum (ContractModification model)

-- Add Forum Type enum
CREATE TYPE "ForumType" AS ENUM ('PERMISSIVE', 'EXCLUSIVE_FIXED', 'EXCLUSIVE_FLOATING');

-- Add Modification Type enum
CREATE TYPE "ModificationType" AS ENUM (
  'AMENDMENT',
  'ADDENDUM', 
  'SUPPLEMENT',
  'SIDE_LETTER',
  'WAIVER',
  'CONSENT',
  'NOVATION'
);

-- Add Modification Status enum
CREATE TYPE "ModificationStatus" AS ENUM (
  'DRAFT',
  'PENDING_REVIEW',
  'PENDING_SIGNATURE',
  'EXECUTED',
  'REJECTED',
  'SUPERSEDED'
);

-- Add dispute resolution fields to contracts table
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "governingLaw" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "governingLawCountry" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "forumSelection" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "forumSelectionType" "ForumType" DEFAULT 'PERMISSIVE';
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "venueCity" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "venueState" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "venueCountry" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "arbitrationClause" BOOLEAN DEFAULT false;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "arbitrationRules" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "arbitrationSeat" TEXT;

-- Create contract_modifications table
CREATE TABLE IF NOT EXISTS "contract_modifications" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "type" "ModificationType" NOT NULL,
  "modificationNumber" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "effectiveDate" TIMESTAMP(3) NOT NULL,
  "sectionsAffected" TEXT[],
  "summary" TEXT NOT NULL,
  "documentId" TEXT,
  "status" "ModificationStatus" NOT NULL DEFAULT 'DRAFT',
  "supersedesId" TEXT,
  "allPartiesSigned" BOOLEAN NOT NULL DEFAULT false,
  "executedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT NOT NULL,

  CONSTRAINT "contract_modifications_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "contract_modifications" 
  ADD CONSTRAINT "contract_modifications_contractId_fkey" 
  FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contract_modifications" 
  ADD CONSTRAINT "contract_modifications_supersedesId_fkey" 
  FOREIGN KEY ("supersedesId") REFERENCES "contract_modifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS "contract_modifications_contractId_idx" ON "contract_modifications"("contractId");
CREATE INDEX IF NOT EXISTS "contract_modifications_type_status_idx" ON "contract_modifications"("type", "status");
CREATE INDEX IF NOT EXISTS "contract_modifications_effectiveDate_idx" ON "contract_modifications"("effectiveDate");

-- Add comment for documentation
COMMENT ON TABLE "contract_modifications" IS 'Tracks amendments, addenda, and other modifications to contracts. Part of Phase 1 knowledge gap enhancements.';
COMMENT ON COLUMN "contracts"."governingLaw" IS 'WHICH law applies - the substantive law governing contract interpretation (e.g., "New York")';
COMMENT ON COLUMN "contracts"."forumSelection" IS 'WHERE disputes are heard - the court/venue for dispute resolution (e.g., "State and Federal Courts of Delaware")';
COMMENT ON COLUMN "contracts"."forumSelectionType" IS 'Whether forum selection is permissive (MAY use) or exclusive (MUST use)';
