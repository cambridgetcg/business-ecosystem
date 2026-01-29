-- Phase 3: Contract Performance
-- 005: Force Majeure (ForceMajeureClause, ForceMajeureEvent)
-- 006: Material Breach (PerformanceIssue, BreachAllegation, CureAttempt)

-- ============================================================================
-- Force Majeure
-- ============================================================================

-- Covered Event enum
CREATE TYPE "CoveredEvent" AS ENUM (
  'ACT_OF_GOD', 'NATURAL_DISASTER', 'EARTHQUAKE', 'FLOOD', 'FIRE',
  'HURRICANE', 'TORNADO', 'PANDEMIC', 'EPIDEMIC', 'DISEASE_OUTBREAK',
  'WAR', 'TERRORISM', 'CIVIL_UNREST', 'RIOT', 'STRIKE', 'LABOR_DISPUTE',
  'GOVERNMENT_ACTION', 'CHANGE_IN_LAW', 'EMBARGO', 'SANCTIONS',
  'SUPPLY_CHAIN_DISRUPTION', 'UTILITY_FAILURE', 'CYBERATTACK', 'OTHER'
);

-- Performance Standard enum
CREATE TYPE "PerformanceStandard" AS ENUM (
  'PREVENTED', 'RENDERED_UNABLE', 'HINDERED', 'DELAYED', 'IMPACTED'
);

-- FM Status enum
CREATE TYPE "FMStatus" AS ENUM (
  'INVOKED', 'ACKNOWLEDGED', 'DISPUTED', 'SUSPENDED',
  'RESUMED', 'TERMINATED', 'RESOLVED'
);

-- FM Resolution enum
CREATE TYPE "FMResolution" AS ENUM (
  'PERFORMANCE_RESUMED', 'OBLIGATIONS_MODIFIED', 'EXTENSION_GRANTED',
  'PARTIAL_PERFORMANCE', 'CONTRACT_TERMINATED', 'CLAIM_REJECTED', 'SETTLED'
);

-- ForceMajeureClause table
CREATE TABLE IF NOT EXISTS "force_majeure_clauses" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "hasClause" BOOLEAN NOT NULL,
  "clauseSection" TEXT,
  "coveredEvents" "CoveredEvent"[],
  "performanceStandard" "PerformanceStandard" NOT NULL DEFAULT 'PREVENTED',
  "noticeRequired" BOOLEAN NOT NULL DEFAULT true,
  "noticePeriodDays" INTEGER,
  "noticeRecipient" TEXT,
  "allowsSuspension" BOOLEAN NOT NULL DEFAULT true,
  "allowsTermination" BOOLEAN NOT NULL DEFAULT false,
  "terminationThresholdDays" INTEGER,
  "clauseText" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "force_majeure_clauses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "force_majeure_clauses_contractId_key" UNIQUE ("contractId")
);

ALTER TABLE "force_majeure_clauses"
  ADD CONSTRAINT "force_majeure_clauses_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ForceMajeureEvent table
CREATE TABLE IF NOT EXISTS "force_majeure_events" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "eventType" "CoveredEvent" NOT NULL,
  "eventName" TEXT NOT NULL,
  "eventDescription" TEXT NOT NULL,
  "eventStartDate" TIMESTAMP(3) NOT NULL,
  "eventEndDate" TIMESTAMP(3),
  "invokedAt" TIMESTAMP(3) NOT NULL,
  "invokedBy" TEXT NOT NULL,
  "noticeGiven" BOOLEAN NOT NULL,
  "noticeDate" TIMESTAMP(3),
  "obligationsAffected" TEXT[],
  "reliefRequested" TEXT NOT NULL,
  "counterpartyResponse" TEXT,
  "responseDate" TIMESTAMP(3),
  "disputed" BOOLEAN NOT NULL DEFAULT false,
  "disputeDetails" TEXT,
  "status" "FMStatus" NOT NULL DEFAULT 'INVOKED',
  "resolutionType" "FMResolution",
  "resolvedAt" TIMESTAMP(3),
  "performanceResumed" TIMESTAMP(3),
  "documentIds" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "force_majeure_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "force_majeure_events"
  ADD CONSTRAINT "force_majeure_events_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "force_majeure_events_contractId_idx" ON "force_majeure_events"("contractId");
CREATE INDEX IF NOT EXISTS "force_majeure_events_status_idx" ON "force_majeure_events"("status");
CREATE INDEX IF NOT EXISTS "force_majeure_events_eventStartDate_idx" ON "force_majeure_events"("eventStartDate");

-- ============================================================================
-- Material Breach Tracking
-- ============================================================================

-- Issue Severity enum
CREATE TYPE "IssueSeverity" AS ENUM (
  'MINOR', 'MODERATE', 'SIGNIFICANT', 'CRITICAL'
);

