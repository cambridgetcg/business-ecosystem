# =============================================================================
# Amazon Athena Configuration for Audit Queries
# =============================================================================
# Enables SQL queries on audit data for compliance reporting

# -----------------------------------------------------------------------------
# Athena Workgroup
# -----------------------------------------------------------------------------

resource "aws_athena_workgroup" "audit" {
  name        = "${local.name_prefix}-audit"
  description = "Data Privacy audit query workgroup"
  state       = "ENABLED"

  configuration {
    enforce_workgroup_configuration    = true
    publish_cloudwatch_metrics_enabled = true

    result_configuration {
      output_location = "s3://${aws_s3_bucket.athena_results.id}/results/"

      encryption_configuration {
        encryption_option = "SSE_KMS"
        kms_key_arn       = aws_kms_key.data_privacy.arn
      }
    }

    engine_version {
      selected_engine_version = "Athena engine version 3"
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-audit-workgroup"
  })
}

# -----------------------------------------------------------------------------
# Athena Results Bucket
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "athena_results" {
  bucket = "${local.name_prefix}-athena-results"

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-athena-results"
    Purpose = "Athena Query Results"
  })
}

resource "aws_s3_bucket_versioning" "athena_results" {
  bucket = aws_s3_bucket.athena_results.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "athena_results" {
  bucket = aws_s3_bucket.athena_results.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.data_privacy.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "athena_results" {
  bucket = aws_s3_bucket.athena_results.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Auto-delete query results after 7 days
resource "aws_s3_bucket_lifecycle_configuration" "athena_results" {
  bucket = aws_s3_bucket.athena_results.id

  rule {
    id     = "expire-results"
    status = "Enabled"

    expiration {
      days = 7
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# -----------------------------------------------------------------------------
# Saved Queries for Compliance Reporting
# -----------------------------------------------------------------------------

resource "aws_athena_named_query" "consent_audit" {
  name        = "consent-audit-report"
  description = "Consent events audit report by date range"
  database    = aws_glue_catalog_database.audit.name
  workgroup   = aws_athena_workgroup.audit.name

  query = <<-EOT
    -- Consent Audit Report
    -- Replace date range parameters: START_DATE, END_DATE
    SELECT
      date_trunc('day', timestamp) as date,
      event_type,
      action,
      COUNT(*) as event_count,
      COUNT(DISTINCT subject_id) as unique_subjects
    FROM ${aws_glue_catalog_database.audit.name}.audit_events
    WHERE event_category = 'consent'
      AND timestamp BETWEEN TIMESTAMP 'START_DATE' AND TIMESTAMP 'END_DATE'
    GROUP BY date_trunc('day', timestamp), event_type, action
    ORDER BY date DESC, event_count DESC
  EOT
}

resource "aws_athena_named_query" "dsar_compliance" {
  name        = "dsar-compliance-report"
  description = "DSAR compliance report - deadline tracking"
  database    = aws_glue_catalog_database.audit.name
  workgroup   = aws_athena_workgroup.audit.name

  query = <<-EOT
    -- DSAR Compliance Report
    -- Shows DSAR requests and their lifecycle events
    SELECT
      resource_id as request_id,
      json_extract_scalar(metadata, '$.requestType') as request_type,
      subject_id,
      MIN(CASE WHEN action = 'SUBMITTED' THEN timestamp END) as submitted_at,
      MIN(CASE WHEN action = 'COMPLETED' THEN timestamp END) as completed_at,
      json_extract_scalar(
        MAX(CASE WHEN action = 'SUBMITTED' THEN metadata END),
        '$.deadline'
      ) as deadline,
      COUNT(*) as total_events
    FROM ${aws_glue_catalog_database.audit.name}.audit_events
    WHERE event_category = 'dsar'
      AND year = YEAR(CURRENT_DATE)
    GROUP BY resource_id, json_extract_scalar(metadata, '$.requestType'), subject_id
    ORDER BY submitted_at DESC
  EOT
}

resource "aws_athena_named_query" "breach_notification" {
  name        = "breach-notification-report"
  description = "Breach notification compliance report"
  database    = aws_glue_catalog_database.audit.name
  workgroup   = aws_athena_workgroup.audit.name

  query = <<-EOT
    -- Breach Notification Compliance Report
    -- Tracks 72-hour notification deadline compliance
    SELECT
      resource_id as breach_id,
      json_extract_scalar(metadata, '$.severity') as severity,
      MIN(CASE WHEN action = 'DISCOVERED' THEN timestamp END) as discovered_at,
      MIN(CASE WHEN action = 'AUTHORITY_NOTIFIED' THEN timestamp END) as notified_at,
      json_extract_scalar(
        MAX(CASE WHEN action = 'DISCOVERED' THEN metadata END),
        '$.notificationDeadline'
      ) as notification_deadline,
      CASE
        WHEN MIN(CASE WHEN action = 'AUTHORITY_NOTIFIED' THEN timestamp END) IS NOT NULL
          AND MIN(CASE WHEN action = 'AUTHORITY_NOTIFIED' THEN timestamp END) <=
              CAST(json_extract_scalar(MAX(CASE WHEN action = 'DISCOVERED' THEN metadata END), '$.notificationDeadline') AS timestamp)
        THEN 'ON_TIME'
        WHEN MIN(CASE WHEN action = 'AUTHORITY_NOTIFIED' THEN timestamp END) IS NOT NULL
        THEN 'LATE'
        ELSE 'PENDING'
      END as compliance_status
    FROM ${aws_glue_catalog_database.audit.name}.audit_events
    WHERE event_category = 'breach'
      AND year = YEAR(CURRENT_DATE)
    GROUP BY resource_id, json_extract_scalar(metadata, '$.severity')
    ORDER BY discovered_at DESC
  EOT
}

resource "aws_athena_named_query" "dpia_status" {
  name        = "dpia-status-report"
  description = "Privacy Impact Assessment status report"
  database    = aws_glue_catalog_database.audit.name
  workgroup   = aws_athena_workgroup.audit.name

  query = <<-EOT
    -- DPIA Status Report
    -- Current status of all Privacy Impact Assessments
    SELECT
      resource_id as dpia_id,
      json_extract_scalar(MAX(metadata), '$.title') as title,
      json_extract_scalar(MAX(metadata), '$.status') as current_status,
      json_extract_scalar(MAX(metadata), '$.requiresConsultation') as requires_consultation,
      MIN(timestamp) as created_at,
      MAX(timestamp) as last_updated
    FROM ${aws_glue_catalog_database.audit.name}.audit_events
    WHERE event_category = 'dpia'
    GROUP BY resource_id
    ORDER BY last_updated DESC
  EOT
}

resource "aws_athena_named_query" "entity_privacy_summary" {
  name        = "entity-privacy-summary"
  description = "Privacy activity summary by entity"
  database    = aws_glue_catalog_database.audit.name
  workgroup   = aws_athena_workgroup.audit.name

  query = <<-EOT
    -- Entity Privacy Summary
    -- Overview of privacy activities per entity
    SELECT
      entity_id,
      COUNT(CASE WHEN event_category = 'consent' THEN 1 END) as consent_events,
      COUNT(CASE WHEN event_category = 'dsar' THEN 1 END) as dsar_events,
      COUNT(CASE WHEN event_category = 'breach' THEN 1 END) as breach_events,
      COUNT(CASE WHEN event_category = 'dpia' THEN 1 END) as dpia_events,
      COUNT(DISTINCT subject_id) as unique_subjects,
      MIN(timestamp) as first_activity,
      MAX(timestamp) as last_activity
    FROM ${aws_glue_catalog_database.audit.name}.audit_events
    WHERE year = YEAR(CURRENT_DATE)
    GROUP BY entity_id
    ORDER BY consent_events + dsar_events + breach_events + dpia_events DESC
  EOT
}
