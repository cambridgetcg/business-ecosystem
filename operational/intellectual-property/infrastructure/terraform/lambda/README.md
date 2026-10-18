# Lambda Deployment Packages

This directory contains Lambda deployment packages for the IP service.

## Building the Deadline Escalation Lambda

The `deadline-escalation.zip` package should be built from the TypeScript source:

```bash
# From the intellectual-property directory
cd /Users/yournameisai/Desktop/business-ecosystem/operational/intellectual-property

# Install dependencies
pnpm install

# Build the Lambda
pnpm build

# Package for deployment
cd dist/lambdas/deadline-escalation
zip -r ../../../infrastructure/terraform/lambda/deadline-escalation.zip .
```

## CI/CD Integration

In a production setup, the Lambda package should be:

1. Built by CI/CD pipeline
2. Uploaded to S3 with versioning
3. Referenced by Terraform using S3 bucket/key instead of local file

Example Terraform modification for S3-based deployment:

```hcl
resource "aws_lambda_function" "deadline_escalation" {
  # ... other config ...

  s3_bucket = "your-deployment-bucket"
  s3_key    = "lambdas/deadline-escalation/${var.lambda_version}.zip"

  # Remove filename and source_code_hash
}
```

## Local Development

For local testing, you can use AWS SAM or the Serverless Framework:

```bash
# Using SAM
sam local invoke DeadlineEscalation -e events/stream-event.json

# Using Serverless
serverless invoke local --function deadlineEscalation --data '{"Records": []}'
```
