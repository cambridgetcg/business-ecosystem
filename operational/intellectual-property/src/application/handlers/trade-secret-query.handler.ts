/**
 * Trade Secret Query Handler
 * Handles queries for trade secret read operations.
 */

import type { TradeSecretRepository } from '../../infrastructure/persistence/trade-secret.repository.js';
import type { TradeSecret } from '../../domain/entities/trade-secret.entity.js';
import type {
  GetTradeSecretByIdQuery,
  GetTradeSecretsByOwnerQuery,
  GetTradeSecretsByCustodianQuery,
  ListTradeSecretsQuery,
  SearchTradeSecretsQuery,
  GetTradeSecretsWithAccessQuery,
  CountTradeSecretsQuery,
} from '../queries/trade-secret.queries.js';

export class TradeSecretQueryHandler {
  constructor(private readonly repository: TradeSecretRepository) {}

  async getById(query: GetTradeSecretByIdQuery): Promise<TradeSecret | null> {
    return this.repository.findById(query.tradeSecretId);
  }

  async getByOwner(query: GetTradeSecretsByOwnerQuery): Promise<TradeSecret[]> {
    return this.repository.findByOwner(query.ownerId);
  }

  async getByCustodian(query: GetTradeSecretsByCustodianQuery): Promise<TradeSecret[]> {
    return this.repository.findByCustodian(query.custodianId);
  }

  async list(query: ListTradeSecretsQuery): Promise<TradeSecret[]> {
    return this.repository.findAll({
      limit: query.limit,
      offset: query.offset,
      status: query.status,
      category: query.category,
      sensitivityLevel: query.sensitivityLevel,
    });
  }

  async search(query: SearchTradeSecretsQuery): Promise<TradeSecret[]> {
    return this.repository.search(query.query, query.limit);
  }

  async getWithAccess(query: GetTradeSecretsWithAccessQuery): Promise<TradeSecret[]> {
    return this.repository.findByUserAccess(query.userId);
  }

  async count(query: CountTradeSecretsQuery): Promise<number> {
    return this.repository.count({
      status: query.status,
      category: query.category,
      ownerId: query.ownerId,
    });
  }
}
