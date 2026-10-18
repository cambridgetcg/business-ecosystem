################################################################################
# Step Functions - Payment Workflow Orchestration
################################################################################
#
# State machine for payment processing with:
# - Validation
# - Compliance screening
# - Approval workflow (for amounts above threshold)
# - Rail selection and execution
# - Retry handling with exponential backoff
# - Event publishing
#
################################################################################

################################################################################
# Payment Workflow State Machine
################################################################################

resource "aws_sfn_state_machine" "payment_workflow" {
  count = var.enable_payment_workflow ? 1 : 0

  name     = "${local.name_prefix}-payment-workflow"
  role_arn = aws_iam_role.step_functions[0].arn

  definition = jsonencode({
    Comment = "Banking-Treasury Payment Processing Workflow"
    StartAt = "ValidatePayment"

    States = {
      # Step 1: Validate payment request
      ValidatePayment = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.validate_payment[0].arn
          Payload = {
            "paymentId.$"   = "$.paymentId"
            "amount.$"      = "$.amount"
            "currency.$"    = "$.currency"
            "sourceAccount.$" = "$.sourceAccount"
            "destinationAccount.$" = "$.destinationAccount"
            "metadata.$"    = "$.metadata"
          }
        }
        ResultPath = "$.validation"
        Next       = "CheckValidation"
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            ResultPath  = "$.error"
            Next        = "PaymentFailed"
          }
        ]
      }

      # Step 2: Check validation result
      CheckValidation = {
        Type = "Choice"
        Choices = [
          {
            Variable      = "$.validation.Payload.valid"
            BooleanEquals = true
            Next          = "CheckCompliance"
          }
        ]
        Default = "ValidationFailed"
      }

      ValidationFailed = {
        Type  = "Task"
        Resource = "arn:aws:states:::events:putEvents"
        Parameters = {
          Entries = [
            {
              Source     = "banking-treasury"
              DetailType = "Payment.ValidationFailed"
              EventBusName = aws_cloudwatch_event_bus.banking_treasury.name
              Detail = {
                "paymentId.$" = "$.paymentId"
                "errors.$"    = "$.validation.Payload.errors"
              }
            }
          ]
        }
        Next = "PaymentFailed"
      }

      # Step 3: Compliance screening
      CheckCompliance = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.check_compliance[0].arn
          Payload = {
            "paymentId.$"   = "$.paymentId"
            "amount.$"      = "$.amount"
            "currency.$"    = "$.currency"
            "sourceAccount.$" = "$.sourceAccount"
            "destinationAccount.$" = "$.destinationAccount"
          }
        }
        ResultPath = "$.compliance"
        Next       = "EvaluateCompliance"
        Retry = [
          {
            ErrorEquals     = ["Lambda.ServiceException", "Lambda.TooManyRequestsException"]
            IntervalSeconds = 2
            MaxAttempts     = 3
            BackoffRate     = 2
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            ResultPath  = "$.error"
            Next        = "ComplianceCheckFailed"
          }
        ]
      }

      # Step 4: Evaluate compliance result
      EvaluateCompliance = {
        Type = "Choice"
        Choices = [
          {
            Variable      = "$.compliance.Payload.blocked"
            BooleanEquals = true
            Next          = "ComplianceBlocked"
          },
          {
            Variable      = "$.compliance.Payload.requiresReview"
            BooleanEquals = true
            Next          = "ComplianceReview"
          }
        ]
        Default = "CheckApprovalRequired"
      }

      ComplianceBlocked = {
        Type  = "Task"
        Resource = "arn:aws:states:::events:putEvents"
        Parameters = {
          Entries = [
            {
              Source     = "banking-treasury"
              DetailType = "Payment.ComplianceBlocked"
              EventBusName = aws_cloudwatch_event_bus.banking_treasury.name
              Detail = {
                "paymentId.$" = "$.paymentId"
                "reason.$"    = "$.compliance.Payload.reason"
                "findings.$"  = "$.compliance.Payload.findings"
              }
            }
          ]
        }
        Next = "PaymentFailed"
      }

      ComplianceReview = {
        Type = "Task"
        Resource = "arn:aws:states:::sqs:sendMessage.waitForTaskToken"
        Parameters = {
          QueueUrl = aws_sqs_queue.compliance_review[0].url
          MessageBody = {
            "paymentId.$"   = "$.paymentId"
            "taskToken.$"   = "$$.Task.Token"
            "findings.$"    = "$.compliance.Payload.findings"
            "riskScore.$"   = "$.compliance.Payload.riskScore"
          }
        }
        ResultPath  = "$.complianceReview"
        TimeoutSeconds = 86400  # 24 hours
        Next = "CheckComplianceReviewResult"
        Catch = [
          {
            ErrorEquals = ["States.Timeout"]
            ResultPath  = "$.error"
            Next        = "ComplianceReviewTimeout"
          }
        ]
      }

      ComplianceReviewTimeout = {
        Type  = "Task"
        Resource = "arn:aws:states:::events:putEvents"
        Parameters = {
          Entries = [
            {
              Source     = "banking-treasury"
              DetailType = "Payment.ComplianceReviewTimeout"
              EventBusName = aws_cloudwatch_event_bus.banking_treasury.name
              Detail = {
                "paymentId.$" = "$.paymentId"
              }
            }
          ]
        }
        Next = "PaymentFailed"
      }

      CheckComplianceReviewResult = {
        Type = "Choice"
        Choices = [
          {
            Variable      = "$.complianceReview.approved"
            BooleanEquals = true
            Next          = "CheckApprovalRequired"
          }
        ]
        Default = "ComplianceBlocked"
      }

      ComplianceCheckFailed = {
        Type  = "Task"
        Resource = "arn:aws:states:::events:putEvents"
        Parameters = {
          Entries = [
            {
              Source     = "banking-treasury"
              DetailType = "Payment.ComplianceCheckFailed"
              EventBusName = aws_cloudwatch_event_bus.banking_treasury.name
              Detail = {
                "paymentId.$" = "$.paymentId"
                "error.$"     = "$.error"
              }
            }
          ]
        }
        Next = "PaymentFailed"
      }

      # Step 5: Check if approval is required
      CheckApprovalRequired = {
        Type = "Choice"
        Choices = [
          {
            Variable          = "$.amount"
            NumericGreaterThan = 10000
            Next              = "WaitForApproval"
          }
        ]
        Default = "SelectPaymentRail"
      }

      # Step 6: Wait for manual approval
      WaitForApproval = {
        Type  = "Task"
        Resource = "arn:aws:states:::events:putEvents"
        Parameters = {
          Entries = [
            {
              Source     = "banking-treasury"
              DetailType = "Payment.ApprovalRequired"
              EventBusName = aws_cloudwatch_event_bus.banking_treasury.name
              Detail = {
                "paymentId.$" = "$.paymentId"
                "amount.$"    = "$.amount"
                "currency.$"  = "$.currency"
              }
            }
          ]
        }
        ResultPath = null
        Next       = "WaitForApprovalCallback"
      }

      WaitForApprovalCallback = {
        Type = "Task"
        Resource = "arn:aws:states:::sqs:sendMessage.waitForTaskToken"
        Parameters = {
          QueueUrl = aws_sqs_queue.payment_approval[0].url
          MessageBody = {
            "paymentId.$" = "$.paymentId"
            "taskToken.$" = "$$.Task.Token"
            "amount.$"    = "$.amount"
            "currency.$"  = "$.currency"
          }
        }
        ResultPath     = "$.approval"
        TimeoutSeconds = var.payment_approval_timeout_hours * 3600
        Next           = "CheckApprovalResult"
        Catch = [
          {
            ErrorEquals = ["States.Timeout"]
            ResultPath  = "$.error"
            Next        = "ApprovalTimeout"
          }
        ]
      }

      ApprovalTimeout = {
        Type  = "Task"
        Resource = "arn:aws:states:::events:putEvents"
        Parameters = {
          Entries = [
            {
              Source     = "banking-treasury"
              DetailType = "Payment.ApprovalTimeout"
              EventBusName = aws_cloudwatch_event_bus.banking_treasury.name
              Detail = {
                "paymentId.$" = "$.paymentId"
              }
            }
          ]
        }
        Next = "PaymentFailed"
      }

      CheckApprovalResult = {
        Type = "Choice"
        Choices = [
          {
            Variable      = "$.approval.approved"
            BooleanEquals = true
            Next          = "SelectPaymentRail"
          }
        ]
        Default = "PaymentRejected"
      }

      PaymentRejected = {
        Type  = "Task"
        Resource = "arn:aws:states:::events:putEvents"
        Parameters = {
          Entries = [
            {
              Source     = "banking-treasury"
              DetailType = "Payment.Rejected"
              EventBusName = aws_cloudwatch_event_bus.banking_treasury.name
              Detail = {
                "paymentId.$"  = "$.paymentId"
                "rejectedBy.$" = "$.approval.rejectedBy"
                "reason.$"     = "$.approval.reason"
              }
            }
          ]
        }
        Next = "PaymentFailed"
      }

      # Step 7: Select optimal payment rail
      SelectPaymentRail = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.select_rail[0].arn
          Payload = {
            "paymentId.$"   = "$.paymentId"
            "amount.$"      = "$.amount"
            "currency.$"    = "$.currency"
            "sourceAccount.$" = "$.sourceAccount"
            "destinationAccount.$" = "$.destinationAccount"
            "urgency.$"     = "$.urgency"
          }
        }
        ResultPath = "$.railSelection"
        Next       = "ExecutePayment"
        Retry = [
          {
            ErrorEquals     = ["Lambda.ServiceException"]
            IntervalSeconds = 1
            MaxAttempts     = 3
            BackoffRate     = 2
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            ResultPath  = "$.error"
            Next        = "PaymentFailed"
          }
        ]
      }

      # Step 8: Execute payment via selected rail
      ExecutePayment = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.execute_payment[0].arn
          Payload = {
            "paymentId.$"   = "$.paymentId"
            "amount.$"      = "$.amount"
            "currency.$"    = "$.currency"
            "sourceAccount.$" = "$.sourceAccount"
            "destinationAccount.$" = "$.destinationAccount"
            "railId.$"      = "$.railSelection.Payload.selectedRailId"
            "railConfig.$"  = "$.railSelection.Payload.railConfig"
          }
        }
        ResultPath = "$.execution"
        Next       = "CheckExecutionResult"
        Retry = [
          {
            ErrorEquals     = ["PaymentRetryableError"]
            IntervalSeconds = var.payment_retry_interval_seconds
            MaxAttempts     = var.payment_retry_max_attempts
            BackoffRate     = 2
          }
        ]
        Catch = [
          {
            ErrorEquals = ["PaymentPermanentError"]
            ResultPath  = "$.error"
            Next        = "PaymentFailed"
          },
          {
            ErrorEquals = ["States.ALL"]
            ResultPath  = "$.error"
            Next        = "TryFallbackRail"
          }
        ]
      }

      # Step 8b: Try fallback rail if primary fails
      TryFallbackRail = {
        Type = "Choice"
        Choices = [
          {
            Variable  = "$.railSelection.Payload.fallbackRailId"
            IsPresent = true
            Next      = "ExecuteFallbackPayment"
          }
        ]
        Default = "PaymentFailed"
      }

      ExecuteFallbackPayment = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.execute_payment[0].arn
          Payload = {
            "paymentId.$"   = "$.paymentId"
            "amount.$"      = "$.amount"
            "currency.$"    = "$.currency"
            "sourceAccount.$" = "$.sourceAccount"
            "destinationAccount.$" = "$.destinationAccount"
            "railId.$"      = "$.railSelection.Payload.fallbackRailId"
            "isFallback"    = true
          }
        }
        ResultPath = "$.execution"
        Next       = "CheckExecutionResult"
        Retry = [
          {
            ErrorEquals     = ["PaymentRetryableError"]
            IntervalSeconds = var.payment_retry_interval_seconds
            MaxAttempts     = var.payment_retry_max_attempts
            BackoffRate     = 2
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            ResultPath  = "$.error"
            Next        = "PaymentFailed"
          }
        ]
      }

      # Step 9: Check execution result
      CheckExecutionResult = {
        Type = "Choice"
        Choices = [
          {
            Variable      = "$.execution.Payload.status"
            StringEquals  = "completed"
            Next          = "PaymentCompleted"
          },
          {
            Variable      = "$.execution.Payload.status"
            StringEquals  = "pending"
            Next          = "WaitForSettlement"
          }
        ]
        Default = "PaymentFailed"
      }

      # Step 10: Wait for settlement (for async rails)
      WaitForSettlement = {
        Type    = "Wait"
        Seconds = 60
        Next    = "CheckSettlementStatus"
      }

      CheckSettlementStatus = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.check_settlement[0].arn
          Payload = {
            "paymentId.$"    = "$.paymentId"
            "externalRef.$"  = "$.execution.Payload.externalReference"
          }
        }
        ResultPath = "$.settlement"
        Next       = "EvaluateSettlement"
        Retry = [
          {
            ErrorEquals     = ["Lambda.ServiceException"]
            IntervalSeconds = 30
            MaxAttempts     = 5
            BackoffRate     = 1.5
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            ResultPath  = "$.error"
            Next        = "SettlementCheckFailed"
          }
        ]
      }

      EvaluateSettlement = {
        Type = "Choice"
        Choices = [
          {
            Variable      = "$.settlement.Payload.status"
            StringEquals  = "settled"
            Next          = "PaymentCompleted"
          },
          {
            Variable      = "$.settlement.Payload.status"
            StringEquals  = "failed"
            Next          = "PaymentFailed"
          },
          {
            Variable          = "$.settlement.Payload.checkCount"
            NumericGreaterThan = 10
            Next              = "SettlementTimeout"
          }
        ]
        Default = "WaitForSettlement"
      }

      SettlementTimeout = {
        Type  = "Task"
        Resource = "arn:aws:states:::events:putEvents"
        Parameters = {
          Entries = [
            {
              Source     = "banking-treasury"
              DetailType = "Payment.SettlementTimeout"
              EventBusName = aws_cloudwatch_event_bus.banking_treasury.name
              Detail = {
                "paymentId.$"   = "$.paymentId"
                "externalRef.$" = "$.execution.Payload.externalReference"
              }
            }
          ]
        }
        Next = "PaymentFailed"
      }

      SettlementCheckFailed = {
        Type  = "Task"
        Resource = "arn:aws:states:::events:putEvents"
        Parameters = {
          Entries = [
            {
              Source     = "banking-treasury"
              DetailType = "Payment.SettlementCheckFailed"
              EventBusName = aws_cloudwatch_event_bus.banking_treasury.name
              Detail = {
                "paymentId.$" = "$.paymentId"
                "error.$"     = "$.error"
              }
            }
          ]
        }
        Next = "PaymentFailed"
      }

      # Final States
      PaymentCompleted = {
        Type  = "Task"
        Resource = "arn:aws:states:::events:putEvents"
        Parameters = {
          Entries = [
            {
              Source     = "banking-treasury"
              DetailType = "Payment.Completed"
              EventBusName = aws_cloudwatch_event_bus.banking_treasury.name
              Detail = {
                "paymentId.$"   = "$.paymentId"
                "amount.$"      = "$.amount"
                "currency.$"    = "$.currency"
                "railId.$"      = "$.railSelection.Payload.selectedRailId"
                "externalRef.$" = "$.execution.Payload.externalReference"
              }
            }
          ]
        }
        ResultPath = null
        Next       = "Success"
      }

      PaymentFailed = {
        Type  = "Task"
        Resource = "arn:aws:states:::events:putEvents"
        Parameters = {
          Entries = [
            {
              Source     = "banking-treasury"
              DetailType = "Payment.Failed"
              EventBusName = aws_cloudwatch_event_bus.banking_treasury.name
              Detail = {
                "paymentId.$" = "$.paymentId"
                "error.$"     = "$.error"
              }
            }
          ]
        }
        ResultPath = null
        Next       = "Fail"
      }

      Success = {
        Type = "Succeed"
      }

      Fail = {
        Type  = "Fail"
        Error = "PaymentProcessingFailed"
        Cause = "Payment could not be completed"
      }
    }
  })

  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.step_functions[0].arn}:*"
    include_execution_data = true
    level                  = "ALL"
  }

  tracing_configuration {
    enabled = true
  }

  tags = local.common_tags
}

