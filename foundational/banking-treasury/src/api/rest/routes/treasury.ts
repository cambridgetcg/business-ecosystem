import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getPool } from '../../../infrastructure/database.js';

const createForecastSchema = z.object({
  entityId: z.string().uuid(),
  period: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
  startDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
  endDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
  projectedInflows: z.number(),
  projectedOutflows: z.number(),
  currency: z.string().length(3).toUpperCase(),
  confidence: z.number().min(0).max(100),
  assumptions: z.record(z.unknown()).optional(),
});

export async function treasuryRoutes(app: FastifyInstance): Promise<void> {
  
  // Get cash position for an entity
  app.get('/treasury/cash-position', async (request: FastifyRequest, reply: FastifyReply) => {
    const { entityId, currency } = request.query as { entityId: string; currency?: string };
    
    if (!entityId) {
      return reply.status(400).send({ error: 'entityId query parameter is required' });
    }
    
    const pool = await getPool();
    
    // Get accounts and balances
    let accountQuery = `
      SELECT id, account_name, account_type, bank_name, currency,
             balance_amount, balance_currency, status
      FROM banking.bank_accounts
      WHERE entity_id = $1 AND deleted_at IS NULL
    `;
    const params: unknown[] = [entityId];
    
    if (currency) {
      accountQuery += ' AND currency = $2';
      params.push(currency);
    }
    
    const accounts = await pool.query(accountQuery, params);
    
    // Aggregate by currency
    const byCurrency: Record<string, { total: number; accounts: number }> = {};
    
    for (const account of accounts.rows) {
      if (account.status !== 'active') continue;
      
      const curr = account.balance_currency;
      if (!byCurrency[curr]) {
        byCurrency[curr] = { total: 0, accounts: 0 };
      }
      byCurrency[curr].total += parseFloat(account.balance_amount);
      byCurrency[curr].accounts++;
    }
    
    // Get recent transactions summary (last 30 days)
    const transactionSummary = await pool.query(`
      SELECT 
        type,
        amount_currency as currency,
        SUM(amount_value) as total,
        COUNT(*) as count
      FROM banking.transactions
      WHERE entity_id = $1 
        AND status = 'completed'
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY type, amount_currency
    `, [entityId]);
    
    return reply.send({
      entityId,
      asOfDate: new Date().toISOString(),
      totalAccounts: accounts.rows.length,
      activeAccounts: accounts.rows.filter(a => a.status === 'active').length,
      positionByCurrency: Object.entries(byCurrency).map(([curr, data]) => ({
        currency: curr,
        totalBalance: data.total,
        accountCount: data.accounts,
      })),
      accounts: accounts.rows.map(a => ({
        id: a.id,
        name: a.account_name,
        type: a.account_type,
        bankName: a.bank_name,
        currency: a.currency,
        balance: parseFloat(a.balance_amount),
        status: a.status,
      })),
      recentActivity: {
        periodDays: 30,
        summary: transactionSummary.rows.map(r => ({
          type: r.type,
          currency: r.currency,
          total: parseFloat(r.total),
          count: parseInt(r.count),
        })),
      },
    });
  });

  // Create cash forecast
  app.post('/treasury/forecasts', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createForecastSchema.parse(request.body);
    const pool = await getPool();
    
    const id = randomUUID();
    const projectedBalance = body.projectedInflows - body.projectedOutflows;
    const now = new Date();
    
    await pool.query(`
      INSERT INTO banking.cash_forecasts (
        id, entity_id, period, start_date, end_date,
        projected_inflows, projected_outflows, projected_balance,
        currency, confidence, assumptions, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
    `, [id, body.entityId, body.period, body.startDate, body.endDate,
        body.projectedInflows, body.projectedOutflows, projectedBalance,
        body.currency, body.confidence, JSON.stringify(body.assumptions ?? {}), now]);
    
    return reply.status(201).send({
      id,
      entityId: body.entityId,
      period: body.period,
      startDate: body.startDate,
      endDate: body.endDate,
      projectedInflows: body.projectedInflows,
      projectedOutflows: body.projectedOutflows,
      projectedBalance,
      currency: body.currency,
      confidence: body.confidence,
      createdAt: now,
    });
  });

  // Get forecasts for an entity
  app.get('/treasury/forecasts', async (request: FastifyRequest, reply: FastifyReply) => {
    const { entityId, period, currency } = request.query as Record<string, string>;
    
    if (!entityId) {
      return reply.status(400).send({ error: 'entityId query parameter is required' });
    }
    
    const pool = await getPool();
    
    let query = `
      SELECT id, entity_id, period, start_date, end_date,
             projected_inflows, projected_outflows, projected_balance,
             currency, confidence, assumptions, created_at
      FROM banking.cash_forecasts
      WHERE entity_id = $1 AND deleted_at IS NULL
    `;
    const params: unknown[] = [entityId];
    let paramIndex = 2;
    
    if (period) {
      query += ` AND period = $${paramIndex++}`;
      params.push(period);
    }
    if (currency) {
      query += ` AND currency = $${paramIndex++}`;
      params.push(currency);
    }
    
    query += ' ORDER BY start_date DESC';
    
    const result = await pool.query(query, params);
    
    return reply.send({
      data: result.rows.map(r => ({
        id: r.id,
        entityId: r.entity_id,
        period: r.period,
        startDate: r.start_date,
        endDate: r.end_date,
        projectedInflows: parseFloat(r.projected_inflows),
        projectedOutflows: parseFloat(r.projected_outflows),
        projectedBalance: parseFloat(r.projected_balance),
        currency: r.currency,
        confidence: r.confidence,
        assumptions: r.assumptions,
        createdAt: r.created_at,
      })),
    });
  });

  // Get reconciliation status
  app.get('/treasury/reconciliations', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId, status } = request.query as Record<string, string>;
    const pool = await getPool();
    
    let query = `
      SELECT r.id, r.bank_account_id, r.statement_date, r.statement_balance,
             r.system_balance, r.difference, r.status, r.notes,
             r.created_at, r.approved_by, r.approved_at,
             ba.account_name, ba.bank_name
      FROM banking.reconciliations r
      JOIN banking.bank_accounts ba ON r.bank_account_id = ba.id
      WHERE r.deleted_at IS NULL
    `;
    const params: unknown[] = [];
    let paramIndex = 1;
    
    if (accountId) {
      query += ` AND r.bank_account_id = $${paramIndex++}`;
      params.push(accountId);
    }
    if (status) {
      query += ` AND r.status = $${paramIndex++}`;
      params.push(status);
    }
    
    query += ' ORDER BY r.statement_date DESC LIMIT 50';
    
    const result = await pool.query(query, params);
    
    return reply.send({
      data: result.rows.map(r => ({
        id: r.id,
        bankAccountId: r.bank_account_id,
        accountName: r.account_name,
        bankName: r.bank_name,
        statementDate: r.statement_date,
        statementBalance: parseFloat(r.statement_balance),
        systemBalance: parseFloat(r.system_balance),
        difference: parseFloat(r.difference),
        status: r.status,
        notes: r.notes,
        approvedBy: r.approved_by,
        approvedAt: r.approved_at,
        createdAt: r.created_at,
      })),
    });
  });

  // Create reconciliation record
  app.post('/treasury/reconciliations', async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      bankAccountId: z.string().uuid(),
      statementDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
      statementBalance: z.number(),
      notes: z.string().max(2000).optional(),
    });
    
    const body = schema.parse(request.body);
    const pool = await getPool();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get current system balance
      const account = await client.query(
        'SELECT balance_amount FROM banking.bank_accounts WHERE id = $1 AND deleted_at IS NULL',
        [body.bankAccountId]
      );
      
      if (!account.rows.length) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Bank account not found' });
      }
      
      const systemBalance = parseFloat(account.rows[0].balance_amount);
      const difference = body.statementBalance - systemBalance;
      const status = Math.abs(difference) < 0.01 ? 'matched' : 'unmatched';
      
      const id = randomUUID();
      const now = new Date();
      
      await client.query(`
        INSERT INTO banking.reconciliations (
          id, bank_account_id, statement_date, statement_balance,
          system_balance, difference, status, notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
      `, [id, body.bankAccountId, body.statementDate, body.statementBalance,
          systemBalance, difference, status, body.notes, now]);
      
      await client.query('COMMIT');
      
      return reply.status(201).send({
        id,
        bankAccountId: body.bankAccountId,
        statementDate: body.statementDate,
        statementBalance: body.statementBalance,
        systemBalance,
        difference,
        status,
        createdAt: now,
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
}
