-- Seed data for entity-governance

-- Insert test legal entities
INSERT INTO legal_entities (id, name, legal_name, entity_type, jurisdiction_country, jurisdiction_state, status, incorporation_date, tax_id)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Acme Holdings', 'Acme Holdings LLC', 'llc', 'US', 'DE', 'active', '2020-01-15', '12-3456789'),
  ('22222222-2222-2222-2222-222222222222', 'Acme Tech', 'Acme Tech Inc', 'corporation', 'US', 'DE', 'active', '2021-06-01', '98-7654321'),
  ('33333333-3333-3333-3333-333333333333', 'Acme Europe', 'Acme Europe GmbH', 'corporation', 'DE', NULL, 'active', '2022-03-15', NULL)
ON CONFLICT (id) DO NOTHING;

SELECT 'Inserted ' || COUNT(*) || ' legal entities' as status FROM legal_entities;