################################################################################
# CloudWatch Log Group for Step Functions
################################################################################

resource "aws_cloudwatch_log_group" "step_functions" {
  count = var.enable_payment_workflow ? 1 : 0

  name              = "/aws/states/${local.name_prefix}-payment-workflow"
  retention_in_days = 30

  tags = local.common_tags
}

################################################################################
# SQS Queues for Human Tasks
################################################################################

# Payment approval queue
resource "aws_sqs_queue" "payment_approval" {
  count = var.enable_payment_workflow ? 1 : 0

  name                       = "${local.name_prefix}-payment-approval"
  visibility_timeout_seconds = 300
  message_retention_seconds  = 86400  # 1 day
  receive_wait_time_seconds  = 20

  # Enable encryption
  sqs_managed_sse_enabled = true

  tags = local.common_tags
}

# Compliance review queue
resource "aws_sqs_queue" "compliance_review" {
  count = var.enable_payment_workflow ? 1 : 0

  name                       = "${local.name_prefix}-compliance-review"
  visibility_timeout_seconds = 300
  message_retention_seconds  = 86400
  receive_wait_time_seconds  = 20

  sqs_managed_sse_enabled = true

  tags = local.common_tags
}

# Dead letter queue for failed tasks
resource "aws_sqs_queue" "payment_dlq" {
  count = var.enable_payment_workflow ? 1 : 0

  name                      = "${local.name_prefix}-payment-dlq"
  message_retention_seconds = 1209600  # 14 days

  sqs_managed_sse_enabled = true

  tags = local.common_tags
}

