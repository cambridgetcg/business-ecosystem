CREATE TABLE IF NOT EXISTS "audit_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"finding_type" varchar(30) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"status" varchar(30) DEFAULT 'open' NOT NULL,
	"audit_type" varchar(30) NOT NULL,
	"audit_date" timestamp NOT NULL,
	"auditor_name" varchar(255),
	"audit_reference" varchar(100),
	"regulator" varchar(50),
	"requirement_id" uuid,
	"obligation_id" uuid,
	"remediation_plan" text,
	"remediation_due_date" timestamp,
	"remediation_completed_date" timestamp,
	"remediation_notes" text,
	"assigned_to" uuid,
	"assigned_to_name" varchar(255),
	"evidence_documents" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "compliance_calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_id" uuid,
	"title" varchar(255) NOT NULL,
	"description" text,
	"event_type" varchar(30) NOT NULL,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"regulator" varchar(50),
	"category" varchar(50),
	"obligation_id" uuid,
	"requirement_id" uuid,
	"event_date" timestamp NOT NULL,
	"event_end_date" timestamp,
	"all_day" boolean DEFAULT true NOT NULL,
	"time_zone" varchar(50) DEFAULT 'Europe/London' NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurrence_rule" varchar(255),
	"parent_event_id" uuid,
	"reminder_days" jsonb,
	"reminders_sent" jsonb,
	"assigned_to" jsonb,
	"completed_at" timestamp,
	"completed_by" uuid,
	"completion_notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "compliance_obligations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"requirement_id" uuid NOT NULL,
	"regulator" varchar(50) NOT NULL,
	"jurisdiction" varchar(30) NOT NULL,
	"category" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"form_reference" varchar(50),
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"due_date" timestamp NOT NULL,
	"submitted_date" timestamp,
	"completed_date" timestamp,
	"assigned_to" uuid,
	"assigned_to_name" varchar(255),
	"assigned_at" timestamp,
	"reviewed_by" uuid,
	"reviewed_by_name" varchar(255),
	"reviewed_date" timestamp,
	"review_notes" text,
	"completed_by" uuid,
	"completed_by_name" varchar(255),
	"completion_notes" text,
	"evidence_documents" jsonb,
	"submission_reference" varchar(100),
	"external_url" text,
	"reminder_sent_at" timestamp,
	"escalated" boolean DEFAULT false NOT NULL,
	"escalated_at" timestamp,
	"escalated_to" uuid,
	"escalation_reason" text,
	"filing_fee" real,
	"penalty_amount" real,
	"total_cost" real,
	"notes" text,
	"metadata" jsonb,
	"tags" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "compliance_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_id" uuid,
	"report_type" varchar(30) NOT NULL,
	"title" varchar(255) NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"summary" text,
	"obligations_total" integer NOT NULL,
	"obligations_completed" integer NOT NULL,
	"obligations_overdue" integer NOT NULL,
	"obligations_pending" integer NOT NULL,
	"breakdown_by_regulator" jsonb,
	"breakdown_by_category" jsonb,
	"risk_level" varchar(20) NOT NULL,
	"risk_notes" text,
	"compliance_rate" real NOT NULL,
	"average_completion_days" real,
	"total_penalties" real,
	"recommended_actions" jsonb,
	"escalation_items" jsonb,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp,
	"distributed_to" jsonb,
	"distributed_at" timestamp,
	"document_storage_key" varchar(500),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regulatory_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"regulator" varchar(50) NOT NULL,
	"regulation_name" varchar(255) NOT NULL,
	"regulation_reference" varchar(100),
	"jurisdiction" varchar(30) NOT NULL,
	"category" varchar(50) NOT NULL,
	"sub_category" varchar(100),
	"description" text NOT NULL,
	"applicability_conditions" jsonb,
	"applicable_entity_types" jsonb,
	"thresholds" jsonb,
	"frequency" varchar(30) NOT NULL,
	"deadline_rule" varchar(500),
	"grace_period_days" integer,
	"penalty_description" text,
	"max_penalty_amount" real,
	"penalty_currency" varchar(3) DEFAULT 'GBP' NOT NULL,
	"exemptions" jsonb,
	"exemption_conditions" jsonb,
	"effective_date" timestamp NOT NULL,
	"sunset_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"guidance_url" text,
	"form_reference" varchar(50),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "findings_tenant_idx" ON "audit_findings" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "findings_entity_idx" ON "audit_findings" ("entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "findings_status_idx" ON "audit_findings" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "findings_severity_idx" ON "audit_findings" ("severity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_tenant_idx" ON "compliance_calendar_events" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_entity_idx" ON "compliance_calendar_events" ("entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_event_date_idx" ON "compliance_calendar_events" ("event_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_obligation_idx" ON "compliance_calendar_events" ("obligation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obligations_tenant_idx" ON "compliance_obligations" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obligations_entity_idx" ON "compliance_obligations" ("entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obligations_requirement_idx" ON "compliance_obligations" ("requirement_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obligations_status_idx" ON "compliance_obligations" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obligations_due_date_idx" ON "compliance_obligations" ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obligations_regulator_idx" ON "compliance_obligations" ("regulator");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_tenant_idx" ON "compliance_reports" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_entity_idx" ON "compliance_reports" ("entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_period_idx" ON "compliance_reports" ("period_start","period_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reg_requirements_tenant_idx" ON "regulatory_requirements" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reg_requirements_regulator_idx" ON "regulatory_requirements" ("regulator");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reg_requirements_category_idx" ON "regulatory_requirements" ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reg_requirements_active_idx" ON "regulatory_requirements" ("is_active");