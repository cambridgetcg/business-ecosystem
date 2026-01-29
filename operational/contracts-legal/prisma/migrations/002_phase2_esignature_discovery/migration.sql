-- Phase 2: Legal Compliance
-- 003: E-Signature (SignatureEvent model)
-- 004: Legal Discovery (DiscoveryInfo, LegalHold, DiscoveryRequest, PrivilegeLogEntry)

-- ============================================================================
-- E-Signature Models
-- ============================================================================

-- Signature Type enum
CREATE TYPE "SignatureType" AS ENUM (
  'TYPED_NAME',
  'DRAWN_SIGNATURE',
  'CLICK_TO_SIGN',
  'BIOMETRIC',
  'DIGITAL_CERTIFICATE'
);

-- SignatureEvent table (ESIGN/UETA compliance)
CREATE TABLE IF NOT EXISTS "signature_events" (
  "id" TEXT NOT NULL,
  "contractPartyId" TEXT NOT NULL,
  
  -- What was signed (ESIGN: Association with Record)
  "documentHash" TEXT NOT NULL,
  "documentVersion" INTEGER NOT NULL,
  
  -- How it was signed
  "signatureType" "SignatureType" NOT NULL,
  "signatureData" TEXT,
  
  -- Consent (ESIGN: Consent to Electronic Business)
  "consentGiven" BOOLEAN NOT NULL,
  "consentMethod" TEXT NOT NULL,
  "consentText" TEXT NOT NULL,
  
  -- Context (ESIGN: Intent to Sign)
  "ipAddress" TEXT NOT NULL,
  "userAgent" TEXT NOT NULL,
  "deviceId" TEXT,
  "geolocation" TEXT,
  
  -- Timestamps
  "ceremonyStarted" TIMESTAMP(3) NOT NULL,
  "signedAt" TIMESTAMP(3) NOT NULL,
  
  -- E-signature provider integration
  "providerRef" TEXT,
  "providerName" TEXT,
  "providerData" JSONB,
  
  -- Audit (ESIGN: Record Retention)
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "signature_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "signature_events"
  ADD CONSTRAINT "signature_events_contractPartyId_fkey"
  FOREIGN KEY ("contractPartyId") REFERENCES "contract_parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "signature_events_contractPartyId_idx" ON "signature_events"("contractPartyId");
CREATE INDEX IF NOT EXISTS "signature_events_providerRef_idx" ON "signature_events"("providerRef");

COMMENT ON TABLE "signature_events" IS 'Captures e-signature ceremony details for ESIGN/UETA compliance. Records Intent, Consent, Association, and Retention requirements.';

-- ============================================================================
-- Legal Discovery Models (EDRM Compliance)
-- ============================================================================

-- EDRM Phase enum
CREATE TYPE "EDRMPhase" AS ENUM (
  'IDENTIFICATION',
  'PRESERVATION',
  'COLLECTION',
  'PROCESSING',
  'REVIEW',
  'ANALYSIS',
  'PRODUCTION',
  'PRESENTATION'
);

-- Hold Status enum
CREATE TYPE "HoldStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'LIFTED',
  'SUPERSEDED'
);

-- Discovery Type enum
CREATE TYPE "DiscoveryType" AS ENUM (
  'REQUEST_FOR_PRODUCTION',
  'INTERROGATORY',
  'REQUEST_FOR_ADMISSION',
  'DEPOSITION_NOTICE',
  'SUBPOENA',
  'RULE_30B6_NOTICE'
);

-- Request Direction enum
CREATE TYPE "RequestDirection" AS ENUM (
  'SENT',
  'RECEIVED'
);

-- Response Status enum
CREATE TYPE "ResponseStatus" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'RESPONDED',
  'OBJECTED',
  'EXTENDED',
  'OVERDUE'
);

-- Privilege Type enum
CREATE TYPE "PrivilegeType" AS ENUM (
  'ATTORNEY_CLIENT',
  'WORK_PRODUCT',
  'JOINT_DEFENSE',
  'COMMON_INTEREST',
  'DELIBERATIVE_PROCESS'
);

-- DiscoveryInfo table
CREATE TABLE IF NOT EXISTS "discovery_info" (
  "id" TEXT NOT NULL,
  "matterId" TEXT NOT NULL,
  
  -- Timeline
  "discoveryOpened" TIMESTAMP(3),
  "discoveryDeadline" TIMESTAMP(3),
  "discoveryExtensions" INTEGER NOT NULL DEFAULT 0,
  
  -- EDRM Phase tracking
  "currentPhase" "EDRMPhase" NOT NULL DEFAULT 'IDENTIFICATION',
  
  -- Scope
  "dateCutoffStart" TIMESTAMP(3),
  "dateCutoffEnd" TIMESTAMP(3),
  
  -- Volume
  "documentsIdentified" INTEGER,
  "documentsReviewed" INTEGER,
  "documentsProduced" INTEGER,
  "privilegedCount" INTEGER,
  
  -- Cost tracking
  "reviewCost" DECIMAL(19,4),
  "eDiscoveryCost" DECIMAL(19,4),
  "vendorName" TEXT,
  
  -- Audit
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "discovery_info_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "discovery_info_matterId_key" UNIQUE ("matterId")
);

