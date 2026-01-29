-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('CUSTOMER', 'EMPLOYEE', 'CONTRACTOR', 'PROSPECT', 'PARTNER', 'OTHER');

-- CreateEnum
CREATE TYPE "LawfulBasis" AS ENUM ('CONSENT', 'CONTRACT', 'LEGAL_OBLIGATION', 'VITAL_INTEREST', 'PUBLIC_TASK', 'LEGITIMATE_INTEREST');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'EXPIRED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "CaptureMethod" AS ENUM ('FORM', 'API', 'VERBAL', 'WRITTEN', 'CHECKBOX', 'DOUBLE_OPT_IN', 'IMPLICIT');

-- CreateEnum
CREATE TYPE "DSARType" AS ENUM ('ACCESS', 'RECTIFICATION', 'ERASURE', 'RESTRICTION', 'PORTABILITY', 'OBJECTION', 'AUTOMATED_DECISION');

-- CreateEnum
CREATE TYPE "DSARStatus" AS ENUM ('RECEIVED', 'PENDING_VERIFICATION', 'VERIFIED', 'PROCESSING', 'PENDING_REVIEW', 'AWAITING_APPROVAL', 'COMPLETED', 'REJECTED', 'EXTENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('ID_DOCUMENT', 'EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'ACCOUNT_LOGIN', 'KNOWLEDGE_BASED', 'IN_PERSON', 'OTHER');

-- CreateEnum
CREATE TYPE "ResponseMethod" AS ENUM ('EMAIL', 'PORTAL_DOWNLOAD', 'PHYSICAL_MAIL', 'SECURE_TRANSFER');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "BreachSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "BreachCategory" AS ENUM ('CONFIDENTIALITY', 'INTEGRITY', 'AVAILABILITY', 'MIXED');

