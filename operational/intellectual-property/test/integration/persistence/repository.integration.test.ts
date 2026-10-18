/**
 * Repository Integration Tests
 *
 * Integration tests for EnforcementRepository and IPValuationRepository
 * using testcontainers for real PostgreSQL database testing.
 *
 * @module test/integration/persistence
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

import * as schema from '../../../src/infrastructure/persistence/schema.js';
import { EnforcementRepository } from '../../../src/infrastructure/persistence/enforcement.repository.js';
import { IPValuationRepository } from '../../../src/infrastructure/persistence/strategy.repository.js';
import { EnforcementMatter } from '../../../src/domain/entities/enforcement-matter.entity.js';
import { IPValuation } from '../../../src/domain/entities/ip-valuation.entity.js';

// Test timeout for container operations
const CONTAINER_TIMEOUT = 120_000;

// Database type
type Database = ReturnType<typeof drizzle<typeof schema>>;

describe('Repository Integration Tests', () => {
  let container: StartedPostgreSqlContainer;
  let db: Database;
  let pool: Pool;
  let enforcementRepository: EnforcementRepository;
  let valuationRepository: IPValuationRepository;

  beforeAll(async () => {
    // Start PostgreSQL container
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('ip_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    // Create database connection using node-postgres Pool
    pool = new Pool({
      connectionString: container.getConnectionUri(),
    });

    db = drizzle(pool, { schema });

    // Create schema (enums first, then tables)
    await createSchema(db);

    // Initialize repositories - cast to any to satisfy type requirements
    // (repositories expect PostgresJsDatabase but we're using NodePgDatabase)
    enforcementRepository = new EnforcementRepository(db as any);
    valuationRepository = new IPValuationRepository(db as any);
  }, CONTAINER_TIMEOUT);

  afterAll(async () => {
    // Close database connection
    if (pool) {
      await pool.end();
    }

    // Stop container
    if (container) {
      await container.stop();
    }
  }, CONTAINER_TIMEOUT);

  beforeEach(async () => {
    // Clean up tables before each test (reverse order of dependencies)
    await db.delete(schema.enforcementActions);
    await db.delete(schema.enforcementParties);
    await db.delete(schema.enforcementMatters);
    await db.delete(schema.ipValuations);
  });

  // ===========================================================================
  // ENFORCEMENT REPOSITORY TESTS
  // ===========================================================================

  describe('EnforcementRepository', () => {
    describe('save and findById', () => {
      it('should save and retrieve an enforcement matter', async () => {
        // Arrange
        const matter = EnforcementMatter.create({
          title: 'Patent Infringement - Widget Co',
          description: 'Suspected infringement of Patent US12345678',
          type: 'infringement',
          priority: 'high',
          ipAssetType: 'patent',
          ipAssetId: 'patent-123',
          jurisdiction: 'US',
          venue: 'N.D. California',
          detectedDate: new Date('2024-01-15'),
          estimatedDamages: 1000000,
          assignedTo: 'attorney-1',
          tags: ['urgent', 'tech'],
        });

        // Act
        await enforcementRepository.save(matter);
        const retrieved = await enforcementRepository.findById(matter.id);

        // Assert
        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe(matter.id);
        expect(retrieved!.title).toBe('Patent Infringement - Widget Co');
        expect(retrieved!.type).toBe('infringement');
        expect(retrieved!.priority).toBe('high');
        expect(retrieved!.status).toBe('monitoring');
        expect(retrieved!.jurisdiction).toBe('US');
        expect(retrieved!.tags).toEqual(['urgent', 'tech']);
      });

      it('should return null for non-existent matter', async () => {
        const result = await enforcementRepository.findById('non-existent-id');
        expect(result).toBeNull();
      });

      it('should save matter with actions and parties', async () => {
        // Arrange
        const matter = EnforcementMatter.create({
          title: 'Trademark Infringement',
          type: 'infringement',
          ipAssetType: 'trademark',
          ipAssetId: 'trademark-456',
          jurisdiction: 'US',
          detectedDate: new Date('2024-02-01'),
        });

        // Add action
        matter.addAction({
          actionType: 'cease_and_desist',
          status: 'pending',
          title: 'Initial C&D Letter',
          dueDate: new Date('2024-02-15'),
        });

        // Add party
        matter.addParty({
          role: 'infringer',
          name: 'Bad Actor Inc.',
          organization: 'Bad Actor Corporation',
          contactEmail: 'legal@badactor.com',
        });

        // Act
        await enforcementRepository.save(matter);
        const retrieved = await enforcementRepository.findById(matter.id);

        // Assert
        expect(retrieved!.actions).toHaveLength(1);
        expect(retrieved!.actions[0].actionType).toBe('cease_and_desist');
        expect(retrieved!.actions[0].title).toBe('Initial C&D Letter');

        expect(retrieved!.parties).toHaveLength(1);
        expect(retrieved!.parties[0].role).toBe('infringer');
        expect(retrieved!.parties[0].name).toBe('Bad Actor Inc.');
      });

      it('should update existing matter', async () => {
        // Arrange
        const matter = EnforcementMatter.create({
          title: 'Initial Title',
          type: 'infringement',
          ipAssetType: 'patent',
          ipAssetId: 'patent-789',
          jurisdiction: 'US',
          detectedDate: new Date('2024-03-01'),
        });

        await enforcementRepository.save(matter);

        // Act - Update the matter
        matter.update({ title: 'Updated Title' });
        matter.setPriority('critical');
        await enforcementRepository.save(matter);

        const retrieved = await enforcementRepository.findById(matter.id);

        // Assert
        expect(retrieved!.title).toBe('Updated Title');
        expect(retrieved!.priority).toBe('critical');
      });
    });

    describe('findByMatterNumber', () => {
      it('should find matter by matter number', async () => {
        // Arrange
        const matter = EnforcementMatter.create({
          title: 'Test Matter',
          type: 'infringement',
          ipAssetType: 'patent',
          ipAssetId: 'patent-111',
          jurisdiction: 'US',
          detectedDate: new Date('2024-04-01'),
        });

        matter.update({ matterNumber: 'ENF-2024-001' });
        await enforcementRepository.save(matter);

        // Act
        const retrieved = await enforcementRepository.findByMatterNumber('ENF-2024-001');

        // Assert
        expect(retrieved).not.toBeNull();
        expect(retrieved!.matterNumber).toBe('ENF-2024-001');
        expect(retrieved!.id).toBe(matter.id);
      });

      it('should return null for non-existent matter number', async () => {
        const result = await enforcementRepository.findByMatterNumber('NON-EXISTENT');
        expect(result).toBeNull();
      });
    });

    describe('search with filters', () => {
      beforeEach(async () => {
        // Create multiple matters for search tests
        const matters = [
          EnforcementMatter.create({
            title: 'High Priority Patent Matter',
            type: 'infringement',
            priority: 'high',
            ipAssetType: 'patent',
            ipAssetId: 'patent-search-1',
            jurisdiction: 'US',
            detectedDate: new Date('2024-01-01'),
            assignedTo: 'user-1',
          }),
          EnforcementMatter.create({
            title: 'Trademark Counterfeiting',
            type: 'counterfeiting',
            priority: 'critical',
            ipAssetType: 'trademark',
            ipAssetId: 'trademark-search-1',
            jurisdiction: 'EU',
            detectedDate: new Date('2024-02-01'),
            assignedTo: 'user-2',
          }),
          EnforcementMatter.create({
            title: 'Copyright Misappropriation',
            type: 'misappropriation',
            priority: 'low',
            ipAssetType: 'copyright',
            ipAssetId: 'copyright-search-1',
            jurisdiction: 'US',
            detectedDate: new Date('2024-03-01'),
            assignedTo: 'user-1',
          }),
        ];

        for (const matter of matters) {
          await enforcementRepository.save(matter);
        }
      });

      it('should filter by status', async () => {
        const result = await enforcementRepository.search({ status: 'monitoring' });
        expect(result.matters.length).toBe(3);
        expect(result.total).toBe(3);
      });

      it('should filter by priority', async () => {
        const result = await enforcementRepository.search({ priority: 'high' });
        expect(result.matters.length).toBe(1);
        expect(result.matters[0].title).toBe('High Priority Patent Matter');
      });

      it('should filter by multiple priorities', async () => {
        const result = await enforcementRepository.search({
          priority: ['high', 'critical'],
        });
        expect(result.matters.length).toBe(2);
      });

      it('should filter by type', async () => {
        const result = await enforcementRepository.search({ type: 'counterfeiting' });
        expect(result.matters.length).toBe(1);
        expect(result.matters[0].title).toBe('Trademark Counterfeiting');
      });

      it('should filter by jurisdiction', async () => {
        const result = await enforcementRepository.search({ jurisdiction: 'US' });
        expect(result.matters.length).toBe(2);
      });

      it('should filter by assignedTo', async () => {
        const result = await enforcementRepository.search({ assignedTo: 'user-1' });
        expect(result.matters.length).toBe(2);
      });

      it('should filter by search term in title', async () => {
        const result = await enforcementRepository.search({ searchTerm: 'Patent' });
        expect(result.matters.length).toBe(1);
        expect(result.matters[0].title).toContain('Patent');
      });

      it('should filter by date range', async () => {
        const result = await enforcementRepository.search({
          detectedAfter: new Date('2024-01-15'),
          detectedBefore: new Date('2024-02-15'),
        });
        expect(result.matters.length).toBe(1);
        expect(result.matters[0].title).toBe('Trademark Counterfeiting');
      });

      it('should support pagination', async () => {
        const page1 = await enforcementRepository.search({ limit: 2, offset: 0 });
        const page2 = await enforcementRepository.search({ limit: 2, offset: 2 });

        expect(page1.matters.length).toBe(2);
        expect(page2.matters.length).toBe(1);
        expect(page1.total).toBe(3);
      });

      it('should combine multiple filters', async () => {
        const result = await enforcementRepository.search({
          jurisdiction: 'US',
          assignedTo: 'user-1',
        });
        expect(result.matters.length).toBe(2);
      });
    });

    describe('delete (soft delete)', () => {
      it('should soft delete a matter', async () => {
        // Arrange
        const matter = EnforcementMatter.create({
          title: 'Matter to Delete',
          type: 'infringement',
          ipAssetType: 'patent',
          ipAssetId: 'patent-delete',
          jurisdiction: 'US',
          detectedDate: new Date('2024-05-01'),
        });

        await enforcementRepository.save(matter);

        // Act
        await enforcementRepository.delete(matter.id);

        // Assert - should not be found via normal queries
        const retrieved = await enforcementRepository.findById(matter.id);
        expect(retrieved).toBeNull();

        // But still exists in database (soft deleted)
        const dbResult = await db
          .select()
          .from(schema.enforcementMatters)
          .where(sql`id = ${matter.id}`);
        expect(dbResult.length).toBe(1);
        expect(dbResult[0].deletedAt).not.toBeNull();
      });

      it('should not include soft deleted matters in search results', async () => {
        // Arrange
        const matter1 = EnforcementMatter.create({
          title: 'Active Matter',
          type: 'infringement',
          ipAssetType: 'patent',
          ipAssetId: 'patent-active',
          jurisdiction: 'US',
          detectedDate: new Date('2024-05-01'),
        });

        const matter2 = EnforcementMatter.create({
          title: 'Deleted Matter',
          type: 'infringement',
          ipAssetType: 'patent',
          ipAssetId: 'patent-deleted',
          jurisdiction: 'US',
          detectedDate: new Date('2024-05-02'),
        });

        await enforcementRepository.save(matter1);
        await enforcementRepository.save(matter2);
        await enforcementRepository.delete(matter2.id);

        // Act
        const result = await enforcementRepository.search({});

        // Assert
        expect(result.matters.length).toBe(1);
        expect(result.matters[0].title).toBe('Active Matter');
      });
    });
  });

  // ===========================================================================
  // IP VALUATION REPOSITORY TESTS
  // ===========================================================================

  describe('IPValuationRepository', () => {
    describe('save and findById', () => {
      it('should save and retrieve a valuation', async () => {
        // Arrange
        const valuation = IPValuation.create({
          title: 'Portfolio Valuation 2024',
          purpose: 'financial_reporting',
          methodology: 'income',
          ipAssets: [
            { type: 'patent', id: 'patent-val-1', name: 'Core Patent' },
            { type: 'trademark', id: 'trademark-val-1', name: 'Brand Mark' },
          ],
          valuationDate: new Date('2024-01-01'),
          effectiveDate: new Date('2024-01-01'),
          currency: 'USD',
          preparedBy: 'analyst-1',
        });

        // Act
        await valuationRepository.save(valuation);
        const retrieved = await valuationRepository.findById(valuation.id);

        // Assert
        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe(valuation.id);
        expect(retrieved!.title).toBe('Portfolio Valuation 2024');
        expect(retrieved!.purpose).toBe('financial_reporting');
        expect(retrieved!.methodology).toBe('income');
        expect(retrieved!.ipAssets).toHaveLength(2);
        expect(retrieved!.currency).toBe('USD');
        expect(retrieved!.status).toBe('draft');
      });

      it('should return null for non-existent valuation', async () => {
        const result = await valuationRepository.findById('non-existent-id');
        expect(result).toBeNull();
      });

      it('should save valuation with full details', async () => {
        // Arrange
        const valuation = IPValuation.create({
          title: 'Detailed Valuation',
          purpose: 'tax',
          methodology: 'relief_from_royalty',
          ipAssets: [{ type: 'patent', id: 'patent-detail', name: 'Key Patent' }],
          valuationDate: new Date('2024-06-01'),
          effectiveDate: new Date('2024-06-01'),
          currency: 'EUR',
          preparedBy: 'analyst-2',
        });

        valuation.startAnalysis();
        valuation.setModelParameters({
          discountRate: 1000, // 10% in basis points
          royaltyRate: 300,   // 3% in basis points
          projectionYears: 10,
        });
        valuation.setValueRange({
          lowValue: 4000000,
          midValue: 5000000,
          highValue: 6000000,
          selectedValue: 5000000,
        });
        valuation.addAssumption({
          category: 'market',
          description: 'Market growth rate',
          value: '5%',
        });

        // Act
        await valuationRepository.save(valuation);
        const retrieved = await valuationRepository.findById(valuation.id);

        // Assert
        expect(retrieved!.status).toBe('in_progress');
        expect(retrieved!.discountRate).toBe(1000);
        expect(retrieved!.royaltyRate).toBe(300);
        expect(retrieved!.projectionYears).toBe(10);
        expect(retrieved!.lowValue).toBe(4000000);
        expect(retrieved!.midValue).toBe(5000000);
        expect(retrieved!.highValue).toBe(6000000);
        expect(retrieved!.selectedValue).toBe(5000000);
        expect(retrieved!.assumptions).toHaveLength(1);
      });

      it('should update existing valuation', async () => {
        // Arrange
        const valuation = IPValuation.create({
          title: 'Initial Valuation',
          purpose: 'licensing',
          methodology: 'market',
          ipAssets: [{ type: 'trademark', id: 'tm-update', name: 'Brand' }],
          valuationDate: new Date('2024-07-01'),
          effectiveDate: new Date('2024-07-01'),
          preparedBy: 'analyst-3',
        });

        await valuationRepository.save(valuation);

        // Act
        valuation.startAnalysis();
        await valuationRepository.save(valuation);

        const retrieved = await valuationRepository.findById(valuation.id);

        // Assert
        expect(retrieved!.status).toBe('in_progress');
      });
    });

    describe('findByNumber', () => {
      it('should find valuation by valuation number', async () => {
        // Arrange
        const valuation = IPValuation.create({
          title: 'Numbered Valuation',
          purpose: 'sale',
          methodology: 'comparable_transactions',
          ipAssets: [{ type: 'patent', id: 'patent-num', name: 'Patent' }],
          valuationDate: new Date('2024-08-01'),
          effectiveDate: new Date('2024-08-01'),
          preparedBy: 'analyst-4',
        });

        valuation.assignNumber('VAL-2024-0001');
        await valuationRepository.save(valuation);

        // Act
        const retrieved = await valuationRepository.findByNumber('VAL-2024-0001');

        // Assert
        expect(retrieved).not.toBeNull();
        expect(retrieved!.valuationNumber).toBe('VAL-2024-0001');
        expect(retrieved!.id).toBe(valuation.id);
      });

      it('should return null for non-existent valuation number', async () => {
        const result = await valuationRepository.findByNumber('NON-EXISTENT');
        expect(result).toBeNull();
      });
    });

    describe('search with filters', () => {
      beforeEach(async () => {
        // Create multiple valuations for search tests
        const valuations = [
          createAndSaveValuation({
            title: 'Financial Reporting Valuation',
            purpose: 'financial_reporting',
            methodology: 'income',
            preparedBy: 'analyst-a',
            selectedValue: 5000000,
          }),
          createAndSaveValuation({
            title: 'Tax Valuation',
            purpose: 'tax',
            methodology: 'market',
            preparedBy: 'analyst-b',
            selectedValue: 3000000,
          }),
          createAndSaveValuation({
            title: 'Litigation Valuation',
            purpose: 'litigation',
            methodology: 'income',
            preparedBy: 'analyst-a',
            selectedValue: 10000000,
          }),
        ];

        for (const valFn of valuations) {
          await valFn();
        }
      });

      it('should filter by status', async () => {
        const result = await valuationRepository.search({ status: 'draft' });
        expect(result.valuations.length).toBe(3);
        expect(result.total).toBe(3);
      });

      it('should filter by purpose', async () => {
        const result = await valuationRepository.search({ purpose: 'tax' });
        expect(result.valuations.length).toBe(1);
        expect(result.valuations[0].title).toBe('Tax Valuation');
      });

      it('should filter by methodology', async () => {
        const result = await valuationRepository.search({ methodology: 'income' });
        expect(result.valuations.length).toBe(2);
      });

      it('should filter by preparedBy', async () => {
        const result = await valuationRepository.search({ preparedBy: 'analyst-a' });
        expect(result.valuations.length).toBe(2);
      });

      it('should filter by value range (minValue)', async () => {
        const result = await valuationRepository.search({ minValue: 4000000 });
        expect(result.valuations.length).toBe(2);
      });

      it('should filter by value range (maxValue)', async () => {
        const result = await valuationRepository.search({ maxValue: 5000000 });
        expect(result.valuations.length).toBe(2);
      });

      it('should filter by search term in title', async () => {
        const result = await valuationRepository.search({ searchTerm: 'Litigation' });
        expect(result.valuations.length).toBe(1);
        expect(result.valuations[0].title).toContain('Litigation');
      });

      it('should support pagination', async () => {
        const page1 = await valuationRepository.search({}, 2, 0);
        const page2 = await valuationRepository.search({}, 2, 2);

        expect(page1.valuations.length).toBe(2);
        expect(page2.valuations.length).toBe(1);
        expect(page1.total).toBe(3);
      });

      it('should combine multiple filters', async () => {
        const result = await valuationRepository.search({
          methodology: 'income',
          preparedBy: 'analyst-a',
        });
        expect(result.valuations.length).toBe(2);
      });
    });

    describe('delete (soft delete)', () => {
      it('should soft delete a valuation', async () => {
        // Arrange
        const valuation = IPValuation.create({
          title: 'Valuation to Delete',
          purpose: 'internal_planning',
          methodology: 'cost',
          ipAssets: [{ type: 'patent', id: 'patent-del', name: 'Patent' }],
          valuationDate: new Date('2024-09-01'),
          effectiveDate: new Date('2024-09-01'),
          preparedBy: 'analyst-5',
        });

        await valuationRepository.save(valuation);

        // Act
        await valuationRepository.delete(valuation.id);

        // Assert - should not be found via normal queries
        const retrieved = await valuationRepository.findById(valuation.id);
        expect(retrieved).toBeNull();

        // But still exists in database (soft deleted)
        const dbResult = await db
          .select()
          .from(schema.ipValuations)
          .where(sql`id = ${valuation.id}`);
        expect(dbResult.length).toBe(1);
        expect(dbResult[0].deletedAt).not.toBeNull();
      });
    });

    describe('generateNumber', () => {
      it('should generate sequential valuation numbers', async () => {
        const num1 = await valuationRepository.generateNumber();
        const year = new Date().getFullYear();
        expect(num1).toMatch(new RegExp(`^VAL-${year}-\\d{4}$`));

        // Create a valuation with that number
        const valuation = IPValuation.create({
          title: 'Test Valuation',
          purpose: 'financial_reporting',
          methodology: 'income',
          ipAssets: [{ type: 'patent', id: 'pat-gen', name: 'Patent' }],
          valuationDate: new Date(),
          effectiveDate: new Date(),
          preparedBy: 'analyst',
        });
        valuation.assignNumber(num1);
        await valuationRepository.save(valuation);

        // Generate another number
        const num2 = await valuationRepository.generateNumber();
        expect(num2).not.toBe(num1);
      });
    });
  });

  // ===========================================================================
  // HELPER FUNCTIONS
  // ===========================================================================

  function createAndSaveValuation(overrides: {
    title: string;
    purpose: 'financial_reporting' | 'tax' | 'litigation' | 'licensing' | 'sale' | 'financing' | 'insurance' | 'internal_planning' | 'm_and_a';
    methodology: 'cost' | 'market' | 'income' | 'relief_from_royalty' | 'excess_earnings' | 'real_options' | 'monte_carlo' | 'comparable_transactions';
    preparedBy: string;
    selectedValue?: number;
  }): () => Promise<void> {
    return async () => {
      const valuation = IPValuation.create({
        title: overrides.title,
        purpose: overrides.purpose,
        methodology: overrides.methodology,
        ipAssets: [{ type: 'patent', id: `patent-${Date.now()}`, name: 'Test Patent' }],
        valuationDate: new Date(),
        effectiveDate: new Date(),
        preparedBy: overrides.preparedBy,
      });

      if (overrides.selectedValue) {
        valuation.startAnalysis();
        valuation.setValueRange({
          lowValue: overrides.selectedValue * 0.8,
          midValue: overrides.selectedValue,
          highValue: overrides.selectedValue * 1.2,
          selectedValue: overrides.selectedValue,
        });
      }

      await valuationRepository.save(valuation);
    };
  }
});

/**
 * Create database schema
 * This creates all necessary enums and tables for the tests
 */
