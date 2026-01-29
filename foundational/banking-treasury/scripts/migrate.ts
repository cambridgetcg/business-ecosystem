/**
 * Database Migration Script
 * 
 * Runs SQL migrations to set up the banking-treasury schema.
 * Includes partitioning for time-series data.
 */

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Running migrations...');
    
    // Create banking schema
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS banking;
      COMMENT ON SCHEMA banking IS 'Banking and Treasury domain';
    `);
    
    // Create extension for UUID generation
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    
    // =========================================================================
    // BANK ACCOUNTS TABLE (No partitioning - relatively static data)
    // =========================================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS banking.bank_accounts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        entity_id UUID NOT NULL,
        account_name VARCHAR(200) NOT NULL,
        account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('checking', 'savings', 'money_market', 'certificate_of_deposit')),
        bank_name VARCHAR(200) NOT NULL,
        account_number_encrypted BYTEA NOT NULL,
        routing_number_encrypted BYTEA,
        iban_encrypted BYTEA,
        swift_code VARCHAR(11),
        currency CHAR(3) NOT NULL,
        balance_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
        balance_currency CHAR(3) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'closed', 'frozen')),
        is_primary BOOLEAN NOT NULL DEFAULT false,
        
        -- Audit fields
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by UUID,
        updated_by UUID,
        version INTEGER NOT NULL DEFAULT 1,
        deleted_at TIMESTAMPTZ,
        
        -- Constraints added via indexes below
        CONSTRAINT check_is_primary CHECK (is_primary IN (true, false))
      );

      -- Partial unique index for primary account per entity
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_primary_per_entity
        ON banking.bank_accounts(entity_id) WHERE is_primary = true AND deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_bank_accounts_entity ON banking.bank_accounts(entity_id) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_bank_accounts_status ON banking.bank_accounts(status) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_bank_accounts_currency ON banking.bank_accounts(currency) WHERE deleted_at IS NULL;
      
      COMMENT ON TABLE banking.bank_accounts IS 'Bank accounts for entities in the ecosystem';
      COMMENT ON COLUMN banking.bank_accounts.account_number_encrypted IS 'AES-256 encrypted account number';
    `);
    console.log('Created bank_accounts table');
    
    // =========================================================================
    // TRANSACTIONS TABLE (Partitioned by month for time-series queries)
    // =========================================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS banking.transactions (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        entity_id UUID NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('payment', 'receipt', 'transfer', 'refund', 'fee', 'interest', 'adjustment')),
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed')),
        amount_value DECIMAL(20, 2) NOT NULL,
        amount_currency CHAR(3) NOT NULL,
        description VARCHAR(500),
        reference VARCHAR(100),
        source_account_id UUID REFERENCES banking.bank_accounts(id),
        destination_account_id UUID REFERENCES banking.bank_accounts(id),
        counterparty_name VARCHAR(200),
        counterparty_account VARCHAR(50),
        metadata JSONB,
        processed_at TIMESTAMPTZ,
        
        -- Audit fields  
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by UUID,
        version INTEGER NOT NULL DEFAULT 1,
        
        PRIMARY KEY (id, created_at)
      ) PARTITION BY RANGE (created_at);
      
      COMMENT ON TABLE banking.transactions IS 'Financial transactions - partitioned by month';
    `);
    
    // Create partitions for current and next 3 months
    const now = new Date();
    for (let i = -1; i <= 3; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const nextDate = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      const partitionName = `transactions_${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS banking.${partitionName} 
        PARTITION OF banking.transactions
        FOR VALUES FROM ('${date.toISOString().split('T')[0]}') TO ('${nextDate.toISOString().split('T')[0]}');
      `);
      console.log(`Created partition: ${partitionName}`);
    }
    
    // Indexes on partitioned table
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_entity ON banking.transactions(entity_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON banking.transactions(status);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON banking.transactions(type);
      CREATE INDEX IF NOT EXISTS idx_transactions_source ON banking.transactions(source_account_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_dest ON banking.transactions(destination_account_id);
    `);
    console.log('Created transactions table with partitions');
    
    // =========================================================================
    // PAYMENTS TABLE
    // =========================================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS banking.payments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        invoice_id UUID,
        transaction_id UUID NOT NULL,
        amount_value DECIMAL(20, 2) NOT NULL,
        amount_currency CHAR(3) NOT NULL,
        method VARCHAR(50) NOT NULL CHECK (method IN ('bank_transfer', 'ach', 'wire', 'check', 'credit_card', 'debit_card')),
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed')),
        failure_reason TEXT,
        paid_at TIMESTAMPTZ,
        
        -- Audit fields
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by UUID,
        updated_by UUID,
        version INTEGER NOT NULL DEFAULT 1,
        metadata JSONB,
        deleted_at TIMESTAMPTZ
      );
      
      CREATE INDEX IF NOT EXISTS idx_payments_transaction ON banking.payments(transaction_id);
      CREATE INDEX IF NOT EXISTS idx_payments_invoice ON banking.payments(invoice_id) WHERE invoice_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_payments_status ON banking.payments(status);
      CREATE INDEX IF NOT EXISTS idx_payments_method ON banking.payments(method);
      
      COMMENT ON TABLE banking.payments IS 'Payment records linked to transactions';
    `);
    console.log('Created payments table');
    
    // =========================================================================
    // CASH FORECASTS TABLE
    // =========================================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS banking.cash_forecasts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        entity_id UUID NOT NULL,
        period VARCHAR(50) NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'quarterly')),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        projected_inflows DECIMAL(20, 2) NOT NULL,
        projected_outflows DECIMAL(20, 2) NOT NULL,
        projected_balance DECIMAL(20, 2) NOT NULL,
        currency CHAR(3) NOT NULL,
        confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
        assumptions JSONB,
        
        -- Audit fields
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by UUID,
        version INTEGER NOT NULL DEFAULT 1,
        deleted_at TIMESTAMPTZ
      );

      -- Partial unique index for forecast period
      CREATE UNIQUE INDEX IF NOT EXISTS idx_forecasts_unique_period
        ON banking.cash_forecasts(entity_id, period, start_date, currency) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_forecasts_entity ON banking.cash_forecasts(entity_id) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_forecasts_period ON banking.cash_forecasts(period) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_forecasts_dates ON banking.cash_forecasts(start_date, end_date) WHERE deleted_at IS NULL;
      
      COMMENT ON TABLE banking.cash_forecasts IS 'Cash flow forecasts for treasury planning';
    `);
    console.log('Created cash_forecasts table');
    
    // =========================================================================
    // RECONCILIATIONS TABLE
    // =========================================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS banking.reconciliations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        bank_account_id UUID NOT NULL REFERENCES banking.bank_accounts(id),
        statement_date DATE NOT NULL,
        statement_balance DECIMAL(20, 2) NOT NULL,
        system_balance DECIMAL(20, 2) NOT NULL,
        difference DECIMAL(20, 2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'matched', 'unmatched', 'approved', 'rejected')),
        notes TEXT,
        
        -- Audit fields
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by UUID,
        approved_by UUID,
        approved_at TIMESTAMPTZ,
        metadata JSONB,
        deleted_at TIMESTAMPTZ
      );

      -- Partial unique index for reconciliation per account date
      CREATE UNIQUE INDEX IF NOT EXISTS idx_recon_unique_account_date
        ON banking.reconciliations(bank_account_id, statement_date) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_recon_account ON banking.reconciliations(bank_account_id) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_recon_date ON banking.reconciliations(statement_date) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_recon_status ON banking.reconciliations(status) WHERE deleted_at IS NULL;
      
      COMMENT ON TABLE banking.reconciliations IS 'Bank statement reconciliation records';
    `);
    console.log('Created reconciliations table');
    
    // =========================================================================
    // AUDIT LOG TABLE (Partitioned - append only)
    // =========================================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS banking.audit_log (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        entity_type VARCHAR(100) NOT NULL,
        entity_id UUID NOT NULL,
        action VARCHAR(50) NOT NULL,
        actor_id UUID,
        actor_type VARCHAR(50),
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        changes JSONB,
        metadata JSONB,
        
        PRIMARY KEY (id, occurred_at)
      ) PARTITION BY RANGE (occurred_at);
      
      COMMENT ON TABLE banking.audit_log IS 'Immutable audit trail - partitioned by month';
    `);
    
    // Create audit partitions
    for (let i = -1; i <= 3; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const nextDate = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      const partitionName = `audit_log_${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS banking.${partitionName}
        PARTITION OF banking.audit_log
        FOR VALUES FROM ('${date.toISOString().split('T')[0]}') TO ('${nextDate.toISOString().split('T')[0]}');
      `);
    }
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_entity ON banking.audit_log(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_actor ON banking.audit_log(actor_id);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON banking.audit_log(action);
    `);
    console.log('Created audit_log table with partitions');
    
    // =========================================================================
    // FUNCTIONS & TRIGGERS
    // =========================================================================
    
    // Auto-update updated_at timestamp
    await client.query(`
      CREATE OR REPLACE FUNCTION banking.update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        NEW.version = OLD.version + 1;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Apply to all tables
    for (const table of ['bank_accounts', 'payments', 'cash_forecasts', 'reconciliations']) {
      await client.query(`
        DROP TRIGGER IF EXISTS update_${table}_timestamp ON banking.${table};
        CREATE TRIGGER update_${table}_timestamp
        BEFORE UPDATE ON banking.${table}
        FOR EACH ROW EXECUTE FUNCTION banking.update_updated_at();
      `);
    }
    console.log('Created triggers');
    
    // Function to create new partitions (for scheduled job)
    await client.query(`
      CREATE OR REPLACE FUNCTION banking.create_monthly_partitions()
      RETURNS void AS $$
      DECLARE
        partition_date DATE;
        partition_name TEXT;
        start_date TEXT;
        end_date TEXT;
      BEGIN
        -- Create partitions for next 3 months
        FOR i IN 1..3 LOOP
          partition_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::INTERVAL);
          start_date := partition_date::TEXT;
          end_date := (partition_date + '1 month'::INTERVAL)::TEXT;
          
          -- Transactions partition
          partition_name := 'transactions_' || TO_CHAR(partition_date, 'YYYY_MM');
          EXECUTE format(
            'CREATE TABLE IF NOT EXISTS banking.%I PARTITION OF banking.transactions FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
          );
          
          -- Audit log partition
          partition_name := 'audit_log_' || TO_CHAR(partition_date, 'YYYY_MM');
          EXECUTE format(
            'CREATE TABLE IF NOT EXISTS banking.%I PARTITION OF banking.audit_log FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
          );
        END LOOP;
      END;
      $$ LANGUAGE plpgsql;
      
      COMMENT ON FUNCTION banking.create_monthly_partitions IS 'Creates partitions for upcoming months - run monthly via scheduler';
    `);
    console.log('Created partition maintenance function');
    
    await client.query('COMMIT');
    console.log('Migrations completed successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
