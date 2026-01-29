/**
 * Persistence Layer - Public API
 */

export * from './schema.js';
export * from './database.js';
export { 
  DrizzlePatentRepository, 
  type PatentRepository,
  type FindAllOptions as PatentFindAllOptions,
  type CountFilters as PatentCountFilters
} from './patent.repository.js';
export { 
  DrizzleTrademarkRepository, 
  type TrademarkRepository,
  type FindAllOptions as TrademarkFindAllOptions,
  type CountFilters as TrademarkCountFilters
} from './trademark.repository.js';
export {
  DrizzleLicenseRepository,
  type LicenseRepository,
  type FindAllOptions as LicenseFindAllOptions,
  type CountFilters as LicenseCountFilters
} from './license.repository.js';
export {
  DrizzleCopyrightRepository,
  type CopyrightRepository,
  type FindAllOptions as CopyrightFindAllOptions,
  type CountFilters as CopyrightCountFilters
} from './copyright.repository.js';
export {
  DrizzleTradeSecretRepository,
  type TradeSecretRepository,
  type FindAllOptions as TradeSecretFindAllOptions,
  type CountFilters as TradeSecretCountFilters
} from './trade-secret.repository.js';
export {
  DrizzlePatentFamilyRepository,
  type PatentFamilyRepository,
  type FindAllOptions as PatentFamilyFindAllOptions,
  type CountFilters as PatentFamilyCountFilters
} from './patent-family.repository.js';
export {
  DrizzleMaintenanceFeeRepository,
  type MaintenanceFeeRepository,
  type FindAllOptions as MaintenanceFeeFindAllOptions,
  type CountFilters as MaintenanceFeeCountFilters
} from './maintenance-fee.repository.js';
export {
  DrizzleDomainNameRepository,
  type DomainNameRepository,
  type FindAllOptions as DomainNameFindAllOptions,
  type CountFilters as DomainNameCountFilters
} from './domain-name.repository.js';
