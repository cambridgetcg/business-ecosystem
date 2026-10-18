/**
 * Foreign Exchange Service
 *
 * Provides FX rate quotes, conversions, and hedging support.
 *
 * @module services/fx/fx-service
 */

import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../../infrastructure/database.js';
import { cacheService } from '../../infrastructure/cache/cache-service.js';

const logger = pino({ name: 'fx-service' });

/**
 * FX Rate quote.
 */
export interface FXQuote {
  quoteId: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  inverseRate: number;
  bid: number;
  ask: number;
  spread: number;
  spreadPercentage: number;
  source: string;
  timestamp: Date;
  expiresAt: Date;
  isIndicative: boolean;
}

/**
 * FX Conversion result.
 */
export interface FXConversion {
  conversionId: string;
  quoteId?: string;
  fromAmount: number;
  fromCurrency: string;
  toAmount: number;
  toCurrency: string;
  rate: number;
  fee: number;
  feeCurrency: string;
  netAmount: number;
  executedAt: Date;
  status: 'pending' | 'completed' | 'failed';
  reference?: string;
}

/**
 * Supported currency pairs.
 */
export interface CurrencyPair {
  base: string;
  quote: string;
  minAmount: number;
  maxAmount: number;
  isActive: boolean;
}

/**
 * Rate history entry.
 */
export interface RateHistoryEntry {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * FX Service
 *
 * Handles foreign exchange operations including rate quotes,
 * conversions, and historical rate tracking.
 */
export class FXService {
  // Base rates relative to USD (mock data for development)
  private readonly baseRates: Map<string, number> = new Map([
    ['EUR', 0.92],
    ['GBP', 0.79],
    ['JPY', 149.50],
    ['CAD', 1.36],
    ['AUD', 1.53],
    ['CHF', 0.88],
    ['CNY', 7.24],
    ['MXN', 17.12],
    ['SGD', 1.34],
    ['HKD', 7.82],
  ]);

  // Spread by currency pair (in basis points)
  private readonly spreads: Map<string, number> = new Map([
    ['EUR/USD', 5],
    ['GBP/USD', 8],
    ['USD/JPY', 10],
    ['default', 15],
  ]);

  /**
   * Get a real-time FX rate quote.
   */
  async getQuote(
    baseCurrency: string,
    quoteCurrency: string,
    amount?: number
  ): Promise<FXQuote> {
    const cacheKey = `fx-quote:${baseCurrency}:${quoteCurrency}`;

    // Check cache for recent quote
    const cached = await cacheService.get<FXQuote>(cacheKey);
    if (cached && new Date(cached.expiresAt) > new Date()) {
      return cached;
    }

    // Calculate rate
    const rate = await this.calculateRate(baseCurrency, quoteCurrency);
    const pair = `${baseCurrency}/${quoteCurrency}`;
    const spreadBps = this.spreads.get(pair) ?? this.spreads.get('default')!;
    const spreadDecimal = spreadBps / 10000;

    const bid = rate * (1 - spreadDecimal / 2);
    const ask = rate * (1 + spreadDecimal / 2);

    const quote: FXQuote = {
      quoteId: uuidv4(),
      baseCurrency,
      quoteCurrency,
      rate,
      inverseRate: 1 / rate,
      bid,
      ask,
      spread: ask - bid,
      spreadPercentage: spreadDecimal * 100,
      source: 'internal',
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 30 * 1000), // 30 second validity
      isIndicative: amount === undefined || amount > 1000000,
    };

    // Cache for 10 seconds
    await cacheService.set(cacheKey, quote, 10);

    // Store rate in database for history
    await this.storeRate(baseCurrency, quoteCurrency, rate);

    logger.info({ baseCurrency, quoteCurrency, rate }, 'Generated FX quote');

    return quote;
  }

