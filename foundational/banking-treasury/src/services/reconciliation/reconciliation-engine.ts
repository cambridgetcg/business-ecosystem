/**
 * Reconciliation Engine
 *
 * Automated transaction matching with rule-based logic,
 * exception handling, and auto-resolution capabilities.
 *
 * @see docs/research/nuances/15_RECONCILIATION_EDGE_CASES.md
 * @module services/reconciliation
 */

import type { Money } from '../../types/financial.js';
import type {
  ReconciliationItem,
  MatchResult,
  MatchDiscrepancy,
  MatchStrategy,
  ReconciliationStats,
  ExceptionType,
  ExceptionPriority,
} from '../../domain/reconciliation/types.js';
import {
  ReconciliationRule,
  type ReconciliationRuleProps,
  DEFAULT_RECONCILIATION_RULES,
} from '../../domain/reconciliation/value-objects/reconciliation-rule.js';
import {
  ReconciliationException,
  type ReconciliationExceptionProps,
} from '../../domain/reconciliation/entities/reconciliation-exception.js';

/**
 * Reconciliation run result.
 */
export interface ReconciliationRunResult {
  readonly runId: string;
  readonly accountId: string;
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly matches: MatchResult[];
  readonly exceptions: ReconciliationException[];
  readonly stats: ReconciliationStats;
}

/**
 * Reconciliation Engine
 *
 * Provides automated transaction matching with:
 * - Configurable matching rules
 * - Multiple match strategies (1:1, 1:N, N:1, N:N)
 * - Tolerance-based matching
 * - Exception management
 * - Auto-resolution for clear matches
 */
export class ReconciliationEngine {
  private readonly rules: ReconciliationRule[] = [];