-- Issue Status enum
CREATE TYPE "IssueStatus" AS ENUM (
  'OPEN', 'CURE_IN_PROGRESS', 'CURED', 'ESCALATED_TO_BREACH', 'WAIVED', 'DISPUTED'
);

-- Breach Type enum
CREATE TYPE "BreachType" AS ENUM (
  'NON_PERFORMANCE', 'DEFECTIVE_PERFORMANCE', 'LATE_PERFORMANCE',
  'ANTICIPATORY', 'REPUDIATION'
);

-- Materiality Level enum
CREATE TYPE "MaterialityLevel" AS ENUM (
  'MINOR', 'MODERATE', 'MATERIAL', 'FUNDAMENTAL'
);

-- Breach Status enum
CREATE TYPE "BreachStatus" AS ENUM (
  'ALLEGED', 'ACKNOWLEDGED', 'DENIED', 'UNDER_CURE', 'CURED',
  'DETERMINED_MATERIAL', 'DETERMINED_IMMATERIAL', 'LITIGATED', 'SETTLED'
);

-- Breach Resolution enum
CREATE TYPE "BreachResolution" AS ENUM (
  'CURED_BY_BREACHING_PARTY', 'DAMAGES_PAID', 'CONTRACT_TERMINATED',
  'CONTRACT_MODIFIED', 'MUTUAL_RELEASE', 'WAIVED', 'COURT_JUDGMENT',
  'ARBITRATION_AWARD', 'SETTLED'
);

-- PerformanceIssue table
CREATE TABLE IF NOT EXISTS "performance_issues" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "obligationId" TEXT,
  "description" TEXT NOT NULL,
  "affectedSection" TEXT,
  "severity" "IssueSeverity" NOT NULL,
  "isTimeSensitive" BOOLEAN NOT NULL DEFAULT false,
  "reportedBy" TEXT NOT NULL,
  "reportedAt" TIMESTAMP(3) NOT NULL,
  "cureDeadline" TIMESTAMP(3),
  "curePeriodDays" INTEGER,
  "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
  "resolvedAt" TIMESTAMP(3),
  "resolution" TEXT,
  "escalatedToBreach" BOOLEAN NOT NULL DEFAULT false,
  "breachAllegationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_issues_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "performance_issues"
  ADD CONSTRAINT "performance_issues_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "performance_issues_contractId_idx" ON "performance_issues"("contractId");
CREATE INDEX IF NOT EXISTS "performance_issues_status_idx" ON "performance_issues"("status");
CREATE INDEX IF NOT EXISTS "performance_issues_severity_idx" ON "performance_issues"("severity");

-- CureAttempt table
CREATE TABLE IF NOT EXISTS "cure_attempts" (
  "id" TEXT NOT NULL,
  "performanceIssueId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "attemptedAt" TIMESTAMP(3) NOT NULL,
  "attemptedBy" TEXT NOT NULL,
  "successful" BOOLEAN,
  "evaluatedAt" TIMESTAMP(3),
  "evaluatedBy" TEXT,
  "evaluationNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cure_attempts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "cure_attempts"
  ADD CONSTRAINT "cure_attempts_performanceIssueId_fkey"
  FOREIGN KEY ("performanceIssueId") REFERENCES "performance_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "cure_attempts_performanceIssueId_idx" ON "cure_attempts"("performanceIssueId");

-- BreachAllegation table
CREATE TABLE IF NOT EXISTS "breach_allegations" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "allegedBy" TEXT NOT NULL,
  "allegedAt" TIMESTAMP(3) NOT NULL,
  "breachType" "BreachType" NOT NULL,
  "description" TEXT NOT NULL,
  "affectedSections" TEXT[],
  "performanceIssueIds" TEXT[],
  "claimedMateriality" "MaterialityLevel" NOT NULL,
  "claimedDamages" DECIMAL(19,4),
  "claimedDamagesDesc" TEXT,
  "respondedAt" TIMESTAMP(3),
  "responseDenies" BOOLEAN,
  "responseDetails" TEXT,
  "status" "BreachStatus" NOT NULL DEFAULT 'ALLEGED',
  "determinedMaterial" BOOLEAN,
  "resolvedAt" TIMESTAMP(3),
  "resolutionType" "BreachResolution",
  "resolutionDetails" TEXT,
  "linkedToMatterId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "breach_allegations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "breach_allegations"
  ADD CONSTRAINT "breach_allegations_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "breach_allegations_contractId_idx" ON "breach_allegations"("contractId");
CREATE INDEX IF NOT EXISTS "breach_allegations_status_idx" ON "breach_allegations"("status");

COMMENT ON TABLE "force_majeure_clauses" IS 'Structured extraction of force majeure provisions. COVID-19 exposed the critical need for this data.';
COMMENT ON TABLE "breach_allegations" IS 'Tracks breach claims and the "murky middle ground" between full performance and material breach.';