ALTER TABLE "discovery_info"
  ADD CONSTRAINT "discovery_info_matterId_fkey"
  FOREIGN KEY ("matterId") REFERENCES "legal_matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LegalHold table
CREATE TABLE IF NOT EXISTS "legal_holds" (
  "id" TEXT NOT NULL,
  "matterId" TEXT NOT NULL,
  
  -- What's on hold
  "holdName" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "dataTypes" TEXT[],
  
  -- Who's involved (custodians)
  "custodians" TEXT[],
  
  -- Timeline
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "issuedBy" TEXT NOT NULL,
  "acknowledgedBy" JSONB,
  "liftedAt" TIMESTAMP(3),
  "liftedBy" TEXT,
  "liftReason" TEXT,
  
  -- Status
  "status" "HoldStatus" NOT NULL DEFAULT 'ACTIVE',
  
  -- Reminders
  "remindersSent" INTEGER NOT NULL DEFAULT 0,
  "lastReminderAt" TIMESTAMP(3),
  
  -- Audit
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "legal_holds_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "legal_holds"
  ADD CONSTRAINT "legal_holds_matterId_fkey"
  FOREIGN KEY ("matterId") REFERENCES "legal_matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "legal_holds_matterId_idx" ON "legal_holds"("matterId");
CREATE INDEX IF NOT EXISTS "legal_holds_status_idx" ON "legal_holds"("status");

COMMENT ON TABLE "legal_holds" IS 'Litigation hold management. Critical for EDRM Phase 2 (Preservation). Failure to preserve can result in spoliation sanctions.';

-- DiscoveryRequest table
CREATE TABLE IF NOT EXISTS "discovery_requests" (
  "id" TEXT NOT NULL,
  "matterId" TEXT NOT NULL,
  
  -- Request details
  "type" "DiscoveryType" NOT NULL,
  "requestNumber" TEXT NOT NULL,
  "issuedBy" TEXT NOT NULL,
  "direction" "RequestDirection" NOT NULL DEFAULT 'RECEIVED',
  "receivedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3) NOT NULL,
  
  -- Content
  "description" TEXT NOT NULL,
  "requestItems" JSONB,
  
  -- Response
  "responseStatus" "ResponseStatus" NOT NULL DEFAULT 'PENDING',
  "respondedAt" TIMESTAMP(3),
  "objections" TEXT[],
  "documentsProduced" INTEGER,
  
  -- Extensions
  "extensionRequested" BOOLEAN NOT NULL DEFAULT false,
  "extendedDueDate" TIMESTAMP(3),
  "extensionReason" TEXT,
  
  -- Audit
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "discovery_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "discovery_requests"
  ADD CONSTRAINT "discovery_requests_matterId_fkey"
  FOREIGN KEY ("matterId") REFERENCES "legal_matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "discovery_requests_matterId_idx" ON "discovery_requests"("matterId");
CREATE INDEX IF NOT EXISTS "discovery_requests_type_status_idx" ON "discovery_requests"("type", "responseStatus");
CREATE INDEX IF NOT EXISTS "discovery_requests_dueDate_idx" ON "discovery_requests"("dueDate");

-- PrivilegeLogEntry table
CREATE TABLE IF NOT EXISTS "privilege_log_entries" (
  "id" TEXT NOT NULL,
  "matterId" TEXT NOT NULL,
  
  -- Document info
  "documentId" TEXT,
  "batesNumber" TEXT,
  "documentDate" TIMESTAMP(3),
  "documentType" TEXT,
  "author" TEXT,
  "recipients" TEXT[],
  
  -- Privilege claim
  "privilegeType" "PrivilegeType" NOT NULL,
  "description" TEXT NOT NULL,
  
  -- Review
  "reviewedBy" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL,
  
  -- Challenge handling
  "challenged" BOOLEAN NOT NULL DEFAULT false,
  "challengeNotes" TEXT,
  "inCameraReview" BOOLEAN NOT NULL DEFAULT false,
  
  -- Audit
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "privilege_log_entries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "privilege_log_entries"
  ADD CONSTRAINT "privilege_log_entries_matterId_fkey"
  FOREIGN KEY ("matterId") REFERENCES "legal_matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "privilege_log_entries_matterId_idx" ON "privilege_log_entries"("matterId");
CREATE INDEX IF NOT EXISTS "privilege_log_entries_privilegeType_idx" ON "privilege_log_entries"("privilegeType");

COMMENT ON TABLE "privilege_log_entries" IS 'Attorney-client privilege and work product protection log. Required for Rule 26 disclosures.';
