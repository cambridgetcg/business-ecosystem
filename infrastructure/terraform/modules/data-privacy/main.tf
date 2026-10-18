# =============================================================================
# Data Privacy Terraform Module
# =============================================================================
# AWS infrastructure for GDPR-compliant data privacy operations
#
# Components:
# - KMS: Encryption key for all data-privacy resources
# - S3: Audit bucket (7-year retention), DSAR exports, Athena results
# - Firehose: CloudWatch Logs → S3 Parquet streaming
# - Glue: Catalog for audit data schema
# - Athena: SQL queries for compliance reporting
#
# GDPR Compliance:
# - Art. 5(1)(f): Accountability through immutable audit trail
# - Art. 32(1)(a): Encryption of personal data at rest
# - Art. 33-34: Breach notification deadline tracking
# - Art. 35: DPIA documentation and workflow
#
# Usage:
#   module "data_privacy" {
#     source = "./modules/data-privacy"
#
#     environment  = "dev"
#     project_name = "ecosystem"
#     aws_region   = "us-east-1"
#
#     audit_log_retention_days = 30
#     audit_s3_retention_days  = 2555  # 7 years
#
#     notification_email = "privacy@example.com"
#
#     tags = {
#       Owner = "privacy-team"
#     }
#   }
# =============================================================================

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

# =============================================================================
# Module Files Reference
# =============================================================================
# This module is organized into the following files:
#
# main.tf       - This file (module documentation and configuration)
# variables.tf  - Input variables and locals
# outputs.tf    - Output values for consumers
# kms.tf        - KMS encryption key and policies
# s3.tf         - S3 buckets (audit, DSAR exports, Athena results)
# firehose.tf   - Kinesis Firehose delivery stream
# glue.tf       - Glue catalog database and tables
# athena.tf     - Athena workgroup and saved queries
# =============================================================================
