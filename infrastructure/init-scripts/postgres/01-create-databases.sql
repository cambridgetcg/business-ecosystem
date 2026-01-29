-- =============================================================================
-- Business Ecosystem - Database Initialization
-- =============================================================================
-- Creates separate databases for each domain to enforce bounded contexts
-- This script runs automatically when the PostgreSQL container starts

-- Foundational Domains
CREATE DATABASE entity_governance;
CREATE DATABASE banking_treasury;
CREATE DATABASE accounting;
CREATE DATABASE compliance;
CREATE DATABASE corporate_security;
CREATE DATABASE kyc_identity;
CREATE DATABASE tax;

-- Operational Domains
CREATE DATABASE contracts_legal;
CREATE DATABASE insurance;
CREATE DATABASE intellectual_property;
CREATE DATABASE data_privacy;

-- Shared Infrastructure
CREATE DATABASE audit_logs;
CREATE DATABASE workflow_engine;

-- Grant privileges to postgres user
GRANT ALL PRIVILEGES ON DATABASE entity_governance TO postgres;
GRANT ALL PRIVILEGES ON DATABASE banking_treasury TO postgres;
GRANT ALL PRIVILEGES ON DATABASE accounting TO postgres;
GRANT ALL PRIVILEGES ON DATABASE compliance TO postgres;
GRANT ALL PRIVILEGES ON DATABASE corporate_security TO postgres;
GRANT ALL PRIVILEGES ON DATABASE kyc_identity TO postgres;
GRANT ALL PRIVILEGES ON DATABASE tax TO postgres;
GRANT ALL PRIVILEGES ON DATABASE contracts_legal TO postgres;
GRANT ALL PRIVILEGES ON DATABASE insurance TO postgres;
GRANT ALL PRIVILEGES ON DATABASE intellectual_property TO postgres;
GRANT ALL PRIVILEGES ON DATABASE data_privacy TO postgres;
GRANT ALL PRIVILEGES ON DATABASE audit_logs TO postgres;
GRANT ALL PRIVILEGES ON DATABASE workflow_engine TO postgres;

-- Create extensions in each database
\c entity_governance
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c banking_treasury
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c accounting
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c compliance
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c contracts_legal
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c insurance
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c intellectual_property
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c data_privacy
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c audit_logs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c workflow_engine
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
