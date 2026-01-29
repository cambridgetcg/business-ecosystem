/**
 * Reconciliation Rule Value Object
 *
 * Defines matching criteria and behavior for automated reconciliation.
 *
 * @module reconciliation/value-objects
 */

import type {
  MatchCriteria,
  MatchStrategy,
  ToleranceSpec,
} from '../types.js';

/**
 * Reconciliation rule properties.
 */
export interface ReconciliationRuleProps {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly priority: number;
  readonly strategy: MatchStrategy;
  readonly criteria: MatchCriteria[];
  readonly tolerance: ToleranceSpec;
  readonly autoReconcile: boolean;
  readonly requiresApproval: boolean;
  readonly accountTypes?: string[] | undefined;
  readonly minAmount?: number | undefined;
  readonly maxAmount?: number | undefined;
  readonly enabled: boolean;
}

/**
 * Reconciliation Rule value object.
 *
 * Immutable definition of how to match transactions.
 */
export class ReconciliationRule {
  private readonly _props: ReconciliationRuleProps;

  constructor(props: ReconciliationRuleProps) {
    this._props = { ...props };
  }

  get id(): string { return this._props.id; }
  get name(): string { return this._props.name; }
  get description(): string { return this._props.description; }
  get priority(): number { return this._props.priority; }
  get strategy(): MatchStrategy { return this._props.strategy; }
  get criteria(): readonly MatchCriteria[] { return this._props.criteria; }
  get tolerance(): ToleranceSpec { return this._props.tolerance; }
  get autoReconcile(): boolean { return this._props.autoReconcile; }
  get requiresApproval(): boolean { return this._props.requiresApproval; }
  get accountTypes(): readonly string[] | undefined { return this._props.accountTypes; }
  get minAmount(): number | undefined { return this._props.minAmount; }
  get maxAmount(): number | undefined { return this._props.maxAmount; }
  get enabled(): boolean { return this._props.enabled; }

  /**
   * Check if this rule applies to a given account type.
   */
  appliesTo(accountType: string): boolean {
    if (!this._props.accountTypes || this._props.accountTypes.length === 0) {
      return true;
    }
    return this._props.accountTypes.includes(accountType);
  }

  /**
   * Check if amount is within rule's range.
   */
  amountInRange(amount: number): boolean {
    if (this._props.minAmount !== undefined && amount < this._props.minAmount) {
      return false;
    }
    if (this._props.maxAmount !== undefined && amount > this._props.maxAmount) {
      return false;
    }
    return true;
  }

  toProps(): ReconciliationRuleProps {
    return { ...this._props };
  }
}

/**
 * Default reconciliation rules.
 */
export const DEFAULT_RECONCILIATION_RULES: ReconciliationRuleProps[] = [
  {
    id: 'rule-exact-match',
    name: 'Exact Match',
    description: 'Match transactions with identical amount, date, and reference',
    priority: 1,
    strategy: 'one_to_one',
    criteria: [
      { field: 'amount', matchType: 'exact', weight: 0.4 },
      { field: 'transactionDate', matchType: 'exact', weight: 0.3 },
      { field: 'reference', matchType: 'exact', caseSensitive: false, weight: 0.3 },
    ],
    tolerance: {
      minimumMatchScore: 1.0,
    },
    autoReconcile: true,
    requiresApproval: false,
    enabled: true,
  },
  {
    id: 'rule-reference-match',
    name: 'Reference Match with Tolerance',
    description: 'Match by reference with date and amount tolerance',
    priority: 2,
    strategy: 'one_to_one',
    criteria: [
      { field: 'reference', matchType: 'exact', caseSensitive: false, weight: 0.5 },
      { field: 'amount', matchType: 'within_tolerance', toleranceValue: 0.01, toleranceUnit: 'percentage', weight: 0.3 },
      { field: 'transactionDate', matchType: 'within_tolerance', toleranceValue: 2, toleranceUnit: 'days', weight: 0.2 },
    ],
    tolerance: {
      amountTolerance: { value: 0.01, unit: 'percentage' },
      dateTolerance: { days: 2 },
      minimumMatchScore: 0.9,
    },
    autoReconcile: true,
    requiresApproval: false,
    enabled: true,
  },
  {
    id: 'rule-amount-date-match',
    name: 'Amount and Date Match',
    description: 'Match by amount and date when reference missing',
    priority: 3,
    strategy: 'one_to_one',
    criteria: [
      { field: 'amount', matchType: 'exact', weight: 0.5 },
      { field: 'transactionDate', matchType: 'within_tolerance', toleranceValue: 1, toleranceUnit: 'days', weight: 0.3 },
      { field: 'counterpartyName', matchType: 'fuzzy', weight: 0.2 },
    ],
    tolerance: {
      dateTolerance: { days: 1 },
      minimumMatchScore: 0.8,
    },
    autoReconcile: false,
    requiresApproval: true,
    enabled: true,
  },
  {
    id: 'rule-many-to-one',
    name: 'Aggregated Match',
    description: 'Match multiple internal transactions to one bank transaction',
    priority: 4,
    strategy: 'many_to_one',
    criteria: [
      { field: 'amount', matchType: 'within_tolerance', toleranceValue: 0.01, toleranceUnit: 'absolute', weight: 0.6 },
      { field: 'transactionDate', matchType: 'within_tolerance', toleranceValue: 1, toleranceUnit: 'days', weight: 0.4 },
    ],
    tolerance: {
      amountTolerance: { value: 0.01, unit: 'absolute' },
      dateTolerance: { days: 1 },
      minimumMatchScore: 0.95,
    },
    autoReconcile: false,
    requiresApproval: true,
    enabled: true,
  },
];
