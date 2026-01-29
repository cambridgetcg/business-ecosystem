-- Migration: Payment Rails Foundation
-- Date: 2026-01-27
-- Description: Creates tables for multi-rail payment orchestration
-- Dependencies: None (foundation migration)

-- =============================================================================
-- PAYMENT RAILS TABLE
-- Stores payment network definitions with capabilities, costs, and availability
-- =============================================================================
CREATE TABLE IF NOT EXISTS payment_rails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  provider VARCHAR(100),
  corridors JSONB NOT NULL DEFAULT '[]',

  -- Cost structure
  cost_fixed_amount DECIMAL(20,4),
  cost_fixed_currency VARCHAR(3),
  cost_percentage DECIMAL(8,6) DEFAULT 0,
  cost_fx_spread DECIMAL(8,6),
  cost_minimum_amount DECIMAL(20,4),
  cost_minimum_currency VARCHAR(3),
  cost_maximum_amount DECIMAL(20,4),
  cost_maximum_currency VARCHAR(3),

  -- Settlement timing
  min_settlement_minutes INT NOT NULL,
  max_settlement_minutes INT NOT NULL,

  -- Availability schedule
  availability_24x7 BOOLEAN DEFAULT false,
  availability_days INT[],
  availability_hours_start TIME,
  availability_hours_end TIME,
  availability_timezone VARCHAR(50),

  -- Capabilities
  compliance_requirements TEXT[] DEFAULT '{}',
  supports_recall BOOLEAN DEFAULT false,
  supports_tracking BOOLEAN DEFAULT false,

  -- Limits
  max_amount DECIMAL(20,4),
  max_amount_currency VARCHAR(3),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT chk_rail_type CHECK (type IN (
    'swift', 'swift_gpi', 'ach', 'same_day_ach', 'rtp', 'fednow',
    'wire', 'chaps', 'sepa', 'sepa_instant', 'stablecoin_usdc',
    'stablecoin_usdt', 'local'
  )),
  CONSTRAINT chk_rail_status CHECK (status IN ('active', 'degraded', 'disabled'))
);

CREATE INDEX IF NOT EXISTS idx_payment_rails_type ON payment_rails(type);
CREATE INDEX IF NOT EXISTS idx_payment_rails_status ON payment_rails(status);

COMMENT ON TABLE payment_rails IS 'Payment network/rail definitions with capabilities and costs';
COMMENT ON COLUMN payment_rails.corridors IS 'JSONB array of supported currency/country corridors';
COMMENT ON COLUMN payment_rails.compliance_requirements IS 'Array of required compliance checks (e.g., BSA, OFAC, FATF)';

-- =============================================================================
-- HOLIDAY CALENDARS TABLE
-- Stores holiday dates for cutoff calculations
-- =============================================================================
CREATE TABLE IF NOT EXISTS holiday_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  country_code VARCHAR(3),
  bank_code VARCHAR(50),
  year INT NOT NULL,
  holidays DATE[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_calendar_per_year UNIQUE (country_code, bank_code, year)
);

CREATE INDEX IF NOT EXISTS idx_holiday_calendars_year ON holiday_calendars(year);
CREATE INDEX IF NOT EXISTS idx_holiday_calendars_country ON holiday_calendars(country_code);

COMMENT ON TABLE holiday_calendars IS 'Holiday dates by country/bank/year for business day calculations';

-- =============================================================================
-- CUTOFF WINDOWS TABLE
-- Bank-specific payment cutoff times for different rails and currencies
-- =============================================================================
CREATE TABLE IF NOT EXISTS cutoff_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL,
  rail_id UUID NOT NULL REFERENCES payment_rails(id) ON DELETE RESTRICT,
  currency VARCHAR(3) NOT NULL,
  cutoff_time TIME NOT NULL,
  timezone VARCHAR(50) NOT NULL,
  stp_adjustment_minutes INT NOT NULL DEFAULT 60,
  active_days INT[] NOT NULL DEFAULT '{1,2,3,4,5}',
  holiday_calendar_id UUID REFERENCES holiday_calendars(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_cutoff_per_bank_rail_currency UNIQUE (bank_id, rail_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_cutoff_windows_bank ON cutoff_windows(bank_id);
CREATE INDEX IF NOT EXISTS idx_cutoff_windows_rail ON cutoff_windows(rail_id);
CREATE INDEX IF NOT EXISTS idx_cutoff_windows_currency ON cutoff_windows(currency);

COMMENT ON TABLE cutoff_windows IS 'Bank-specific payment cutoff times by rail and currency';
COMMENT ON COLUMN cutoff_windows.stp_adjustment_minutes IS 'Minutes to subtract from cutoff for non-STP payments';
COMMENT ON COLUMN cutoff_windows.active_days IS 'Days of week when cutoff applies (0=Sunday, 6=Saturday)';

-- =============================================================================
-- ROUTING DECISIONS TABLE
-- Audit trail of payment routing decisions
-- =============================================================================
CREATE TABLE IF NOT EXISTS routing_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL,
  decision_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  urgency_level VARCHAR(20) NOT NULL DEFAULT 'standard',
  options_considered JSONB NOT NULL,
  selected_rail_id UUID REFERENCES payment_rails(id),
  selection_reason TEXT NOT NULL,
  fallback_rail_id UUID REFERENCES payment_rails(id),
  score_weight_cost DECIMAL(3,2) NOT NULL,
  score_weight_speed DECIMAL(3,2) NOT NULL,
  score_weight_risk DECIMAL(3,2) NOT NULL,

  CONSTRAINT chk_urgency_level CHECK (urgency_level IN ('standard', 'urgent', 'critical')),
  CONSTRAINT chk_weights_sum CHECK (
    score_weight_cost + score_weight_speed + score_weight_risk BETWEEN 0.99 AND 1.01
  )
);

CREATE INDEX IF NOT EXISTS idx_routing_decisions_payment ON routing_decisions(payment_id);
CREATE INDEX IF NOT EXISTS idx_routing_decisions_timestamp ON routing_decisions(decision_timestamp);
CREATE INDEX IF NOT EXISTS idx_routing_decisions_selected_rail ON routing_decisions(selected_rail_id);

COMMENT ON TABLE routing_decisions IS 'Audit trail of payment routing decisions for analytics and compliance';
COMMENT ON COLUMN routing_decisions.options_considered IS 'JSONB array of all rail options with scores';

-- =============================================================================
-- TRIGGER: Update updated_at timestamps
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payment_rails_updated_at
    BEFORE UPDATE ON payment_rails
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cutoff_windows_updated_at
    BEFORE UPDATE ON cutoff_windows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
