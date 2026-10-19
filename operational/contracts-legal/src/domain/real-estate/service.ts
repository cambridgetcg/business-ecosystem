/**
 * Real Estate - Service Layer
 */

import { Prisma } from '#prisma';
import { PropertyRepository } from './repository.js';
import { CreatePropertyInput, UpdatePropertyInput, PropertyQuery } from './validators.js';
import { NotFoundError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

export class PropertyService {
  private log = logger.child({ domain: 'real-estate' });

  constructor(private repository: PropertyRepository) {}

  async getProperty(id: string) {
    const property = await this.repository.findById(id);
    if (!property) {
      throw new NotFoundError('Property', id);
    }
    return property;
  }

  async listProperties(query: PropertyQuery) {
    const { data, total } = await this.repository.findMany(query);
    return { data, total, page: query.page, limit: query.limit };
  }

  async createProperty(input: CreatePropertyInput, userId: string) {
    const createData: Prisma.PropertyCreateInput = {
      type: input.type,
      addressLine1: input.address.addressLine1,
      city: input.address.city,
      state: input.address.state,
      postalCode: input.address.postalCode,
      country: input.address.country || 'US',
      owned: input.owned,
      createdBy: userId,
      contractIds: input.contractIds || [],
    };

    if (input.address.addressLine2) createData.addressLine2 = input.address.addressLine2;
    if (input.squareFeet) createData.squareFeet = input.squareFeet;
    if (input.lotSize) createData.lotSize = input.lotSize;
    if (input.yearBuilt) createData.yearBuilt = input.yearBuilt;
    if (input.purchaseDate) createData.purchaseDate = input.purchaseDate;
    if (input.purchasePrice) createData.purchasePrice = input.purchasePrice;
    if (input.currentValue) createData.currentValue = input.currentValue;
    if (input.valuationDate) createData.valuationDate = input.valuationDate;

    const property = await this.repository.create(createData);
    this.log.info({ propertyId: property.id }, 'Property created');
    return property;
  }

  async updateProperty(id: string, input: UpdatePropertyInput, userId: string) {
    await this.getProperty(id);

    const updateData: Prisma.PropertyUpdateInput = {};
    if (input.type) updateData.type = input.type;
    if (input.address?.addressLine1) updateData.addressLine1 = input.address.addressLine1;
    if (input.address?.addressLine2) updateData.addressLine2 = input.address.addressLine2;
    if (input.address?.city) updateData.city = input.address.city;
    if (input.address?.state) updateData.state = input.address.state;
    if (input.address?.postalCode) updateData.postalCode = input.address.postalCode;
    if (input.address?.country) updateData.country = input.address.country;
    if (input.squareFeet) updateData.squareFeet = input.squareFeet;
    if (input.lotSize) updateData.lotSize = input.lotSize;
    if (input.yearBuilt) updateData.yearBuilt = input.yearBuilt;
    if (input.owned !== undefined) updateData.owned = input.owned;
    if (input.purchaseDate) updateData.purchaseDate = input.purchaseDate;
    if (input.purchasePrice) updateData.purchasePrice = input.purchasePrice;
    if (input.currentValue) updateData.currentValue = input.currentValue;
    if (input.valuationDate) updateData.valuationDate = input.valuationDate;
    if (input.contractIds) updateData.contractIds = input.contractIds;

    const property = await this.repository.update(id, updateData);
    this.log.info({ propertyId: id }, 'Property updated');
    return property;
  }

  async deleteProperty(id: string) {
    await this.getProperty(id);
    await this.repository.delete(id);
    this.log.info({ propertyId: id }, 'Property deleted');
  }

  async getPortfolioSummary() {
    const [value, byType] = await Promise.all([
      this.repository.getPortfolioValue(),
      this.repository.getByType(),
    ]);

    return { value, byType };
  }
}

export function createPropertyService(repository: PropertyRepository): PropertyService {
  return new PropertyService(repository);
}
