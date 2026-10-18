/**
 * Plaid API Client Wrapper
 *
 * Production-ready Plaid API integration for:
 * - Link token creation for Plaid Link initialization
 * - Public token exchange for access tokens
 * - Account information retrieval
 * - Transaction synchronization
 * - Institution data fetching
 *
 * @module infrastructure/plaid
 */

import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  type LinkTokenCreateRequest,
  type ItemPublicTokenExchangeRequest,
  type AccountsGetRequest,
  type TransactionsSyncRequest,
  type ItemGetRequest,
  type InstitutionsGetByIdRequest,
  type ItemRemoveRequest,
  type AccountBase,
  type Transaction,
  type RemovedTransaction,
} from 'plaid';
import pino from 'pino';
import { env } from '../../env.js';

const logger = pino({ name: 'plaid-client' });

/**
 * Plaid environment mapping.
 */
const PLAID_ENV_MAP = {
  sandbox: PlaidEnvironments.sandbox,
  development: PlaidEnvironments.development,
  production: PlaidEnvironments.production,
} as const;

/**
 * Product string to Plaid Products enum mapping.
 */
const PRODUCT_MAP: Record<string, Products> = {
  auth: Products.Auth,
  transactions: Products.Transactions,
  identity: Products.Identity,
  assets: Products.Assets,
  liabilities: Products.Liabilities,
  investments: Products.Investments,
  transfer: Products.Transfer,
  employment: Products.Employment,
  income_verification: Products.IncomeVerification,
};

/**
 * Country code string to Plaid CountryCode enum mapping.
 */
const COUNTRY_MAP: Record<string, CountryCode> = {
  US: CountryCode.Us,
  GB: CountryCode.Gb,
  ES: CountryCode.Es,
  NL: CountryCode.Nl,
  FR: CountryCode.Fr,
  IE: CountryCode.Ie,
  CA: CountryCode.Ca,
  DE: CountryCode.De,
  IT: CountryCode.It,
  PL: CountryCode.Pl,
  DK: CountryCode.Dk,
  NO: CountryCode.No,
  SE: CountryCode.Se,
  EE: CountryCode.Ee,
  LT: CountryCode.Lt,
  LV: CountryCode.Lv,
  PT: CountryCode.Pt,
  BE: CountryCode.Be,
};

/**
 * Link token creation request.
 */
export interface CreateLinkTokenRequest {
  userId: string;
  clientName: string;
  products: string[];
  countryCodes: string[];
  language?: string;
  webhook?: string;
  redirectUri?: string;
  accessToken?: string; // For update mode (re-authentication)
}

/**
 * Link token response.
 */
export interface LinkTokenResponse {
  linkToken: string;
  expiration: string;
  requestId: string;
}

/**
 * Access token exchange response.
 */
export interface AccessTokenResponse {
  accessToken: string;
  itemId: string;
  requestId: string;
}

/**
 * Normalized account information.
 */
export interface PlaidAccountInfo {
  accountId: string;
  mask: string | null;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  balances: {
    available: number | null;
    current: number | null;
    limit: number | null;
    isoCurrencyCode: string | null;
    unofficialCurrencyCode: string | null;
  };
  verificationStatus: string | null;
}

/**
 * Normalized transaction.
 */
export interface PlaidTransactionInfo {
  transactionId: string;
  accountId: string;
  amount: number;
  isoCurrencyCode: string | null;
  unofficialCurrencyCode: string | null;
  date: string;
  datetime: string | null;
  authorizedDate: string | null;
  authorizedDatetime: string | null;
  name: string;
  merchantName: string | null;
  merchantEntityId: string | null;
  category: string[];
  categoryId: string | null;
  pending: boolean;
  pendingTransactionId: string | null;
  paymentChannel: string;
  transactionType: string | null;
  transactionCode: string | null;
  checkNumber: string | null;
  location: {
    address: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    country: string | null;
    lat: number | null;
    lon: number | null;
    storeNumber: string | null;
  };
  personalFinanceCategory: {
    primary: string;
    detailed: string;
    confidenceLevel: string | null;
  } | null;
}

/**
 * Transaction sync response.
 */
export interface TransactionSyncResponse {
  added: PlaidTransactionInfo[];
  modified: PlaidTransactionInfo[];
  removed: string[]; // Transaction IDs
  nextCursor: string;
  hasMore: boolean;
  requestId: string;
}

/**
 * Item information.
 */