################################################################################
# IAM Role for Step Functions
################################################################################

resource "aws_iam_role" "step_functions" {
  count = var.enable_payment_workflow ? 1 : 0

  name = "${local.name_prefix}-step-functions"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "step_functions" {
  count = var.enable_payment_workflow ? 1 : 0

  name = "step-functions-policy"
  role = aws_iam_role.step_functions[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          aws_lambda_function.validate_payment[0].arn,
          aws_lambda_function.check_compliance[0].arn,
          aws_lambda_function.select_rail[0].arn,
          aws_lambda_function.execute_payment[0].arn,
          aws_lambda_function.check_settlement[0].arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "events:PutEvents"
        ]
        Resource = aws_cloudwatch_event_bus.banking_treasury.arn
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage"
        ]
        Resource = [
          aws_sqs_queue.payment_approval[0].arn,
          aws_sqs_queue.compliance_review[0].arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogDelivery",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutLogEvents",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets"
        ]
        Resource = "*"
      }
    ]
  })
}

################################################################################
# Lambda Functions (Stubs - to be implemented)
################################################################################

# Common Lambda configuration
locals {
  lambda_runtime = "nodejs20.x"
  lambda_timeout = 30
  lambda_memory  = 256
}

# Validate Payment Lambda
resource "aws_lambda_function" "validate_payment" {
  count = var.enable_payment_workflow ? 1 : 0

  function_name = "${local.name_prefix}-validate-payment"
  role          = aws_iam_role.lambda_execution[0].arn
  handler       = "index.handler"
  runtime       = local.lambda_runtime
  timeout       = local.lambda_timeout
  memory_size   = local.lambda_memory

  filename         = data.archive_file.lambda_stub.output_path
  source_code_hash = data.archive_file.lambda_stub.output_base64sha256

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  tags = local.common_tags
}

