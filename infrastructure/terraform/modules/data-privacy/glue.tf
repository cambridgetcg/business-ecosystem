# =============================================================================
# AWS Glue Catalog for Audit Data
# =============================================================================
# Provides schema for Firehose Parquet conversion and Athena queries

# -----------------------------------------------------------------------------
# Glue Catalog Database
# -----------------------------------------------------------------------------

resource "aws_glue_catalog_database" "audit" {
  name        = replace("${local.name_prefix}_audit", "-", "_")
  description = "Data Privacy audit log database"

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Audit Events Table Schema
# -----------------------------------------------------------------------------

resource "aws_glue_catalog_table" "audit_events" {
  name          = "audit_events"
  database_name = aws_glue_catalog_database.audit.name
  description   = "Privacy audit events (consent, DSAR, breach, DPIA)"

  table_type = "EXTERNAL_TABLE"

  parameters = {
    "classification"        = "parquet"
    "parquet.compression"   = "SNAPPY"
    "projection.enabled"    = "true"
    "projection.year.type"  = "integer"
    "projection.year.range" = "2024,2030"
    "projection.month.type" = "integer"
    "projection.month.range" = "1,12"
    "projection.day.type"   = "integer"
    "projection.day.range"  = "1,31"
    "storage.location.template" = "s3://${aws_s3_bucket.audit.id}/audit/year=$${year}/month=$${month}/day=$${day}/"
  }

  storage_descriptor {
    location      = "s3://${aws_s3_bucket.audit.id}/audit/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"

    ser_de_info {
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
      parameters = {
        "serialization.format" = "1"
      }
    }

    # Audit event schema
    columns {
      name = "event_id"
      type = "string"
    }

    columns {
      name = "event_type"
      type = "string"
    }

    columns {
      name = "event_category"
      type = "string"
    }

    columns {
      name = "entity_id"
      type = "string"
    }

    columns {
      name = "subject_id"
      type = "string"
    }

    columns {
      name = "resource_id"
      type = "string"
    }

    columns {
      name = "resource_type"
      type = "string"
    }

    columns {
      name = "action"
      type = "string"
    }

    columns {
      name = "actor_id"
      type = "string"
    }

    columns {
      name = "actor_type"
      type = "string"
    }

    columns {
      name = "timestamp"
      type = "timestamp"
    }

    columns {
      name = "metadata"
      type = "string"
    }

    columns {
      name = "ip_address"
      type = "string"
    }

    columns {
      name = "user_agent"
      type = "string"
    }

    columns {
      name = "correlation_id"
      type = "string"
    }
  }

  # Partition keys for efficient querying
  partition_keys {
    name = "year"
    type = "int"
  }

  partition_keys {
    name = "month"
    type = "int"
  }

  partition_keys {
    name = "day"
    type = "int"
  }
}

# -----------------------------------------------------------------------------
# Consent Events View
# -----------------------------------------------------------------------------

resource "aws_glue_catalog_table" "consent_events" {
  name          = "consent_events"
  database_name = aws_glue_catalog_database.audit.name
  description   = "Consent grant/withdrawal events (GDPR Art. 6-7)"

  table_type = "VIRTUAL_VIEW"

  parameters = {
    "presto_view" = "true"
  }

  storage_descriptor {
    columns {
      name = "event_id"
      type = "string"
    }
    columns {
      name = "event_type"
      type = "string"
    }
    columns {
      name = "subject_id"
      type = "string"
    }
    columns {
      name = "consent_type"
      type = "string"
    }
    columns {
      name = "action"
      type = "string"
    }
    columns {
      name = "timestamp"
      type = "timestamp"
    }
  }

  view_original_text = "/* Presto View: consent_events */"
  view_expanded_text = <<-EOT
    SELECT
      event_id,
      event_type,
      subject_id,
      json_extract_scalar(metadata, '$.consentType') as consent_type,
      action,
      timestamp
    FROM ${aws_glue_catalog_database.audit.name}.audit_events
    WHERE event_category = 'consent'
  EOT
}

# -----------------------------------------------------------------------------
# DSAR Events View
# -----------------------------------------------------------------------------

resource "aws_glue_catalog_table" "dsar_events" {
  name          = "dsar_events"
  database_name = aws_glue_catalog_database.audit.name
  description   = "Data Subject Access Request events (GDPR Art. 15-22)"

  table_type = "VIRTUAL_VIEW"

  parameters = {
    "presto_view" = "true"
  }

  storage_descriptor {
    columns {
      name = "event_id"
      type = "string"
    }
    columns {
      name = "request_id"
      type = "string"
    }
    columns {
      name = "request_type"
      type = "string"
    }
    columns {
      name = "subject_id"
      type = "string"
    }
    columns {
      name = "status"
      type = "string"
    }
    columns {
      name = "timestamp"
      type = "timestamp"
    }
  }

  view_original_text = "/* Presto View: dsar_events */"
  view_expanded_text = <<-EOT
    SELECT
      event_id,
      resource_id as request_id,
      json_extract_scalar(metadata, '$.requestType') as request_type,
      subject_id,
      json_extract_scalar(metadata, '$.status') as status,
      timestamp
    FROM ${aws_glue_catalog_database.audit.name}.audit_events
    WHERE event_category = 'dsar'
  EOT
}

# -----------------------------------------------------------------------------
# Breach Events View
# -----------------------------------------------------------------------------

resource "aws_glue_catalog_table" "breach_events" {
  name          = "breach_events"
  database_name = aws_glue_catalog_database.audit.name
  description   = "Data breach events (GDPR Art. 33-34)"

  table_type = "VIRTUAL_VIEW"

  parameters = {
    "presto_view" = "true"
  }

  storage_descriptor {
    columns {
      name = "event_id"
      type = "string"
    }
    columns {
      name = "breach_id"
      type = "string"
    }
    columns {
      name = "severity"
      type = "string"
    }
    columns {
      name = "status"
      type = "string"
    }
    columns {
      name = "authority_notified"
      type = "boolean"
    }
    columns {
      name = "timestamp"
      type = "timestamp"
    }
  }

  view_original_text = "/* Presto View: breach_events */"
  view_expanded_text = <<-EOT
    SELECT
      event_id,
      resource_id as breach_id,
      json_extract_scalar(metadata, '$.severity') as severity,
      json_extract_scalar(metadata, '$.status') as status,
      CAST(json_extract_scalar(metadata, '$.authorityNotified') AS boolean) as authority_notified,
      timestamp
    FROM ${aws_glue_catalog_database.audit.name}.audit_events
    WHERE event_category = 'breach'
  EOT
}

# -----------------------------------------------------------------------------
# Glue Crawler (optional, for schema evolution)
# -----------------------------------------------------------------------------

resource "aws_iam_role" "glue_crawler" {
  name = "${local.name_prefix}-glue-crawler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "glue.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "glue_service" {
  role       = aws_iam_role.glue_crawler.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole"
}

resource "aws_iam_role_policy" "glue_s3" {
  name = "${local.name_prefix}-glue-s3-policy"
  role = aws_iam_role.glue_crawler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.audit.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = aws_kms_key.data_privacy.arn
      }
    ]
  })
}

resource "aws_glue_crawler" "audit" {
  name          = "${local.name_prefix}-audit-crawler"
  database_name = aws_glue_catalog_database.audit.name
  role          = aws_iam_role.glue_crawler.arn

  s3_target {
    path = "s3://${aws_s3_bucket.audit.id}/audit/"
  }

  schema_change_policy {
    delete_behavior = "LOG"
    update_behavior = "LOG"
  }

  configuration = jsonencode({
    Version = 1.0
    Grouping = {
      TableGroupingPolicy = "CombineCompatibleSchemas"
    }
  })

  tags = local.common_tags
}