  constructor(ruleConfigs?: ReconciliationRuleProps[]) {
    const configs = ruleConfigs ?? DEFAULT_RECONCILIATION_RULES;
    this.rules = configs
      .map(config => new ReconciliationRule(config))
      .filter(rule => rule.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Run reconciliation for an account.
   */
  async runReconciliation(
    accountId: string,
    internalItems: ReconciliationItem[],
    externalItems: ReconciliationItem[]
  ): Promise<ReconciliationRunResult> {
    const runId = this.generateRunId();
    const startedAt = new Date();

    const matches: MatchResult[] = [];
    const exceptions: ReconciliationException[] = [];

    // Track which items have been matched
    const matchedInternal = new Set<string>();
    const matchedExternal = new Set<string>();

    // Apply rules in priority order
    for (const rule of this.rules) {
      const unmatchedInternal = internalItems.filter(
        item => !matchedInternal.has(item.id) && rule.amountInRange(item.amount.amount)
      );
      const unmatchedExternal = externalItems.filter(
        item => !matchedExternal.has(item.id) && rule.amountInRange(item.amount.amount)
      );

      const ruleMatches = this.applyRule(
        rule,
        unmatchedInternal,
        unmatchedExternal
      );

      for (const match of ruleMatches) {
        matches.push(match);
        match.internalItems.forEach(item => matchedInternal.add(item.id));
        match.externalItems.forEach(item => matchedExternal.add(item.id));
      }
    }

    // Create exceptions for unmatched items
    const unmatchedInternalItems = internalItems.filter(
      item => !matchedInternal.has(item.id)
    );
    const unmatchedExternalItems = externalItems.filter(
      item => !matchedExternal.has(item.id)
    );

    for (const item of unmatchedInternalItems) {
      exceptions.push(this.createException(
        accountId,
        runId,
        'missing_counterpart',
        item,
        undefined
      ));
    }

    for (const item of unmatchedExternalItems) {
      exceptions.push(this.createException(
        accountId,
        runId,
        'missing_counterpart',
        undefined,
        item
      ));
    }

    const completedAt = new Date();

    // Calculate stats
    const stats = this.calculateStats(
      internalItems,
      externalItems,
      matches,
      exceptions,
      startedAt,
      completedAt
    );

    return {
      runId,
      accountId,
      startedAt,
      completedAt,
      matches,
      exceptions,
      stats,
    };
  }

  /**
   * Apply a single rule to find matches.
   */
  private applyRule(
    rule: ReconciliationRule,
    internalItems: ReconciliationItem[],
    externalItems: ReconciliationItem[]
  ): MatchResult[] {
    switch (rule.strategy) {
      case 'one_to_one':
        return this.matchOneToOne(rule, internalItems, externalItems);
      case 'many_to_one':
        return this.matchManyToOne(rule, internalItems, externalItems);
      case 'one_to_many':
        return this.matchOneToMany(rule, internalItems, externalItems);
      case 'many_to_many':
        return this.matchManyToMany(rule, internalItems, externalItems);
      default:
        return [];
    }
  }

  /**
   * One-to-one matching.
   */
  private matchOneToOne(
    rule: ReconciliationRule,
    internalItems: ReconciliationItem[],
    externalItems: ReconciliationItem[]
  ): MatchResult[] {
    const matches: MatchResult[] = [];
    const usedExternal = new Set<string>();

    for (const internal of internalItems) {
      let bestMatch: { external: ReconciliationItem; score: number; discrepancies: MatchDiscrepancy[] } | null = null;

      for (const external of externalItems) {
        if (usedExternal.has(external.id)) continue;

        const { score, discrepancies } = this.calculateMatchScore(
          rule,
          [internal],
          [external]
        );

        if (score >= (rule.tolerance.minimumMatchScore ?? 0.8)) {
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { external, score, discrepancies };
          }
        }
      }

      if (bestMatch) {
        usedExternal.add(bestMatch.external.id);
        matches.push(this.createMatch(
          rule,
          [internal],
          [bestMatch.external],
          bestMatch.score,
          bestMatch.discrepancies
        ));
      }
    }

    return matches;
  }

  /**
   * Many-to-one matching (multiple internal → one external).
   */
  private matchManyToOne(
    rule: ReconciliationRule,
    internalItems: ReconciliationItem[],
    externalItems: ReconciliationItem[]
  ): MatchResult[] {
    const matches: MatchResult[] = [];

    for (const external of externalItems) {
      // Find internal items that sum to the external amount
      const candidates = this.findSummingCandidates(
        internalItems,
        external.amount,
        rule.tolerance
      );

      if (candidates.length > 0) {
        const { score, discrepancies } = this.calculateMatchScore(
          rule,
          candidates,
          [external]
        );

        if (score >= (rule.tolerance.minimumMatchScore ?? 0.8)) {
          matches.push(this.createMatch(
            rule,
            candidates,
            [external],
            score,
            discrepancies
          ));
        }
      }
    }

    return matches;
  }

  /**
   * One-to-many matching (one internal → multiple external).
   */
  private matchOneToMany(
    rule: ReconciliationRule,
    internalItems: ReconciliationItem[],
    externalItems: ReconciliationItem[]
  ): MatchResult[] {
    const matches: MatchResult[] = [];

    for (const internal of internalItems) {
      const candidates = this.findSummingCandidates(
        externalItems,
        internal.amount,
        rule.tolerance
      );

      if (candidates.length > 0) {
        const { score, discrepancies } = this.calculateMatchScore(
          rule,
          [internal],
          candidates
        );

        if (score >= (rule.tolerance.minimumMatchScore ?? 0.8)) {
          matches.push(this.createMatch(
            rule,
            [internal],
            candidates,
            score,
            discrepancies
          ));
        }
      }
    }

    return matches;
  }

  /**
   * Many-to-many matching.
   */
  private matchManyToMany(
    rule: ReconciliationRule,
    internalItems: ReconciliationItem[],
    externalItems: ReconciliationItem[]
  ): MatchResult[] {
    // Simplified: group by date and match groups
    const matches: MatchResult[] = [];

    const internalByDate = this.groupByDate(internalItems);
    const externalByDate = this.groupByDate(externalItems);

    for (const [date, internals] of internalByDate.entries()) {
      const externals = externalByDate.get(date);
      if (!externals) continue;

      const internalSum = this.sumAmounts(internals);
      const externalSum = this.sumAmounts(externals);

      if (this.isWithinTolerance(internalSum, externalSum, rule.tolerance)) {
        const { score, discrepancies } = this.calculateMatchScore(
          rule,
          internals,
          externals
        );

        if (score >= (rule.tolerance.minimumMatchScore ?? 0.8)) {
          matches.push(this.createMatch(
            rule,
            internals,
            externals,
            score,
            discrepancies
          ));
        }
      }
    }

    return matches;
  }

  /**
   * Calculate match score between item sets.
   */
  private calculateMatchScore(
    rule: ReconciliationRule,
    internalItems: ReconciliationItem[],
    externalItems: ReconciliationItem[]
  ): { score: number; discrepancies: MatchDiscrepancy[] } {
    const discrepancies: MatchDiscrepancy[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    for (const criterion of rule.criteria) {
      const weight = criterion.weight ?? 1;
      totalWeight += weight;

      const internalValue = this.getFieldValue(internalItems, criterion.field);
      const externalValue = this.getFieldValue(externalItems, criterion.field);

      const { matches, difference } = this.compareValues(
        internalValue,
        externalValue,
        criterion
      );

      if (matches) {
        totalScore += weight;
      } else {
        discrepancies.push({
          field: criterion.field,
          internalValue,
          externalValue,
          difference,
          withinTolerance: false,
        });
      }
    }

    return {
      score: totalWeight > 0 ? totalScore / totalWeight : 0,
      discrepancies,
    };
  }

  /**
   * Compare values according to criteria.
   */
  private compareValues(
    internal: unknown,
    external: unknown,
    criterion: { matchType: string; toleranceValue?: number | undefined; toleranceUnit?: string | undefined; caseSensitive?: boolean | undefined }
  ): { matches: boolean; difference?: number | undefined } {
    if (internal === undefined || external === undefined) {
      return { matches: false };
    }

    switch (criterion.matchType) {
      case 'exact':
        if (typeof internal === 'string' && typeof external === 'string') {
          const i = criterion.caseSensitive ? internal : internal.toLowerCase();
          const e = criterion.caseSensitive ? external : external.toLowerCase();
          return { matches: i === e };
        }
        return { matches: internal === external };

      case 'within_tolerance':
        if (typeof internal === 'number' && typeof external === 'number') {
          const diff = Math.abs(internal - external);
          const tolerance = criterion.toleranceValue ?? 0;

          if (criterion.toleranceUnit === 'percentage') {
            const percentDiff = (diff / Math.max(internal, external)) * 100;
            return { matches: percentDiff <= tolerance, difference: diff };
          }
          return { matches: diff <= tolerance, difference: diff };
        }
        return { matches: false };

      case 'contains':
        if (typeof internal === 'string' && typeof external === 'string') {
          const i = criterion.caseSensitive ? internal : internal.toLowerCase();
          const e = criterion.caseSensitive ? external : external.toLowerCase();
          return { matches: i.includes(e) || e.includes(i) };
        }
        return { matches: false };

      case 'fuzzy':
        if (typeof internal === 'string' && typeof external === 'string') {
          const similarity = this.calculateStringSimilarity(internal, external);
          return { matches: similarity >= 0.8 };
        }
        return { matches: false };

      default:
        return { matches: internal === external };
    }
  }

  /**
   * Get aggregated field value from items.
   */
  private getFieldValue(items: ReconciliationItem[], field: string): unknown {
    if (items.length === 0) return undefined;

    switch (field) {
      case 'amount':
        return this.sumAmounts(items);
      case 'transactionDate':
      case 'valueDate':
        return items[0]?.[field];
      case 'reference':
        return items.map(i => i.reference).join(',');
      case 'counterpartyName':
        return items[0]?.counterpartyName;
      default:
        return items[0]?.[field as keyof ReconciliationItem];
    }
  }

  /**
   * Find candidates that sum to target amount.
   */
  private findSummingCandidates(
    items: ReconciliationItem[],
    targetAmount: Money,
    tolerance: { amountTolerance?: { readonly value: number; readonly unit: string } | undefined }
  ): ReconciliationItem[] {
    // Simple greedy approach - can be improved with dynamic programming
    const sorted = [...items].sort((a, b) => b.amount.amount - a.amount.amount);
    const candidates: ReconciliationItem[] = [];
    let runningSum = 0;

    for (const item of sorted) {
      if (item.amount.currency !== targetAmount.currency) continue;

      if (runningSum + item.amount.amount <= targetAmount.amount * 1.01) {
        candidates.push(item);
        runningSum += item.amount.amount;

        if (this.isWithinTolerance(runningSum, targetAmount.amount, tolerance)) {
          return candidates;
        }
      }
    }

    // Check if we're within tolerance
    if (this.isWithinTolerance(runningSum, targetAmount.amount, tolerance)) {
      return candidates;
    }

    return [];
  }

  /**
   * Check if values are within tolerance.
   */
  private isWithinTolerance(
    value1: number,
    value2: number,
    tolerance: { amountTolerance?: { readonly value: number; readonly unit: string } | undefined }
  ): boolean {
    const diff = Math.abs(value1 - value2);
    const tol = tolerance.amountTolerance;

    if (!tol) {
      return value1 === value2;
    }

    if (tol.unit === 'percentage') {
      const percentDiff = (diff / Math.max(value1, value2)) * 100;
      return percentDiff <= tol.value;
    }

    return diff <= tol.value;
  }

  /**
   * Sum amounts from items.
   */
  private sumAmounts(items: ReconciliationItem[]): number {
    return items.reduce((sum, item) => sum + item.amount.amount, 0);
  }

  /**
   * Group items by date.
   */
  private groupByDate(items: ReconciliationItem[]): Map<string, ReconciliationItem[]> {
    const groups = new Map<string, ReconciliationItem[]>();

    for (const item of items) {
      const dateKey = item.transactionDate.toISOString().split('T')[0] ?? '';
      const group = groups.get(dateKey) ?? [];
      group.push(item);
      groups.set(dateKey, group);
    }

    return groups;
  }

  /**
   * Calculate string similarity (Levenshtein-based).
   */
  private calculateStringSimilarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance calculation.
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i]![0] = i;
    for (let j = 0; j <= n; j++) dp[0]![j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i]![j] = Math.min(
          dp[i - 1]![j]! + 1,
          dp[i]![j - 1]! + 1,
          dp[i - 1]![j - 1]! + cost
        );
      }
    }

    return dp[m]![n]!;
  }

  /**
   * Create a match result.
   */
  private createMatch(
    rule: ReconciliationRule,
    internalItems: ReconciliationItem[],
    externalItems: ReconciliationItem[],
    score: number,
    discrepancies: MatchDiscrepancy[]
  ): MatchResult {
    const matchedFields = rule.criteria
      .filter((_, i) => !discrepancies.some(d => d.field === rule.criteria[i]?.field))
      .map(c => c.field);

    return {
      matchId: this.generateMatchId(),
      internalItems,
      externalItems,
      matchScore: score,
      strategy: rule.strategy,
      matchedFields,
      discrepancies,
      autoReconciled: rule.autoReconcile && discrepancies.length === 0,
      matchedAt: new Date(),
    };
  }

  /**
   * Create an exception.
   */
  private createException(
    accountId: string,
    runId: string,
    type: ExceptionType,
    internalItem: ReconciliationItem | undefined,
    externalItem: ReconciliationItem | undefined
  ): ReconciliationException {
    const item = internalItem ?? externalItem;
    const amount = item?.amount ?? { amount: 0, currency: 'USD' };

    const props: ReconciliationExceptionProps = {
      id: this.generateExceptionId(),
      accountId,
      reconciliationRunId: runId,
      exceptionType: type,
      priority: this.determinePriority(type, amount),
      internalItem,
      externalItem,
      amount,
      description: this.generateExceptionDescription(type, internalItem, externalItem),
      suggestedAction: this.suggestAction(type),
      status: 'open',
      notes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return new ReconciliationException(props);
  }

  /**
   * Determine exception priority.
   */
  private determinePriority(type: ExceptionType, amount: Money): ExceptionPriority {
    // High-value items are higher priority
    if (amount.amount > 100000) return 'critical';
    if (amount.amount > 10000) return 'high';

    // Certain types are inherently higher priority
    if (type === 'duplicate_suspected') return 'high';
    if (type === 'overpayment') return 'high';

    return 'medium';
  }

  /**
   * Generate exception description.
   */
  private generateExceptionDescription(
    type: ExceptionType,
    internal?: ReconciliationItem,
    external?: ReconciliationItem
  ): string {
    const amount = internal?.amount ?? external?.amount;
    const ref = internal?.reference ?? external?.reference ?? 'N/A';

    switch (type) {
      case 'missing_counterpart':
        if (internal && !external) {
          return `Internal transaction ${ref} (${amount?.currency} ${amount?.amount}) has no matching bank statement entry`;
        }
        return `Bank statement entry ${ref} (${amount?.currency} ${amount?.amount}) has no matching internal transaction`;

      case 'amount_mismatch':
        return `Amount mismatch for ${ref}: Internal ${internal?.amount.amount} vs External ${external?.amount.amount}`;

      case 'date_mismatch':
        return `Date mismatch for ${ref}: Internal ${internal?.transactionDate.toISOString()} vs External ${external?.transactionDate.toISOString()}`;

      default:
        return `${type} exception for reference ${ref}`;
    }
  }

  /**
   * Suggest action for exception type.
   */
  private suggestAction(type: ExceptionType): string {
    switch (type) {
      case 'missing_counterpart':
        return 'Investigate timing difference or missing transaction';
      case 'amount_mismatch':
        return 'Review for partial payment or fees';
      case 'duplicate_suspected':
        return 'Check for duplicate entry and void if confirmed';
      case 'overpayment':
        return 'Verify with counterparty and process refund if needed';
      case 'underpayment':
        return 'Follow up with counterparty for balance';
      default:
        return 'Manual review required';
    }
  }

  /**
   * Calculate reconciliation stats.
   */
  private calculateStats(
    internalItems: ReconciliationItem[],
    externalItems: ReconciliationItem[],
    matches: MatchResult[],
    exceptions: ReconciliationException[],
    startedAt: Date,
    completedAt: Date
  ): ReconciliationStats {
    const matchedInternalIds = new Set<string>();
    const matchedExternalIds = new Set<string>();

    for (const match of matches) {
      match.internalItems.forEach(i => matchedInternalIds.add(i.id));
      match.externalItems.forEach(e => matchedExternalIds.add(e.id));
    }

    const currency = internalItems[0]?.amount.currency ?? externalItems[0]?.amount.currency ?? 'USD';

    const totalInternalAmount = internalItems.reduce((sum, i) => sum + i.amount.amount, 0);
    const matchedInternalAmount = internalItems
      .filter(i => matchedInternalIds.has(i.id))
      .reduce((sum, i) => sum + i.amount.amount, 0);

    const autoMatchedCount = matches.filter(m => m.autoReconciled).length;
    const totalMatched = matchedInternalIds.size;

    return {
      periodStart: startedAt,
      periodEnd: completedAt,
      totalInternalItems: internalItems.length,
      totalExternalItems: externalItems.length,
      matchedCount: matches.length,
      unmatchedInternalCount: internalItems.length - matchedInternalIds.size,
      unmatchedExternalCount: externalItems.length - matchedExternalIds.size,
      exceptionCount: exceptions.length,
      autoMatchRate: totalMatched > 0 ? autoMatchedCount / totalMatched : 0,
      totalAmount: { amount: totalInternalAmount, currency },
      matchedAmount: { amount: matchedInternalAmount, currency },
      unmatchedAmount: { amount: totalInternalAmount - matchedInternalAmount, currency },
    };
  }

  private generateRunId(): string {
    return `recon-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateMatchId(): string {
    return `match-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateExceptionId(): string {
    return `exc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