async function createSchema(db: Database): Promise<void> {
  // Create enums
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE patent_status AS ENUM ('draft', 'provisional', 'pending', 'published', 'granted', 'abandoned', 'expired', 'lapsed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE patent_type AS ENUM ('utility', 'design', 'plant', 'reissue');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE trademark_status AS ENUM ('draft', 'pending', 'published', 'opposed', 'registered', 'cancelled', 'expired', 'abandoned');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE trademark_type AS ENUM ('word', 'design', 'combined', 'sound', 'color', '3d');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE copyright_status AS ENUM ('unregistered', 'pending', 'registered', 'disputed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE work_type AS ENUM ('literary', 'musical', 'dramatic', 'choreographic', 'pictorial', 'audiovisual', 'sound_recording', 'architectural', 'software', 'compilation', 'derivative');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE license_status AS ENUM ('draft', 'active', 'suspended', 'terminated', 'expired');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE license_type AS ENUM ('exclusive', 'non_exclusive', 'sole', 'sublicense');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE ip_type AS ENUM ('patent', 'trademark', 'copyright', 'trade_secret');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE enforcement_type AS ENUM ('infringement', 'misappropriation', 'counterfeiting', 'cybersquatting', 'unfair_competition', 'breach_of_license', 'other');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE enforcement_status AS ENUM ('monitoring', 'investigation', 'cease_and_desist', 'negotiation', 'litigation', 'settled', 'resolved', 'abandoned');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE enforcement_priority AS ENUM ('low', 'medium', 'high', 'critical');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE enforcement_action_type AS ENUM ('cease_and_desist', 'dmca_takedown', 'customs_recordation', 'court_filing', 'motion', 'discovery', 'settlement_offer', 'judgment', 'appeal', 'monitoring_alert', 'investigation', 'negotiation', 'other');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE enforcement_action_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled', 'failed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE enforcement_party_role AS ENUM ('infringer', 'defendant', 'plaintiff', 'respondent', 'petitioner', 'internal_counsel', 'external_counsel', 'investigator', 'expert_witness');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE valuation_methodology AS ENUM ('cost', 'market', 'income', 'relief_from_royalty', 'excess_earnings', 'real_options', 'monte_carlo', 'comparable_transactions');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE valuation_purpose AS ENUM ('financial_reporting', 'tax', 'litigation', 'licensing', 'sale', 'financing', 'insurance', 'internal_planning', 'm_and_a');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE valuation_status AS ENUM ('draft', 'in_progress', 'review', 'approved', 'superseded', 'archived');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  // Create enforcement_matters table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS enforcement_matters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      matter_number VARCHAR(50) UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      type enforcement_type NOT NULL,
      status enforcement_status NOT NULL DEFAULT 'monitoring',
      priority enforcement_priority NOT NULL DEFAULT 'medium',
      ip_asset_type ip_type NOT NULL,
      ip_asset_id UUID NOT NULL,
      additional_assets JSONB DEFAULT '[]',
      jurisdiction VARCHAR(100) NOT NULL,
      venue VARCHAR(255),
      case_number VARCHAR(100),
      detected_date DATE NOT NULL,
      opened_date DATE,
      resolved_date DATE,
      estimated_damages INTEGER,
      actual_damages INTEGER,
      settlement_amount INTEGER,
      estimated_costs INTEGER,
      actual_costs INTEGER,
      outcome VARCHAR(255),
      outcome_notes TEXT,
      assigned_to UUID,
      tags JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by UUID,
      updated_by UUID,
      version INTEGER NOT NULL DEFAULT 1,
      deleted_at TIMESTAMPTZ
    )
  `);

  // Create enforcement_actions table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS enforcement_actions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      matter_id UUID NOT NULL REFERENCES enforcement_matters(id),
      action_type enforcement_action_type NOT NULL,
      status enforcement_action_status NOT NULL DEFAULT 'pending',
      title TEXT NOT NULL,
      description TEXT,
      scheduled_date DATE,
      due_date DATE,
      completed_date DATE,
      filing_number VARCHAR(100),
      court_name VARCHAR(255),
      judge_name VARCHAR(255),
      response_received BOOLEAN NOT NULL DEFAULT FALSE,
      response_date DATE,
      response_summary TEXT,
      cost INTEGER,
      documents JSONB DEFAULT '[]',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by UUID,
      updated_by UUID,
      version INTEGER NOT NULL DEFAULT 1,
      deleted_at TIMESTAMPTZ
    )
  `);

  // Create enforcement_parties table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS enforcement_parties (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      matter_id UUID NOT NULL REFERENCES enforcement_matters(id),
      role enforcement_party_role NOT NULL,
      name TEXT NOT NULL,
      organization VARCHAR(255),
      contact_email VARCHAR(255),
      contact_phone VARCHAR(50),
      address TEXT,
      bar_number VARCHAR(50),
      firm_name VARCHAR(255),
      internal_contact_id UUID,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by UUID,
      updated_by UUID,
      version INTEGER NOT NULL DEFAULT 1,
      deleted_at TIMESTAMPTZ
    )
  `);

  // Create ip_valuations table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ip_valuations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      valuation_number VARCHAR(50) UNIQUE,
      title TEXT NOT NULL,
      status valuation_status NOT NULL DEFAULT 'draft',
      purpose valuation_purpose NOT NULL,
      methodology valuation_methodology NOT NULL,
      ip_assets JSONB NOT NULL DEFAULT '[]',
      valuation_date DATE NOT NULL,
      effective_date DATE NOT NULL,
      expiration_date DATE,
      low_value INTEGER,
      mid_value INTEGER,
      high_value INTEGER,
      selected_value INTEGER,
      currency VARCHAR(3) NOT NULL DEFAULT 'USD',
      assumptions JSONB NOT NULL DEFAULT '[]',
      discount_rate INTEGER,
      royalty_rate INTEGER,
      projection_years INTEGER,
      terminal_growth_rate INTEGER,
      comparable_transactions JSONB DEFAULT '[]',
      sensitivities JSONB DEFAULT '[]',
      conclusion_summary TEXT,
      limitations TEXT,
      prepared_by UUID NOT NULL,
      reviewed_by UUID,
      approved_by UUID,
      approved_date DATE,
      external_appraiser VARCHAR(255),
      appraisal_report_ref VARCHAR(100),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by UUID,
      updated_by UUID,
      version INTEGER NOT NULL DEFAULT 1,
      deleted_at TIMESTAMPTZ
    )
  `);
}