  /**
   * Execute an FX conversion.
   */
  async executeConversion(
    fromAmount: number,
    fromCurrency: string,
    toCurrency: string,
    quoteId?: string,
    reference?: string
  ): Promise<FXConversion> {
    const pool = await getPool();

    // Get current rate (or use quote if provided)
    let rate: number;
    if (quoteId) {
      // Validate quote is still valid
      const cached = await cacheService.get<FXQuote>(`fx-quote:${fromCurrency}:${toCurrency}`);
      if (cached && cached.quoteId === quoteId && new Date(cached.expiresAt) > new Date()) {
        rate = cached.ask; // Use ask rate for buying the target currency
      } else {
        throw new Error('Quote has expired');
      }
    } else {
      const quote = await this.getQuote(fromCurrency, toCurrency);
      rate = quote.ask;
    }

    // Calculate amounts
    const grossAmount = fromAmount * rate;
    const feePercentage = this.calculateFee(fromAmount);
    const fee = fromAmount * feePercentage;
    const netAmount = grossAmount;

    const conversionId = uuidv4();

    // Record the conversion
    await pool.query(`
      INSERT INTO banking.fx_conversions (
        id, from_amount, from_currency, to_amount, to_currency,
        rate, fee, fee_currency, quote_id, reference, status, executed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'completed', NOW())
    `, [
      conversionId,
      fromAmount,
      fromCurrency,
      netAmount,
      toCurrency,
      rate,
      fee,
      fromCurrency,
      quoteId,
      reference,
    ]);

    const conversion: FXConversion = {
      conversionId,
      quoteId,
      fromAmount,
      fromCurrency,
      toAmount: netAmount,
      toCurrency,
      rate,
      fee,
      feeCurrency: fromCurrency,
      netAmount,
      executedAt: new Date(),
      status: 'completed',
      reference,
    };

    logger.info({
      conversionId,
      fromAmount,
      fromCurrency,
      toAmount: netAmount,
      toCurrency,
      rate,
    }, 'Executed FX conversion');

    return conversion;
  }

  /**
   * Get supported currency pairs.
   */
  async getSupportedPairs(): Promise<CurrencyPair[]> {
    const pairs: CurrencyPair[] = [];
    const currencies = ['USD', ...this.baseRates.keys()];

    for (const base of currencies) {
      for (const quote of currencies) {
        if (base !== quote) {
          pairs.push({
            base,
            quote,
            minAmount: 100,
            maxAmount: 10000000,
            isActive: true,
          });
        }
      }
    }

    return pairs;
  }

  /**
   * Get historical rates for a currency pair.
   */
  async getRateHistory(
    baseCurrency: string,
    quoteCurrency: string,
    startDate: string,
    endDate: string,
    granularity: 'hourly' | 'daily' | 'weekly' = 'daily'
  ): Promise<RateHistoryEntry[]> {
    const pool = await getPool();

    // Try to get from database first
    const result = await pool.query(`
      SELECT
        DATE(timestamp) as date,
        MIN(rate) as low,
        MAX(rate) as high,
        (array_agg(rate ORDER BY timestamp))[1] as open,
        (array_agg(rate ORDER BY timestamp DESC))[1] as close
      FROM banking.fx_rates
      WHERE base_currency = $1
        AND quote_currency = $2
        AND timestamp >= $3
        AND timestamp <= $4
      GROUP BY DATE(timestamp)
      ORDER BY date
    `, [baseCurrency, quoteCurrency, startDate, endDate]);

    if (result.rows.length > 0) {
      return result.rows.map(row => ({
        date: row.date.toISOString().split('T')[0],
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
      }));
    }

    // Generate mock historical data if none exists
    return this.generateMockHistory(baseCurrency, quoteCurrency, startDate, endDate);
  }

