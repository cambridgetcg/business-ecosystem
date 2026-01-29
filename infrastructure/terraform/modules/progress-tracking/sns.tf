################################################################################
# Progress Tracking Module - SNS Topics
################################################################################

# Topic for milestone completions
resource "aws_sns_topic" "milestones" {
  name = "${local.name_prefix}-milestones"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-milestones"
  })
}

resource "aws_sns_topic_policy" "milestones" {
  arn = aws_sns_topic.milestones.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaPublish"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.milestones.arn
        Condition = {
          ArnLike = {
            "aws:SourceArn" = "arn:aws:lambda:${var.aws_region}:*:function:${local.name_prefix}-*"
          }
        }
      }
    ]
  })
}

# Topic for new blockers
resource "aws_sns_topic" "blockers" {
  name = "${local.name_prefix}-blockers"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-blockers"
  })
}

resource "aws_sns_topic_policy" "blockers" {
  arn = aws_sns_topic.blockers.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaPublish"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.blockers.arn
        Condition = {
          ArnLike = {
            "aws:SourceArn" = "arn:aws:lambda:${var.aws_region}:*:function:${local.name_prefix}-*"
          }
        }
      }
    ]
  })
}

# Topic for weekly summaries
resource "aws_sns_topic" "weekly" {
  name = "${local.name_prefix}-weekly"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-weekly"
  })
}

resource "aws_sns_topic_policy" "weekly" {
  arn = aws_sns_topic.weekly.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaPublish"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.weekly.arn
        Condition = {
          ArnLike = {
            "aws:SourceArn" = "arn:aws:lambda:${var.aws_region}:*:function:${local.name_prefix}-*"
          }
        }
      }
    ]
  })
}

# Topic for alerts (regressions, stale apps)
resource "aws_sns_topic" "alerts" {
  name = "${local.name_prefix}-alerts"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alerts"
  })
}

resource "aws_sns_topic_policy" "alerts" {
  arn = aws_sns_topic.alerts.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaPublish"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.alerts.arn
        Condition = {
          ArnLike = {
            "aws:SourceArn" = "arn:aws:lambda:${var.aws_region}:*:function:${local.name_prefix}-*"
          }
        }
      },
      {
        Sid    = "AllowCloudWatchAlarms"
        Effect = "Allow"
        Principal = {
          Service = "cloudwatch.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.alerts.arn
      }
    ]
  })
}

# Optional: Direct email subscription for alerts (high priority)
resource "aws_sns_topic_subscription" "alerts_email" {
  count = var.notification_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.notification_email
}
