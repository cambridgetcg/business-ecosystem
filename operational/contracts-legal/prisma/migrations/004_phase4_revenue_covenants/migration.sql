-- Phase 4: Specialized Extensions
-- 007: Revenue Recognition (PerformanceObligation, Milestone)
-- 008: Non-Compete Enforceability (RestrictiveCovenant)

-- ============================================================================
-- Revenue Recognition (ASC 606)
-- ============================================================================

-- Timing Type enum
CREATE TYPE "TimingType" AS ENUM (
  'POINT_IN_TIME',
  'OVER_TIME'
);

-- Measurement Method enum
CREATE TYPE "MeasurementMethod" AS ENUM (
  'OUTPUT_UNITS_DELIVERED',
  'OUTPUT_MILESTONES',
  'OUTPUT_SURVEY',
  'INPUT_COSTS_INCURRED',
  'INPUT_TIME_ELAPSED',
  'INPUT_RESOURCES_CONSUMED'
);

-- PO Status enum
CREATE TYPE "POStatus" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'SATISFIED',
  'CANCELLED'
);

-- Milestone Status enum
CREATE TYPE "MilestoneStatus" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'APPROVED',
  'DISPUTED'
);

-- Rev Rec Method enum
CREATE TYPE "RevRecMethod" AS ENUM (
  'POINT_IN_TIME_DELIVERY',
  'POINT_IN_TIME_ACCEPTANCE',
  'OVER_TIME_OUTPUT',
  'OVER_TIME_INPUT',
  'PERCENTAGE_OF_COMPLETION'
);

-- Add revenue recognition fields to contracts
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "revenueRecognitionMethod" "RevRecMethod";
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "revenueRecognitionNotes" TEXT;

-- PerformanceObligation table
CREATE TABLE IF NOT EXISTS "performance_obligations" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "satisfactionTiming" "TimingType" NOT NULL,
  "standalonePrice" DECIMAL(19,4),
  "allocatedPrice" DECIMAL(19,4) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "measurementMethod" "MeasurementMethod",
  "percentComplete" DECIMAL(5,2),
  "status" "POStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "satisfiedAt" TIMESTAMP(3),
  "revenueRecognized" DECIMAL(19,4),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_obligations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "performance_obligations"
  ADD CONSTRAINT "performance_obligations_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "performance_obligations_contractId_idx" ON "performance_obligations"("contractId");
CREATE INDEX IF NOT EXISTS "performance_obligations_status_idx" ON "performance_obligations"("status");

-- Milestone table
CREATE TABLE IF NOT EXISTS "milestones" (
  "id" TEXT NOT NULL,
  "performanceObligationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "percentOfObligation" DECIMAL(5,2) NOT NULL,
  "targetDate" TIMESTAMP(3),
  "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
  "completedAt" TIMESTAMP(3),
  "completedBy" TEXT,
  "evidenceDocumentId" TEXT,
  "approvedForRevenue" BOOLEAN NOT NULL DEFAULT false,
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "milestones"
  ADD CONSTRAINT "milestones_performanceObligationId_fkey"
  FOREIGN KEY ("performanceObligationId") REFERENCES "performance_obligations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "milestones_performanceObligationId_idx" ON "milestones"("performanceObligationId");
CREATE INDEX IF NOT EXISTS "milestones_status_idx" ON "milestones"("status");

-- ============================================================================
-- Restrictive Covenants (Non-Compete Enforceability)
-- ============================================================================

-- Covenant Type enum
CREATE TYPE "CovenantType" AS ENUM (
  'NON_COMPETE',
  'NON_SOLICITATION',
  'NON_POACHING',
  'CONFIDENTIALITY',
  'NON_DISPARAGEMENT',
  'INVENTION_ASSIGNMENT'
);

-- Enforceability Status enum
CREATE TYPE "EnforceabilityStatus" AS ENUM (
  'NOT_ANALYZED',
  'LIKELY_ENFORCEABLE',
  'PARTIALLY_ENFORCEABLE',
  'UNLIKELY_ENFORCEABLE',
  'VOID_BY_LAW',
  'NEEDS_REVIEW'
);

-- Covenant Status enum
CREATE TYPE "CovenantStatus" AS ENUM (
  'ACTIVE',
  'EXPIRED',
  'WAIVED',
  'ENFORCED',
  'CHALLENGED'
);

-- RestrictiveCovenant table
CREATE TABLE IF NOT EXISTS "restrictive_covenants" (
  "id" TEXT NOT NULL,
  "employmentAgreementId" TEXT NOT NULL,
  "covenantType" "CovenantType" NOT NULL,
  "durationDays" INTEGER,
  "geographicScope" TEXT,
  "scopeDescription" TEXT,
  "competitorNames" TEXT[],
  "customerRestriction" BOOLEAN NOT NULL DEFAULT false,
  "employeeRestriction" BOOLEAN NOT NULL DEFAULT false,
  "consideration" TEXT,
  "considerationValue" DECIMAL(19,4),
  "enforceabilityState" TEXT,
  "enforceabilityStatus" "EnforceabilityStatus" NOT NULL DEFAULT 'NOT_ANALYZED',
  "enforceabilityNotes" TEXT,
  "analyzedAt" TIMESTAMP(3),
  "analyzedBy" TEXT,
  "status" "CovenantStatus" NOT NULL DEFAULT 'ACTIVE',
  "waivedAt" TIMESTAMP(3),
  "waivedBy" TEXT,
  "waiverReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "restrictive_covenants_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "restrictive_covenants"
  ADD CONSTRAINT "restrictive_covenants_employmentAgreementId_fkey"
  FOREIGN KEY ("employmentAgreementId") REFERENCES "employment_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "restrictive_covenants_employmentAgreementId_idx" ON "restrictive_covenants"("employmentAgreementId");
CREATE INDEX IF NOT EXISTS "restrictive_covenants_covenantType_idx" ON "restrictive_covenants"("covenantType");
CREATE INDEX IF NOT EXISTS "restrictive_covenants_enforceabilityStatus_idx" ON "restrictive_covenants"("enforceabilityStatus");

COMMENT ON TABLE "performance_obligations" IS 'ASC 606 compliance: Revenue recognized when (or as) performance obligations are satisfied.';
COMMENT ON TABLE "restrictive_covenants" IS 'Detailed non-compete/non-solicit tracking with state-by-state enforceability analysis.';
COMMENT ON COLUMN "restrictive_covenants"."enforceabilityStatus" IS 'VOID_BY_LAW applies to states like California where non-competes are prohibited.';
