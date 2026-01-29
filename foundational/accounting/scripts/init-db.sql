-- PostgreSQL initialization script for local development
-- This script runs when the PostgreSQL container starts

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create schema for accounting
CREATE SCHEMA IF NOT EXISTS accounting;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA accounting TO accounting;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA accounting TO accounting;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA accounting TO accounting;

-- Set default search path
ALTER USER accounting SET search_path TO accounting, public;

-- Log initialization complete
DO $$
BEGIN
    RAISE NOTICE 'Database initialization complete';
END $$;