# Check Compliance Lambda
resource "aws_lambda_function" "check_compliance" {
  count = var.enable_payment_workflow ? 1 : 0

  function_name = "${local.name_prefix}-check-compliance"
  role          = aws_iam_role.lambda_execution[0].arn
  handler       = "index.handler"
  runtime       = local.lambda_runtime
  timeout       = local.lambda_timeout
  memory_size   = local.lambda_memory

  filename         = data.archive_file.lambda_stub.output_path
  source_code_hash = data.archive_file.lambda_stub.output_base64sha256

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  tags = local.common_tags
}

# Select Rail Lambda
resource "aws_lambda_function" "select_rail" {
  count = var.enable_payment_workflow ? 1 : 0

  function_name = "${local.name_prefix}-select-rail"
  role          = aws_iam_role.lambda_execution[0].arn
  handler       = "index.handler"
  runtime       = local.lambda_runtime
  timeout       = local.lambda_timeout
  memory_size   = local.lambda_memory

  filename         = data.archive_file.lambda_stub.output_path
  source_code_hash = data.archive_file.lambda_stub.output_base64sha256

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  tags = local.common_tags
}

# Execute Payment Lambda
resource "aws_lambda_function" "execute_payment" {
  count = var.enable_payment_workflow ? 1 : 0

  function_name = "${local.name_prefix}-execute-payment"
  role          = aws_iam_role.lambda_execution[0].arn
  handler       = "index.handler"
  runtime       = local.lambda_runtime
  timeout       = 60  # Longer timeout for bank API calls
  memory_size   = 512

  filename         = data.archive_file.lambda_stub.output_path
  source_code_hash = data.archive_file.lambda_stub.output_base64sha256

  environment {
    variables = {
      ENVIRONMENT         = var.environment
      BANK_API_SECRET_ARN = aws_secretsmanager_secret.bank_api_credentials.arn
    }
  }

  tags = local.common_tags
}

