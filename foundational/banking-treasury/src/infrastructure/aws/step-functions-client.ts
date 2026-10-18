/**
 * Step Functions Client
 *
 * Starts and manages Step Functions workflow executions for payment processing.
 *
 * @module infrastructure/aws
 */

import {
  SFNClient,
  StartExecutionCommand,
  DescribeExecutionCommand,
  SendTaskSuccessCommand,
  SendTaskFailureCommand,
  type ExecutionStatus,
} from '@aws-sdk/client-sfn';
import { awsConfig } from './config.js';

const client = new SFNClient({ region: awsConfig.region });

/**
 * Payment workflow input.
 */
export interface PaymentWorkflowInput {
  paymentId: string;
  amount: number;
  currency: string;
  sourceAccount: {
    accountId: string;
    bankId: string;
    accountNumber: string;
  };
  destinationAccount: {
    accountId?: string | undefined;
    bankId: string;
    accountNumber: string;
    routingNumber?: string | undefined;
    iban?: string | undefined;
    swiftCode?: string | undefined;
  };
  urgency?: 'standard' | 'same_day' | 'instant' | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Workflow execution result.
 */
export interface WorkflowExecution {
  executionArn: string;
  executionId: string;
  startDate: Date;
}

/**
 * Workflow status.
 */
export interface WorkflowStatus {
  executionArn: string;
  status: ExecutionStatus;
  startDate: Date;
  stopDate?: Date | undefined;
  input: string;
  output?: string | undefined;
  error?: string | undefined;
  cause?: string | undefined;
}

/**
 * Approval callback input.
 */
export interface ApprovalCallbackInput {
  taskToken: string;
  approved: boolean;
  approvedBy?: string | undefined;
  rejectedBy?: string | undefined;
  reason?: string | undefined;
}

/**
 * Step Functions Client for Payment Workflows
 */
export class StepFunctionsClient {
  private readonly stateMachineArn: string;

  constructor(stateMachineArn?: string) {
    this.stateMachineArn = stateMachineArn ?? awsConfig.stepFunctions.paymentWorkflowArn;
  }

  /**
   * Start a payment workflow execution.
   */
  async startPaymentWorkflow(input: PaymentWorkflowInput): Promise<WorkflowExecution> {
    const executionName = `payment-${input.paymentId}-${Date.now()}`;

    const command = new StartExecutionCommand({
      stateMachineArn: this.stateMachineArn,
      name: executionName,
      input: JSON.stringify(input),
    });

    const response = await client.send(command);

    if (!response.executionArn || !response.startDate) {
      throw new Error('Failed to start workflow execution');
    }

    return {
      executionArn: response.executionArn,
      executionId: executionName,
      startDate: response.startDate,
    };
  }

  /**
   * Get the status of a workflow execution.
   */
  async getExecutionStatus(executionArn: string): Promise<WorkflowStatus> {
    const command = new DescribeExecutionCommand({
      executionArn,
    });

    const response = await client.send(command);

    return {
      executionArn: response.executionArn ?? executionArn,
      status: response.status ?? 'RUNNING',
      startDate: response.startDate ?? new Date(),
      stopDate: response.stopDate,
      input: response.input ?? '{}',
      output: response.output,
      error: response.error,
      cause: response.cause,
    };
  }

  /**
   * Complete an approval task (approve or reject).
   */
  async completeApprovalTask(input: ApprovalCallbackInput): Promise<void> {
    if (input.approved) {
      const command = new SendTaskSuccessCommand({
        taskToken: input.taskToken,
        output: JSON.stringify({
          approved: true,
          approvedBy: input.approvedBy,
          approvedAt: new Date().toISOString(),
        }),
      });
      await client.send(command);
    } else {
      const command = new SendTaskFailureCommand({
        taskToken: input.taskToken,
        error: 'ApprovalRejected',
        cause: JSON.stringify({
          approved: false,
          rejectedBy: input.rejectedBy,
          reason: input.reason,
          rejectedAt: new Date().toISOString(),
        }),
      });
      await client.send(command);
    }
  }

  /**
   * Complete a compliance review task.
   */
  async completeComplianceReview(
    taskToken: string,
    approved: boolean,
    reviewedBy: string,
    notes?: string
  ): Promise<void> {
    if (approved) {
      const command = new SendTaskSuccessCommand({
        taskToken,
        output: JSON.stringify({
          approved: true,
          reviewedBy,
          notes,
          reviewedAt: new Date().toISOString(),
        }),
      });
      await client.send(command);
    } else {
      const command = new SendTaskFailureCommand({
        taskToken,
        error: 'ComplianceRejected',
        cause: JSON.stringify({
          approved: false,
          reviewedBy,
          notes,
          reviewedAt: new Date().toISOString(),
        }),
      });
      await client.send(command);
    }
  }

  /**
   * Check if an execution is still running.
   */
  async isRunning(executionArn: string): Promise<boolean> {
    const status = await this.getExecutionStatus(executionArn);
    return status.status === 'RUNNING';
  }

  /**
   * Check if an execution completed successfully.
   */
  async isSuccessful(executionArn: string): Promise<boolean> {
    const status = await this.getExecutionStatus(executionArn);
    return status.status === 'SUCCEEDED';
  }

  /**
   * Get the output of a completed execution.
   */
  async getExecutionOutput<T>(executionArn: string): Promise<T | null> {
    const status = await this.getExecutionStatus(executionArn);

    if (status.status !== 'SUCCEEDED' || !status.output) {
      return null;
    }

    return JSON.parse(status.output) as T;
  }
}

// Singleton instance
export const stepFunctionsClient = new StepFunctionsClient();
