import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getPool } from '../../../infrastructure/database.js';
import { eventPublisher } from '../../../infrastructure/aws/event-publisher.js';
import { env } from '../../../env.js';

const createAccountSchema = z.object({
  entityId: z.string().uuid(),
  accountName: z.string().min(1).max(200),
  accountType: z.enum(['checking', 'savings', 'money_market', 'certificate_of_deposit']),
  bankName: z.string().min(1).max(200),
  accountNumber: z.string().min(4).max(34),
  routingNumber: z.string().max(20).optional(),
  iban: z.string().max(34).optional(),
  swiftCode: z.string().max(11).optional(),
  currency: z.string().length(3).toUpperCase(),
  isPrimary: z.boolean().default(false),
});

const updateAccountSchema = z.object({
  accountName: z.string().min(1).max(200).optional(),
  status: z.enum(['active', 'inactive', 'closed', 'frozen']).optional(),
  isPrimary: z.boolean().optional(),
});

export async function accountRoutes(app: FastifyInstance): Promise<void> {

  // Create bank account
  app.post('/accounts', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createAccountSchema.parse(request.body);
    const pool = await getPool();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const id = randomUUID();
      const now = new Date();
      
      // Simple encryption placeholder - in production use KMS
      const accountNumberEncrypted = Buffer.from(body.accountNumber);
      const routingNumberEncrypted = body.routingNumber ? Buffer.from(body.routingNumber) : null;
      const ibanEncrypted = body.iban ? Buffer.from(body.iban) : null;
      
      // If marking as primary, unset other primary accounts for this entity
      if (body.isPrimary) {
        await client.query(`
          UPDATE banking.bank_accounts 
          SET is_primary = false, updated_at = $1
          WHERE entity_id = $2 AND is_primary = true AND deleted_at IS NULL
        `, [now, body.entityId]);
      }
      
      await client.query(`
        INSERT INTO banking.bank_accounts (
          id, entity_id, account_name, account_type, bank_name,
          account_number_encrypted, routing_number_encrypted, iban_encrypted,
          swift_code, currency, balance_amount, balance_currency,
          status, is_primary, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $10, 'active', $11, $12, $12)
      `, [id, body.entityId, body.accountName, body.accountType, body.bankName,
          accountNumberEncrypted, routingNumberEncrypted, ibanEncrypted,
          body.swiftCode, body.currency, body.isPrimary, now]);
      
      // Audit log
      await client.query(`
        INSERT INTO banking.audit_log (entity_type, entity_id, action, occurred_at, changes)
        VALUES ('BankAccount', $1, 'created', $2, $3)
      `, [id, now, JSON.stringify({ accountType: body.accountType, bankName: body.bankName })]);
      
      await client.query('COMMIT');
      
      // Publish event
      if (env.ENABLE_EVENT_PUBLISHING) {
        await eventPublisher.publish({
          type: 'account.created',
          aggregateId: id,
          aggregateType: 'BankAccount',
          payload: {
            entityId: body.entityId,
            accountType: body.accountType,
            currency: body.currency,
          },
          occurredAt: now,
        });
      }
      
      return reply.status(201).send({
        id,
        entityId: body.entityId,
        accountName: body.accountName,
        accountType: body.accountType,
        bankName: body.bankName,
        currency: body.currency,
        status: 'active',
        isPrimary: body.isPrimary,
        balance: { amount: 0, currency: body.currency },
        createdAt: now,
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // Get accounts by entity
  app.get('/accounts', async (request: FastifyRequest, reply: FastifyReply) => {
    const { entityId, status, currency } = request.query as Record<string, string>;
    
    if (!entityId) {
      return reply.status(400).send({ error: 'entityId query parameter is required' });
    }
    
    const pool = await getPool();
    
    let query = `
      SELECT id, entity_id, account_name, account_type, bank_name,
             swift_code, currency, balance_amount, balance_currency,
             status, is_primary, created_at, updated_at
      FROM banking.bank_accounts
      WHERE entity_id = $1 AND deleted_at IS NULL
    `;
    const params: unknown[] = [entityId];
    let paramIndex = 2;
    
    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }
    if (currency) {
      query += ` AND currency = $${paramIndex++}`;
      params.push(currency);
    }
    
    query += ' ORDER BY is_primary DESC, created_at DESC';
    
    const result = await pool.query(query, params);
    
    return reply.send({
      data: result.rows.map(row => ({
        id: row.id,
        entityId: row.entity_id,
        accountName: row.account_name,
        accountType: row.account_type,
        bankName: row.bank_name,
        swiftCode: row.swift_code,
        currency: row.currency,
        balance: {
          amount: parseFloat(row.balance_amount),
          currency: row.balance_currency,
        },
        status: row.status,
        isPrimary: row.is_primary,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  });

  // Get single account
  app.get('/accounts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const pool = await getPool();
    
    const result = await pool.query(`
      SELECT id, entity_id, account_name, account_type, bank_name,
             swift_code, currency, balance_amount, balance_currency,
             status, is_primary, created_at, updated_at, version
      FROM banking.bank_accounts
      WHERE id = $1 AND deleted_at IS NULL
    `, [id]);
    
    if (!result.rows.length) {
      return reply.status(404).send({ error: 'Account not found' });
    }
    
    const row = result.rows[0];
    return reply.send({
      id: row.id,
      entityId: row.entity_id,
      accountName: row.account_name,
      accountType: row.account_type,
      bankName: row.bank_name,
      swiftCode: row.swift_code,
      currency: row.currency,
      balance: {
        amount: parseFloat(row.balance_amount),
        currency: row.balance_currency,
      },
      status: row.status,
      isPrimary: row.is_primary,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  });

  // Update account
  app.patch('/accounts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateAccountSchema.parse(request.body);
    const pool = await getPool();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get current state
      const current = await client.query(
        'SELECT * FROM banking.bank_accounts WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [id]
      );
      
      if (!current.rows.length) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Account not found' });
      }
      
      const updates: string[] = ['updated_at = NOW()'];
      const values: unknown[] = [];
      let paramIndex = 1;
      
      if (body.accountName !== undefined) {
        updates.push(`account_name = $${paramIndex++}`);
        values.push(body.accountName);
      }
      if (body.status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        values.push(body.status);
      }
      if (body.isPrimary !== undefined) {
        updates.push(`is_primary = $${paramIndex++}`);
        values.push(body.isPrimary);
        
        // Unset other primary if setting this as primary
        if (body.isPrimary) {
          await client.query(`
            UPDATE banking.bank_accounts 
            SET is_primary = false, updated_at = NOW()
            WHERE entity_id = $1 AND id != $2 AND is_primary = true AND deleted_at IS NULL
          `, [current.rows[0].entity_id, id]);
        }
      }
      
      values.push(id);
      
      await client.query(
        `UPDATE banking.bank_accounts SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
      
      // Audit log
      await client.query(`
        INSERT INTO banking.audit_log (entity_type, entity_id, action, occurred_at, changes)
        VALUES ('BankAccount', $1, 'updated', NOW(), $2)
      `, [id, JSON.stringify(body)]);
      
      await client.query('COMMIT');
      
      // Get updated record
      const updated = await pool.query(
        'SELECT * FROM banking.bank_accounts WHERE id = $1',
        [id]
      );
      
      const row = updated.rows[0];
      
      // Publish event if status changed
      if (body.status && env.ENABLE_EVENT_PUBLISHING) {
        const eventType = body.status === 'frozen' ? 'account.frozen' : 
                         body.status === 'closed' ? 'account.closed' : 
                         'account.status_changed';
        
        await eventPublisher.publish({
          type: eventType,
          aggregateId: id,
          aggregateType: 'BankAccount',
          payload: { newStatus: body.status },
          occurredAt: new Date(),
        });
      }
      
      return reply.send({
        id: row.id,
        accountName: row.account_name,
        status: row.status,
        isPrimary: row.is_primary,
        updatedAt: row.updated_at,
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // Delete (soft) account
  app.delete('/accounts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const pool = await getPool();
    
    const result = await pool.query(`
      UPDATE banking.bank_accounts 
      SET deleted_at = NOW(), status = 'closed'
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `, [id]);
    
    if (!result.rows.length) {
      return reply.status(404).send({ error: 'Account not found' });
    }
    
    // Audit log
    await pool.query(`
      INSERT INTO banking.audit_log (entity_type, entity_id, action, occurred_at)
      VALUES ('BankAccount', $1, 'deleted', NOW())
    `, [id]);
    
    return reply.status(204).send();
  });
}
