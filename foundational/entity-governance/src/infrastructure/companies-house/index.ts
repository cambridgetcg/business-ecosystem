/**
 * Companies House Integration
 *
 * Provides integration with UK Companies House for:
 * - Company search and profile retrieval
 * - Filing history and document access
 * - Officer and PSC information
 * - Filing submissions (Confirmation Statements, Director changes, PSC notifications)
 *
 * @example
 * ```typescript
 * import {
 *   getCompaniesHouseClient,
 *   getFilingService,
 * } from './infrastructure/companies-house/index.js';
 *
 * // Search for companies
 * const client = getCompaniesHouseClient();
 * const results = await client.searchCompanies('Acme Ltd');
 *
 * // Get company profile
 * const profile = await client.getCompanyProfile('12345678');
 *
 * // Create and submit a confirmation statement
 * const filingService = getFilingService();
 * const filing = await filingService.createConfirmationStatement('12345678', {
 *   confirmationStatementDate: new Date(),
 *   shareholderChanges: false,
 *   officerChanges: true,
 *   pscChanges: false,
 *   registeredOfficeChanges: false,
 *   tradingStatusStatement: false,
 * });
 * await filingService.submitFiling(filing.id);
 * ```
 */

// API Client
export {
  CompaniesHouseClient,
  getCompaniesHouseClient,
  createCompaniesHouseClient,
  type CompaniesHouseClientConfig,
  // Response types
  type CompanyProfile,
  type CompanySearchResult,
  type SearchResponse,
  type FilingHistoryItem,
  type FilingHistoryResponse,
  type Officer,
  type OfficerListResponse,
  type PSC,
  type PSCListResponse,
  // Schemas for validation
  CompanyProfileSchema,
  CompanySearchResultSchema,
  SearchResponseSchema,
  FilingHistoryItemSchema,
  FilingHistoryResponseSchema,
  OfficerSchema,
  OfficerListResponseSchema,
  PSCSchema,
  PSCListResponseSchema,
  // Errors
  CompaniesHouseApiError,
  RateLimitError,
} from './api-client.js';

// Filing Service
export {
  CompaniesHouseFilingService,
  getFilingService,
  createFilingService,
  type FilingServiceConfig,
  type FilingRecord,
  type FilingValidationResult,
  type FilingSubmissionResult,
  // Filing types
  type FilingType,
  type FilingStatus,
  FilingTypeSchema,
  FilingStatusSchema,
  // Filing data types
  type Address,
  type DirectorAppointmentData,
  type DirectorTerminationData,
  type DirectorChangeData,
  type ConfirmationStatementData,
  type PSCNotificationData,
  type RegisteredOfficeChangeData,
  type FilingData,
  // Schemas
  AddressSchema,
  DirectorAppointmentDataSchema,
  DirectorTerminationDataSchema,
  DirectorChangeDataSchema,
  ConfirmationStatementDataSchema,
  PSCNotificationDataSchema,
  RegisteredOfficeChangeDataSchema,
  FilingDataSchema,
} from './filing-service.js';
