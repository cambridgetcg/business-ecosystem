DO $$ BEGIN
 CREATE TYPE "copyright_status" AS ENUM('unregistered', 'pending', 'registered', 'disputed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "ip_type" AS ENUM('patent', 'trademark', 'copyright', 'trade_secret');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "license_status" AS ENUM('draft', 'active', 'suspended', 'terminated', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "license_type" AS ENUM('exclusive', 'non_exclusive', 'sole', 'sublicense');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "patent_status" AS ENUM('draft', 'provisional', 'pending', 'published', 'granted', 'abandoned', 'expired', 'lapsed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "patent_type" AS ENUM('utility', 'design', 'plant', 'reissue');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "trademark_status" AS ENUM('draft', 'pending', 'published', 'opposed', 'registered', 'cancelled', 'expired', 'abandoned');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "trademark_type" AS ENUM('word', 'design', 'combined', 'sound', 'color', '3d');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "work_type" AS ENUM('literary', 'musical', 'dramatic', 'choreographic', 'pictorial', 'audiovisual', 'sound_recording', 'architectural', 'software', 'compilation', 'derivative');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "copyrights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_number" varchar(50),
	"title" text NOT NULL,
	"alternative_titles" jsonb DEFAULT '[]'::jsonb,
	"work_type" "work_type" NOT NULL,
	"status" "copyright_status" DEFAULT 'unregistered' NOT NULL,
	"creation_date" date NOT NULL,
	"publication_date" date,
	"registration_date" date,
	"authors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"claimant_id" uuid NOT NULL,
	"description" text,
	"nation" varchar(2) NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "copyrights_registration_number_unique" UNIQUE("registration_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ip_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"actor_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"changes" jsonb,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"license_number" varchar(50) NOT NULL,
	"ip_type" "ip_type" NOT NULL,
	"ip_asset_id" uuid NOT NULL,
	"license_type" "license_type" NOT NULL,
	"status" "license_status" DEFAULT 'draft' NOT NULL,
	"licensor_id" uuid NOT NULL,
	"licensee_id" uuid NOT NULL,
	"effective_date" date NOT NULL,
	"expiration_date" date,
	"termination_date" date,
	"territory" jsonb NOT NULL,
	"royalty_terms" jsonb NOT NULL,
	"field_of_use" text,
	"can_sublicense" boolean DEFAULT false NOT NULL,
	"sublicense_of" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "licenses_license_number_unique" UNIQUE("license_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "patents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_number" varchar(50),
	"patent_number" varchar(50),
	"title" text NOT NULL,
	"abstract" text,
	"type" "patent_type" NOT NULL,
	"status" "patent_status" DEFAULT 'draft' NOT NULL,
	"filing_date" date,
	"priority_date" date,
	"publication_date" date,
	"grant_date" date,
	"expiration_date" date,
	"inventors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assignee_id" uuid,
	"jurisdictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"claims" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "patents_application_number_unique" UNIQUE("application_number"),
	CONSTRAINT "patents_patent_number_unique" UNIQUE("patent_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trademarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_number" varchar(50),
	"registration_number" varchar(50),
	"mark" text NOT NULL,
	"description" text,
	"type" "trademark_type" NOT NULL,
	"status" "trademark_status" DEFAULT 'draft' NOT NULL,
	"filing_date" date,
	"registration_date" date,
	"expiration_date" date,
	"renewal_date" date,
	"owner_id" uuid NOT NULL,
	"nice_classes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"jurisdictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "trademarks_application_number_unique" UNIQUE("application_number"),
	CONSTRAINT "trademarks_registration_number_unique" UNIQUE("registration_number")
);
