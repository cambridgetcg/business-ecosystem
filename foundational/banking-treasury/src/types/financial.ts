/**
 * Local type definitions
 * These mirror @ecosystem/contracts-financial for standalone development
 * In production, these come from the shared workspace package
 */

export interface Money {
  amount: number;
  currency: string;
}

export type CurrencyCode = string;

export type BankAccountType = 'checking' | 'savings' | 'money_market' | 'certificate_of_deposit';
export type BankAccountStatus = 'active' | 'inactive' | 'closed' | 'frozen';
export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'reversed';

/**
 * Payment methods including all supported rails.
 * Extended to support multi-rail orchestration.
 */
export type PaymentMethod =
  | 'bank_transfer'
  | 'ach'
  | 'same_day_ach'
  | 'wire'
  | 'swift'
  | 'swift_gpi'
  | 'rtp'
  | 'fednow'
  | 'sepa'
  | 'sepa_instant'
  | 'chaps'
  | 'stablecoin'
  | 'check'
  | 'credit_card'
  | 'debit_card';

/**
 * Payment urgency level affects routing priority and score weighting.
 */
export type PaymentUrgency = 'standard' | 'urgent' | 'critical';

/**
 * ISO 20022-aligned payment failure codes.
 * @see docs/research/nuances/11_PAYMENT_FAILURE_RECOVERY.md
 */
export type PaymentFailureCode =
  | 'AC04'    // Account closed
  | 'AM04'    // Insufficient funds
  | 'BE04'    // Missing creditor address
  | 'RC01'    // Bank identifier incorrect
  | 'CUST'    // Customer request
  | 'NARR'    // Narrative/other
  | 'TECH'    // Technical failure
  | 'COMP'    // Compliance block
  | 'CUTOFF'  // Missed cutoff
  | 'TIMEOUT'; // Processing timeout

/**
 * Extended payment status values for multi-rail processing.
 */
export type ExtendedPaymentStatus =
  | 'draft'             // Initial creation
  | 'pending_approval'  // Awaiting approval
  | 'approved'          // Approved, awaiting routing
  | 'pending'           // Ready for processing
  | 'routing'           // Rail selection in progress
  | 'processing'        // Submitted to payment network
  | 'completed'         // Successfully settled
  | 'failed'            // Failed with error
  | 'cancelled'         // Cancelled before processing
  | 'recalled'          // Successfully recalled
  | 'reversed';         // Reversed after completion