  /**
   * Get conversion history for an entity.
   */
  async getConversionHistory(
    entityId: string,
    startDate?: string,
    endDate?: string,
    limit = 50
  ): Promise<FXConversion[]> {
    const pool = await getPool();

    let query = `
      SELECT *
      FROM banking.fx_conversions
      WHERE entity_id = $1
    `;
    const params: unknown[] = [entityId];
    let paramIndex = 2;

    if (startDate) {
      query += ` AND executed_at >= $${paramIndex++}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND executed_at <= $${paramIndex++}`;
      params.push(endDate);
    }

    query += ` ORDER BY executed_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await pool.query(query, params);

    return result.rows.map(row => ({
      conversionId: row.id,
      quoteId: row.quote_id,
      fromAmount: parseFloat(row.from_amount),
      fromCurrency: row.from_currency,
      toAmount: parseFloat(row.to_amount),
      toCurrency: row.to_currency,
      rate: parseFloat(row.rate),
      fee: parseFloat(row.fee),
      feeCurrency: row.fee_currency,
      netAmount: parseFloat(row.to_amount),
      executedAt: new Date(row.executed_at),
      status: row.status,
      reference: row.reference,
    }));
  }

  /**
   * Calculate cross rate between two non-USD currencies.
   */
  private async calculateRate(baseCurrency: string, quoteCurrency: string): Promise<number> {
    if (baseCurrency === quoteCurrency) {
      return 1;
    }

    // Get rates relative to USD
    let baseToUsd = 1;
    let quoteToUsd = 1;

    if (baseCurrency !== 'USD') {
      baseToUsd = this.baseRates.get(baseCurrency) ?? 1;
    }

    if (quoteCurrency !== 'USD') {
      quoteToUsd = this.baseRates.get(quoteCurrency) ?? 1;
    }

    // Calculate cross rate
    // If base is USD: rate = quoteToUsd (e.g., USD/EUR = 0.92)
    // If quote is USD: rate = 1/baseToUsd (e.g., EUR/USD = 1/0.92 = 1.087)
    // If neither is USD: rate = quoteToUsd/baseToUsd

    if (baseCurrency === 'USD') {
      return quoteToUsd;
    } else if (quoteCurrency === 'USD') {
      return 1 / baseToUsd;
    } else {
      return quoteToUsd / baseToUsd;
    }
  }

  /**
   * Calculate fee based on amount.
   */
  private calculateFee(amount: number): number {
    // Tiered fee structure
    if (amount >= 1000000) return 0.0005; // 5 bps for 1M+
    if (amount >= 100000) return 0.001; // 10 bps for 100K-1M
    if (amount >= 10000) return 0.002; // 20 bps for 10K-100K
    return 0.005; // 50 bps for <10K
  }

  /**
   * Store rate in database for historical tracking.
   */
  private async storeRate(
    baseCurrency: string,
    quoteCurrency: string,
    rate: number
  ): Promise<void> {
    try {
      const pool = await getPool();
      await pool.query(`
        INSERT INTO banking.fx_rates (base_currency, quote_currency, rate, source, updated_at)
        VALUES ($1, $2, $3, 'internal', NOW())
        ON CONFLICT (base_currency, quote_currency)
        DO UPDATE SET rate = $3, updated_at = NOW()
      `, [baseCurrency, quoteCurrency, rate]);
    } catch (error) {
      // Log but don't fail if rate storage fails
      logger.warn({ error, baseCurrency, quoteCurrency }, 'Failed to store FX rate');
    }
  }

  /**
   * Generate mock historical data.
   */
  private generateMockHistory(
    baseCurrency: string,
    quoteCurrency: string,
    startDate: string,
    endDate: string
  ): RateHistoryEntry[] {
    const history: RateHistoryEntry[] = [];
    const baseRate = this.baseRates.get(quoteCurrency) ?? 1;
    const baseBaseRate = this.baseRates.get(baseCurrency) ?? 1;
    const midRate = baseRate / baseBaseRate;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const dayMs = 24 * 60 * 60 * 1000;

    let currentDate = start;
    let lastClose = midRate;

    while (currentDate <= end) {
      // Add some randomness
      const volatility = 0.005; // 0.5% daily volatility
      const change = (Math.random() - 0.5) * 2 * volatility;

      const open = lastClose;
      const close = open * (1 + change);
      const high = Math.max(open, close) * (1 + Math.random() * volatility);
      const low = Math.min(open, close) * (1 - Math.random() * volatility);

      history.push({
        date: currentDate.toISOString().split('T')[0],
        open: parseFloat(open.toFixed(6)),
        high: parseFloat(high.toFixed(6)),
        low: parseFloat(low.toFixed(6)),
        close: parseFloat(close.toFixed(6)),
      });

      lastClose = close;
      currentDate = new Date(currentDate.getTime() + dayMs);
    }

    return history;
  }
}

// Singleton instance
export const fxService = new FXService();
