-- Migration: Payment Extensions
-- Date: 2026-01-27
-- Description: Extends payments table with routing and tracking capabilities
-- Dependencies: 20260127_001_payment_rails.sql

-- =============================================================================
-- EXTEND PAYMENTS TABLE
-- Add columns for multi-rail routing, tracking, and enhanced status
-- =============================================================================

-- Add new columns for routing and tracking
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS source_account_id UUID,
  ADD COLUMN IF NOT EXISTS destination_account_id UUID,
  ADD COLUMN IF NOT EXISTS rail_id UUID REFERENCES payment_rails(id),
  ADD COLUMN IF NOT EXISTS routing_decision_id UUID REFERENCES routing_decisions(id),
  ADD COLUMN IF NOT EXISTS requested_execution_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS scheduled_settlement TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cutoff_deadline TIMESTAMP,
  ADD COLUMN IF NOT EXISTS actual_settlement TIMESTAMP,
  ADD COLUMN IF NOT EXISTS gpi_uetr VARCHAR(36),
  ADD COLUMN IF NOT EXISTS external_reference VARCHAR(100),
  ADD COLUMN IF NOT EXISTS failure_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS recall_id UUID,
  ADD COLUMN IF NOT EXISTS inquiry_id UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- =============================================================================
-- UPDATE STATUS CONSTRAINT
-- Allow extended payment status values
-- =============================================================================

-- First drop existing constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_payment_status'
    AND table_name = 'payments'
  ) THEN
    ALTER TABLE payments DROP CONSTRAINT chk_payment_status;
  END IF;
END $$;

-- Add new status constraint with extended values
ALTER TABLE payments
  ADD CONSTRAINT chk_payment_status CHECK (
    status IN (
      'draft', 'pending_approval', 'approved', 'pending',
      'routing', 'processing', 'completed', 'failed',
      'cancelled', 'recalled', 'reversed'
    )
  );

-- Add urgency constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_payment_urgency'
    AND table_name = 'payments'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT chk_payment_urgency CHECK (
        urgency IS NULL OR urgency IN ('standard', 'urgent', 'critical')
      );
  END IF;
END $$;

-- Add failure code constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_payment_failure_code'
    AND table_name = 'payments'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT chk_payment_failure_code CHECK (
        failure_code IS NULL OR failure_code IN (
          'AC04', 'AM04', 'BE04', 'RC01', 'CUST',
          'NARR', 'TECH', 'COMP', 'CUTOFF', 'TIMEOUT'
        )
      );
  END IF;
END $$;

-- =============================================================================
-- NEW INDEXES
-- Optimize queries for routing and tracking
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_payments_rail ON payments(rail_id);
CREATE INDEX IF NOT EXISTS idx_payments_urgency ON payments(urgency);
CREATE INDEX IF NOT EXISTS idx_payments_scheduled_settlement ON payments(scheduled_settlement);
CREATE INDEX IF NOT EXISTS idx_payments_gpi_uetr ON payments(gpi_uetr);
CREATE INDEX IF NOT EXISTS idx_payments_external_ref ON payments(external_reference);
CREATE INDEX IF NOT EXISTS idx_payments_source_account ON payments(source_account_id);
CREATE INDEX IF NOT EXISTS idx_payments_dest_account ON payments(destination_account_id);
CREATE INDEX IF NOT EXISTS idx_payments_failure_code ON payments(failure_code) WHERE failure_code IS NOT NULL;

-- =============================================================================
-- COLUMN COMMENTS
-- =============================================================================

COMMENT ON COLUMN payments.urgency IS 'Payment urgency level affecting routing priority';
COMMENT ON COLUMN payments.rail_id IS 'Selected payment rail for execution';
COMMENT ON COLUMN payments.routing_decision_id IS 'Reference to routing decision audit record';
COMMENT ON COLUMN payments.gpi_uetr IS 'SWIFT gpi Unique End-to-End Transaction Reference';
COMMENT ON COLUMN payments.external_reference IS 'Bank-assigned reference number';
COMMENT ON COLUMN payments.failure_code IS 'ISO 20022-aligned failure reason code';
COMMENT ON COLUMN payments.recall_id IS 'Reference to recall request if payment is being recalled';
COMMENT ON COLUMN payments.inquiry_id IS 'Reference to open inquiry if payment is under investigation';
