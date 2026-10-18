CREATE TABLE IF NOT EXISTS "boi_filings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"filing_type" varchar(20) NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"is_exempt" boolean DEFAULT false NOT NULL,
	"exemption_reason" varchar(50),
	"exemption_justification" text,
	"beneficial_owners" jsonb NOT NULL,
	"company_applicants" jsonb,
	"fincen_id" varchar(50),
	"submission_reference" varchar(100),
	"due_date" timestamp NOT NULL,
	"submitted_at" timestamp,
	"accepted_at" timestamp,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"update_due_date" timestamp,
	"last_change_date" timestamp,
	"document_storage_key" varchar(500),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boi_filings_tenant_idx" ON "boi_filings" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boi_filings_entity_idx" ON "boi_filings" ("entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boi_filings_status_idx" ON "boi_filings" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boi_filings_due_date_idx" ON "boi_filings" ("due_date");