-- CreateEnum
CREATE TYPE "BreachStatus" AS ENUM ('IDENTIFIED', 'ASSESSING', 'CONTAINED', 'NOTIFYING', 'REMEDIATING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RemediationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "DataCategory" AS ENUM ('BASIC_IDENTITY', 'CONTACT_DETAILS', 'FINANCIAL', 'EMPLOYMENT', 'EDUCATION', 'ONLINE_IDENTIFIERS', 'LOCATION', 'BEHAVIORAL', 'PREFERENCES', 'DEVICE_DATA', 'COMMUNICATION', 'IMAGES', 'AUDIO_VIDEO', 'OTHER');

-- CreateEnum
CREATE TYPE "SpecialCategory" AS ENUM ('RACIAL_ETHNIC_ORIGIN', 'POLITICAL_OPINIONS', 'RELIGIOUS_BELIEFS', 'TRADE_UNION_MEMBERSHIP', 'GENETIC_DATA', 'BIOMETRIC_DATA', 'HEALTH_DATA', 'SEX_LIFE', 'SEXUAL_ORIENTATION', 'CRIMINAL_CONVICTIONS');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DPIAStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'PENDING_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'REQUIRES_CONSULTATION');

-- CreateEnum
CREATE TYPE "RetentionAction" AS ENUM ('DELETE', 'ANONYMIZE', 'ARCHIVE', 'REVIEW');

-- CreateEnum
CREATE TYPE "TransferMechanism" AS ENUM ('ADEQUACY_DECISION', 'STANDARD_CONTRACTUAL_CLAUSES', 'BINDING_CORPORATE_RULES', 'DEROGATION', 'CERTIFICATION', 'CODE_OF_CONDUCT');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('UNKNOWN', 'COMPLIANT', 'NON_COMPLIANT', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "ProcessorStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectEmail" TEXT,
    "subjectType" "SubjectType" NOT NULL DEFAULT 'CUSTOMER',
    "purpose" TEXT NOT NULL,
    "purposeGroup" TEXT,
    "lawfulBasis" "LawfulBasis" NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedAt" TIMESTAMP(3) NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "proofRef" TEXT,
    "captureMethod" "CaptureMethod" NOT NULL DEFAULT 'FORM',
    "sourceSystem" TEXT,
    "version" TEXT,
    "withdrawalReason" TEXT,
    "withdrawalMethod" "CaptureMethod",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsar_requests" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "subjectId" TEXT,
    "subjectEmail" TEXT NOT NULL,
    "subjectName" TEXT,
    "requestType" "DSARType" NOT NULL,
    "description" TEXT,
    "status" "DSARStatus" NOT NULL DEFAULT 'RECEIVED',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" TIMESTAMP(3) NOT NULL,
    "extendedDeadline" TIMESTAMP(3),
    "extensionReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "verificationMethod" "VerificationMethod",
    "assignedTo" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "responseRef" TEXT,
    "responseMethod" "ResponseMethod",
    "responseSentAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "dsar_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsar_activities" (
    "id" TEXT NOT NULL,
    "dsarId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "performedBy" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dsar_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_breaches" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "breachNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "BreachSeverity" NOT NULL,
    "category" "BreachCategory" NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL,
    "occurredAt" TIMESTAMP(3),
    "containedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "affectedCount" INTEGER,
    "affectedCategories" TEXT[],
    "crossBorder" BOOLEAN NOT NULL DEFAULT false,
    "riskToSubjects" "RiskLevel" NOT NULL,
    "likelihoodOfHarm" "RiskLevel",
    "status" "BreachStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "authorityNotificationRequired" BOOLEAN NOT NULL DEFAULT true,
    "authorityNotifiedAt" TIMESTAMP(3),
    "authorityReference" TEXT,
    "notificationDeadline" TIMESTAMP(3),
    "subjectNotificationRequired" BOOLEAN NOT NULL DEFAULT false,
    "subjectsNotifiedAt" TIMESTAMP(3),
    "notificationMethod" TEXT,
    "rootCause" TEXT,
    "attackVector" TEXT,
    "remediationPlan" TEXT,
    "remediationStatus" "RemediationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "lessonsLearned" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "assignedTo" TEXT,

    CONSTRAINT "data_breaches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breach_activities" (
    "id" TEXT NOT NULL,
    "breachId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "performedBy" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "breach_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_activities" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "purposes" TEXT[],
    "lawfulBasis" "LawfulBasis"[],
    "legitimateInterest" TEXT,
    "dataCategories" "DataCategory"[],
    "specialCategories" "SpecialCategory"[],
    "subjectCategories" TEXT[],
    "recipients" TEXT[],
    "thirdCountryTransfers" TEXT[],
    "transferSafeguards" TEXT,
    "retentionPeriod" TEXT,
    "retentionCriteria" TEXT,
    "technicalMeasures" TEXT[],
    "organizationalMeasures" TEXT[],
    "dpiaRequired" BOOLEAN NOT NULL DEFAULT false,
    "dpiaReference" TEXT,
    "status" "ActivityStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewDue" TIMESTAMP(3),
    "controller" TEXT NOT NULL,
    "processor" TEXT,
    "dpo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "processing_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_impact_assessments" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "assessmentNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "processingActivityId" TEXT,
    "necessity" TEXT NOT NULL,
    "proportionality" TEXT NOT NULL,
    "risks" JSONB NOT NULL,
    "mitigations" JSONB NOT NULL,
    "residualRisks" JSONB,
    "dpoConsulted" BOOLEAN NOT NULL DEFAULT false,
    "dpoOpinion" TEXT,
    "authorityConsulted" BOOLEAN NOT NULL DEFAULT false,
    "authorityResponse" TEXT,
    "status" "DPIAStatus" NOT NULL DEFAULT 'DRAFT',
    "completedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "nextReviewDue" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "privacy_impact_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_policies" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dataCategory" "DataCategory" NOT NULL,
    "retentionPeriod" INTEGER NOT NULL,
    "retentionBasis" TEXT NOT NULL,
    "actionOnExpiry" "RetentionAction" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_processors" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "country" TEXT NOT NULL,
    "isEU" BOOLEAN NOT NULL DEFAULT false,
    "dpaReference" TEXT,
    "dpaSignedAt" TIMESTAMP(3),
    "dpaExpiresAt" TIMESTAMP(3),
    "transferMechanism" "TransferMechanism",
    "sccReference" TEXT,
    "dataCategories" "DataCategory"[],
    "purposes" TEXT[],
    "hasSubProcessors" BOOLEAN NOT NULL DEFAULT false,
    "subProcessors" JSONB,
    "lastAuditDate" TIMESTAMP(3),
    "complianceStatus" "ComplianceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "certifications" TEXT[],
    "status" "ProcessorStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "data_processors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_audit_logs" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "privacy_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_records_entityId_idx" ON "consent_records"("entityId");

-- CreateIndex
CREATE INDEX "consent_records_subjectId_idx" ON "consent_records"("subjectId");

-- CreateIndex
CREATE INDEX "consent_records_purpose_idx" ON "consent_records"("purpose");

-- CreateIndex
CREATE INDEX "consent_records_status_idx" ON "consent_records"("status");

-- CreateIndex
CREATE INDEX "consent_records_expiresAt_idx" ON "consent_records"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "dsar_requests_requestNumber_key" ON "dsar_requests"("requestNumber");

-- CreateIndex
CREATE INDEX "dsar_requests_entityId_idx" ON "dsar_requests"("entityId");

-- CreateIndex
CREATE INDEX "dsar_requests_subjectId_idx" ON "dsar_requests"("subjectId");

-- CreateIndex
CREATE INDEX "dsar_requests_subjectEmail_idx" ON "dsar_requests"("subjectEmail");

-- CreateIndex
CREATE INDEX "dsar_requests_status_idx" ON "dsar_requests"("status");

-- CreateIndex
CREATE INDEX "dsar_requests_deadline_idx" ON "dsar_requests"("deadline");

-- CreateIndex
CREATE INDEX "dsar_requests_requestNumber_idx" ON "dsar_requests"("requestNumber");

-- CreateIndex
CREATE INDEX "dsar_activities_dsarId_idx" ON "dsar_activities"("dsarId");

-- CreateIndex
CREATE UNIQUE INDEX "data_breaches_breachNumber_key" ON "data_breaches"("breachNumber");

-- CreateIndex
CREATE INDEX "data_breaches_entityId_idx" ON "data_breaches"("entityId");

-- CreateIndex
CREATE INDEX "data_breaches_severity_idx" ON "data_breaches"("severity");

-- CreateIndex
CREATE INDEX "data_breaches_status_idx" ON "data_breaches"("status");

-- CreateIndex
CREATE INDEX "data_breaches_discoveredAt_idx" ON "data_breaches"("discoveredAt");

-- CreateIndex
CREATE INDEX "data_breaches_notificationDeadline_idx" ON "data_breaches"("notificationDeadline");

-- CreateIndex
CREATE INDEX "breach_activities_breachId_idx" ON "breach_activities"("breachId");

-- CreateIndex
CREATE INDEX "processing_activities_entityId_idx" ON "processing_activities"("entityId");

-- CreateIndex
CREATE INDEX "processing_activities_status_idx" ON "processing_activities"("status");

-- CreateIndex
CREATE UNIQUE INDEX "privacy_impact_assessments_assessmentNumber_key" ON "privacy_impact_assessments"("assessmentNumber");

-- CreateIndex
CREATE INDEX "privacy_impact_assessments_entityId_idx" ON "privacy_impact_assessments"("entityId");

-- CreateIndex
CREATE INDEX "privacy_impact_assessments_status_idx" ON "privacy_impact_assessments"("status");

-- CreateIndex
CREATE INDEX "retention_policies_entityId_idx" ON "retention_policies"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "retention_policies_entityId_dataCategory_key" ON "retention_policies"("entityId", "dataCategory");

-- CreateIndex
CREATE INDEX "data_processors_entityId_idx" ON "data_processors"("entityId");

-- CreateIndex
CREATE INDEX "data_processors_status_idx" ON "data_processors"("status");

-- CreateIndex
CREATE INDEX "privacy_audit_logs_entityId_idx" ON "privacy_audit_logs"("entityId");

-- CreateIndex
CREATE INDEX "privacy_audit_logs_entityType_recordId_idx" ON "privacy_audit_logs"("entityType", "recordId");

-- CreateIndex
CREATE INDEX "privacy_audit_logs_userId_idx" ON "privacy_audit_logs"("userId");

-- CreateIndex
CREATE INDEX "privacy_audit_logs_timestamp_idx" ON "privacy_audit_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "dsar_activities" ADD CONSTRAINT "dsar_activities_dsarId_fkey" FOREIGN KEY ("dsarId") REFERENCES "dsar_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breach_activities" ADD CONSTRAINT "breach_activities_breachId_fkey" FOREIGN KEY ("breachId") REFERENCES "data_breaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