# Check Settlement Lambda
resource "aws_lambda_function" "check_settlement" {
  count = var.enable_payment_workflow ? 1 : 0

  function_name = "${local.name_prefix}-check-settlement"
  role          = aws_iam_role.lambda_execution[0].arn
  handler       = "index.handler"
  runtime       = local.lambda_runtime
  timeout       = local.lambda_timeout
  memory_size   = local.lambda_memory

  filename         = data.archive_file.lambda_stub.output_path
  source_code_hash = data.archive_file.lambda_stub.output_base64sha256

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  tags = local.common_tags
}

# Lambda stub code
data "archive_file" "lambda_stub" {
  type        = "zip"
  output_path = "${path.module}/lambda_stub.zip"

  source {
    content  = <<-EOT
      exports.handler = async (event) => {
        console.log('Event:', JSON.stringify(event, null, 2));
        // Stub implementation - replace with actual code
        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'Stub implementation' })
        };
      };
    EOT
    filename = "index.js"
  }
}

# IAM Role for Lambda
resource "aws_iam_role" "lambda_execution" {
  count = var.enable_payment_workflow ? 1 : 0

  name = "${local.name_prefix}-lambda-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  count = var.enable_payment_workflow ? 1 : 0

  role       = aws_iam_role.lambda_execution[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_custom" {
  count = var.enable_payment_workflow ? 1 : 0

  name = "lambda-custom-policy"
  role = aws_iam_role.lambda_execution[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.bank_api_credentials.arn,
          aws_secretsmanager_secret.fx_provider.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "events:PutEvents"
        ]
        Resource = aws_cloudwatch_event_bus.banking_treasury.arn
      },
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      }
    ]
  })
}