export interface ItemInfo {
  itemId: string;
  institutionId: string | null;
  webhook: string | null;
  availableProducts: string[];
  billedProducts: string[];
  consentExpirationTime: string | null;
  updateType: string;
  error: {
    errorType: string;
    errorCode: string;
    errorMessage: string;
    displayMessage: string | null;
  } | null;
}

/**
 * Institution information.
 */
export interface InstitutionInfo {
  institutionId: string;
  name: string;
  products: string[];
  countryCodes: string[];
  url: string | null;
  primaryColor: string | null;
  logo: string | null;
  routingNumbers: string[];
}

/**
 * Plaid API Client
 *
 * Wraps the Plaid Node SDK with:
 * - Type-safe interfaces
 * - Error handling and logging
 * - Response normalization
 * - Environment configuration
 */
export class PlaidClient {
  private readonly client: PlaidApi;
  private readonly webhookUrl: string | undefined;

  constructor() {
    const plaidEnv = env.PLAID_ENVIRONMENT ?? 'sandbox';
    const basePath = PLAID_ENV_MAP[plaidEnv];

    if (!basePath) {
      throw new Error(`Invalid Plaid environment: ${plaidEnv}`);
    }

    const configuration = new Configuration({
      basePath,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': env.PLAID_CLIENT_ID,
          'PLAID-SECRET': env.PLAID_SECRET,
        },
      },
    });

    this.client = new PlaidApi(configuration);
    this.webhookUrl = env.PLAID_WEBHOOK_URL;

    logger.info({ environment: plaidEnv }, 'Plaid client initialized');
  }

  /**
   * Create a link token for Plaid Link initialization.
   */
  async createLinkToken(request: CreateLinkTokenRequest): Promise<LinkTokenResponse> {
    logger.info({ userId: request.userId, products: request.products }, 'Creating link token');

    const products = request.products
      .map(p => PRODUCT_MAP[p])
      .filter((p): p is Products => p !== undefined);

    const countryCodes = request.countryCodes
      .map(c => COUNTRY_MAP[c.toUpperCase()])
      .filter((c): c is CountryCode => c !== undefined);

    if (products.length === 0) {
      throw new Error('At least one valid product is required');
    }

    if (countryCodes.length === 0) {
      throw new Error('At least one valid country code is required');
    }

    const linkTokenRequest: LinkTokenCreateRequest = {
      user: {
        client_user_id: request.userId,
      },
      client_name: request.clientName,
      products,
      country_codes: countryCodes,
      language: request.language ?? 'en',
      webhook: request.webhook ?? this.webhookUrl,
      redirect_uri: request.redirectUri,
      access_token: request.accessToken,
    };

    try {
      const response = await this.client.linkTokenCreate(linkTokenRequest);

      logger.info(
        { requestId: response.data.request_id },
        'Link token created successfully'
      );

      return {
        linkToken: response.data.link_token,
        expiration: response.data.expiration,
        requestId: response.data.request_id,
      };
    } catch (error) {
      this.handlePlaidError(error, 'createLinkToken');
      throw error;
    }
  }

  /**
   * Exchange a public token for an access token.
   */
  async exchangePublicToken(publicToken: string): Promise<AccessTokenResponse> {
    logger.info('Exchanging public token');

    const request: ItemPublicTokenExchangeRequest = {
      public_token: publicToken,
    };

    try {
      const response = await this.client.itemPublicTokenExchange(request);

      logger.info(
        { itemId: response.data.item_id, requestId: response.data.request_id },
        'Public token exchanged successfully'
      );

      return {
        accessToken: response.data.access_token,
        itemId: response.data.item_id,
        requestId: response.data.request_id,
      };
    } catch (error) {
      this.handlePlaidError(error, 'exchangePublicToken');
      throw error;
    }
  }

  /**
   * Get accounts for an access token.
   */
  async getAccounts(accessToken: string): Promise<PlaidAccountInfo[]> {
    logger.info('Fetching accounts');

    const request: AccountsGetRequest = {
      access_token: accessToken,
    };

    try {
      const response = await this.client.accountsGet(request);

      logger.info(
        { accountCount: response.data.accounts.length, requestId: response.data.request_id },
        'Accounts fetched successfully'
      );

      return response.data.accounts.map(this.normalizeAccount);
    } catch (error) {
      this.handlePlaidError(error, 'getAccounts');
      throw error;
    }
  }

  /**
   * Sync transactions using the transaction sync API.
   * This is the recommended approach for getting transaction updates.
   */
  async syncTransactions(
    accessToken: string,
    cursor?: string,
    count?: number
  ): Promise<TransactionSyncResponse> {
    logger.info({ cursor, count }, 'Syncing transactions');

    const request: TransactionsSyncRequest = {
      access_token: accessToken,
      cursor,
      count,
    };

    try {
      const response = await this.client.transactionsSync(request);

      logger.info(
        {
          added: response.data.added.length,
          modified: response.data.modified.length,
          removed: response.data.removed.length,
          hasMore: response.data.has_more,
          requestId: response.data.request_id,
        },
        'Transactions synced successfully'
      );

      return {
        added: response.data.added.map(this.normalizeTransaction),
        modified: response.data.modified.map(this.normalizeTransaction),
        removed: response.data.removed.map((r: RemovedTransaction) => r.transaction_id),
        nextCursor: response.data.next_cursor,
        hasMore: response.data.has_more,
        requestId: response.data.request_id,
      };
    } catch (error) {
      this.handlePlaidError(error, 'syncTransactions');
      throw error;
    }
  }

  /**
   * Get all transactions by paginating through sync API.
   */
  async getAllTransactions(
    accessToken: string,
    cursor?: string
  ): Promise<{
    transactions: PlaidTransactionInfo[];
    finalCursor: string;
  }> {
    const allTransactions: PlaidTransactionInfo[] = [];
    let currentCursor = cursor;
    let hasMore = true;

    while (hasMore) {
      const response = await this.syncTransactions(accessToken, currentCursor);
      allTransactions.push(...response.added, ...response.modified);
      currentCursor = response.nextCursor;
      hasMore = response.hasMore;
    }

    return {
      transactions: allTransactions,
      finalCursor: currentCursor ?? '',
    };
  }

  /**
   * Get item information.
   */
  async getItem(accessToken: string): Promise<ItemInfo> {
    logger.info('Fetching item information');

    const request: ItemGetRequest = {
      access_token: accessToken,
    };

    try {
      const response = await this.client.itemGet(request);
      const item = response.data.item;

      logger.info(
        { itemId: item.item_id, requestId: response.data.request_id },
        'Item fetched successfully'
      );

      return {
        itemId: item.item_id,
        institutionId: item.institution_id ?? null,
        webhook: item.webhook ?? null,
        availableProducts: item.available_products ?? [],
        billedProducts: item.billed_products ?? [],
        consentExpirationTime: item.consent_expiration_time ?? null,
        updateType: item.update_type ?? 'background',
        error: response.data.status?.transactions?.last_failed_update
          ? {
              errorType: 'ITEM_ERROR',
              errorCode: 'TRANSACTIONS_SYNC_ERROR',
              errorMessage: 'Transaction sync failed',
              displayMessage: null,
            }
          : null,
      };
    } catch (error) {
      this.handlePlaidError(error, 'getItem');
      throw error;
    }
  }

  /**
   * Get institution information by ID.
   */
  async getInstitution(
    institutionId: string,
    countryCodes: string[] = ['US']
  ): Promise<InstitutionInfo> {
    logger.info({ institutionId }, 'Fetching institution information');

    const countryCodesEnum = countryCodes
      .map(c => COUNTRY_MAP[c.toUpperCase()])
      .filter((c): c is CountryCode => c !== undefined);

    const request: InstitutionsGetByIdRequest = {
      institution_id: institutionId,
      country_codes: countryCodesEnum.length > 0 ? countryCodesEnum : [CountryCode.Us],
      options: {
        include_optional_metadata: true,
      },
    };

    try {
      const response = await this.client.institutionsGetById(request);
      const institution = response.data.institution;

      logger.info(
        { institutionId, name: institution.name, requestId: response.data.request_id },
        'Institution fetched successfully'
      );

      return {
        institutionId: institution.institution_id,
        name: institution.name,
        products: institution.products ?? [],
        countryCodes: institution.country_codes ?? [],
        url: institution.url ?? null,
        primaryColor: institution.primary_color ?? null,
        logo: institution.logo ?? null,
        routingNumbers: institution.routing_numbers ?? [],
      };
    } catch (error) {
      this.handlePlaidError(error, 'getInstitution');
      throw error;
    }
  }

  /**
   * Remove an item (unlink the bank account).
   */
  async removeItem(accessToken: string): Promise<{ requestId: string }> {
    logger.info('Removing item');

    const request: ItemRemoveRequest = {
      access_token: accessToken,
    };

    try {
      const response = await this.client.itemRemove(request);

      logger.info(
        { requestId: response.data.request_id },
        'Item removed successfully'
      );

      return {
        requestId: response.data.request_id,
      };
    } catch (error) {
      this.handlePlaidError(error, 'removeItem');
      throw error;
    }
  }

  /**
   * Update item webhook URL.
   */
  async updateWebhook(accessToken: string, webhookUrl: string): Promise<{ requestId: string }> {
    logger.info({ webhookUrl }, 'Updating item webhook');

    try {
      const response = await this.client.itemWebhookUpdate({
        access_token: accessToken,
        webhook: webhookUrl,
      });

      logger.info(
        { requestId: response.data.request_id },
        'Webhook updated successfully'
      );

      return {
        requestId: response.data.request_id,
      };
    } catch (error) {
      this.handlePlaidError(error, 'updateWebhook');
      throw error;
    }
  }

  /**
   * Normalize a Plaid account to our internal format.
   */
  private normalizeAccount = (account: AccountBase): PlaidAccountInfo => ({
    accountId: account.account_id,
    mask: account.mask,
    name: account.name,
    officialName: account.official_name,
    type: account.type,
    subtype: account.subtype ?? null,
    balances: {
      available: account.balances.available,
      current: account.balances.current,
      limit: account.balances.limit ?? null,
      isoCurrencyCode: account.balances.iso_currency_code,
      unofficialCurrencyCode: account.balances.unofficial_currency_code,
    },
    verificationStatus: account.verification_status ?? null,
  });

  /**
   * Normalize a Plaid transaction to our internal format.
   */
  private normalizeTransaction = (transaction: Transaction): PlaidTransactionInfo => ({
    transactionId: transaction.transaction_id,
    accountId: transaction.account_id,
    amount: transaction.amount,
    isoCurrencyCode: transaction.iso_currency_code,
    unofficialCurrencyCode: transaction.unofficial_currency_code,
    date: transaction.date,
    datetime: transaction.datetime ?? null,
    authorizedDate: transaction.authorized_date ?? null,
    authorizedDatetime: transaction.authorized_datetime ?? null,
    name: transaction.name,
    merchantName: transaction.merchant_name ?? null,
    merchantEntityId: transaction.merchant_entity_id ?? null,
    category: transaction.category ?? [],
    categoryId: transaction.category_id ?? null,
    pending: transaction.pending,
    pendingTransactionId: transaction.pending_transaction_id ?? null,
    paymentChannel: transaction.payment_channel,
    transactionType: transaction.transaction_type ?? null,
    transactionCode: transaction.transaction_code ?? null,
    checkNumber: transaction.check_number ?? null,
    location: {
      address: transaction.location?.address ?? null,
      city: transaction.location?.city ?? null,
      region: transaction.location?.region ?? null,
      postalCode: transaction.location?.postal_code ?? null,
      country: transaction.location?.country ?? null,
      lat: transaction.location?.lat ?? null,
      lon: transaction.location?.lon ?? null,
      storeNumber: transaction.location?.store_number ?? null,
    },
    personalFinanceCategory: transaction.personal_finance_category
      ? {
          primary: transaction.personal_finance_category.primary,
          detailed: transaction.personal_finance_category.detailed,
          confidenceLevel: transaction.personal_finance_category.confidence_level ?? null,
        }
      : null,
  });

  /**
   * Handle and log Plaid API errors.
   */
  private handlePlaidError(error: unknown, operation: string): void {
    if (this.isPlaidError(error)) {
      const plaidError = error.response?.data;
      logger.error(
        {
          operation,
          errorType: plaidError?.error_type,
          errorCode: plaidError?.error_code,
          errorMessage: plaidError?.error_message,
          displayMessage: plaidError?.display_message,
          requestId: plaidError?.request_id,
        },
        'Plaid API error'
      );
    } else {
      logger.error({ operation, error }, 'Unexpected error calling Plaid API');
    }
  }

  /**
   * Type guard for Plaid errors.
   */
  private isPlaidError(
    error: unknown
  ): error is { response: { data: { error_type: string; error_code: string; error_message: string; display_message?: string; request_id: string } } } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof (error as { response?: unknown }).response === 'object' &&
      (error as { response?: { data?: unknown } }).response !== null &&
      'data' in ((error as { response: { data?: unknown } }).response ?? {})
    );
  }
}

// Singleton instance
let plaidClient: PlaidClient | null = null;

/**
 * Get the Plaid client singleton.
 * Lazily initialized to allow for late environment variable binding.
 */
export function getPlaidClient(): PlaidClient {
  if (!plaidClient) {
    plaidClient = new PlaidClient();
  }
  return plaidClient;
}

/**
 * Reset the Plaid client (useful for testing).
 */
export function resetPlaidClient(): void {
  plaidClient = null;
}
