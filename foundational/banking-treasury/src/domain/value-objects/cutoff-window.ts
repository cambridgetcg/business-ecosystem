/**
 * Cutoff Window Value Object
 *
 * Represents bank-specific payment cutoff times for different rails and currencies.
 * Critical for STP (Straight-Through Processing) and payment timing optimization.
 *
 * @see docs/research/nuances/10_PAYMENT_TIMING_CUTOFFS.md
 */

/**
 * Cutoff window for a specific bank/rail/currency combination.
 * Defines the deadline by which a payment must be submitted.
 */
export interface CutoffWindow {
  /** Unique identifier */
  readonly id: string;
  /** Bank identifier (references BankRelationship) */
  readonly bankId: string;
  /** Payment rail identifier */
  readonly railId: string;
  /** Currency code (ISO 4217) */
  readonly currency: string;
  /** Cutoff time in HH:MM format */
  readonly cutoffTime: string;
  /** IANA timezone (e.g., 'America/New_York') */
  readonly timezone: string;
  /** Minutes to subtract from cutoff for non-STP payments */
  readonly stpAdjustmentMinutes: number;
  /** Days of week when cutoff applies (0=Sunday, 6=Saturday) */
  readonly activeDays: number[];
  /** Holiday calendar identifier for exceptions */
  readonly holidayCalendarId: string;
}

/**
 * Holiday calendar for a specific country/bank/year.
 * Used to determine non-business days when cutoffs don't apply.
 */
export interface HolidayCalendar {
  /** Unique identifier */
  readonly id: string;
  /** Human-readable name (e.g., 'US Federal Holidays 2026') */
  readonly name: string;
  /** Country code (ISO 3166-1 alpha-2) */
  readonly countryCode?: string | undefined;
  /** Bank-specific code if bank has unique holidays */
  readonly bankCode?: string | undefined;
  /** Calendar year */
  readonly year: number;
  /** List of holiday dates */
  readonly holidays: Date[];
}

/**
 * Result of checking cutoff time.
 */
export interface CutoffCheckResult {
  /** Whether the cutoff has passed */
  cutoffPassed: boolean;
  /** The cutoff time that was checked against */
  cutoffTime: Date;
  /** Minutes remaining until cutoff (negative if passed) */
  minutesRemaining: number;
  /** Whether today is a business day */
  isBusinessDay: boolean;
  /** If cutoff passed, next available cutoff */
  nextCutoff?: Date | undefined;
  /** Whether STP adjustment was applied */
  stpAdjusted: boolean;
}

/**
 * Check if a date is a holiday according to the calendar.
 */
export function isHoliday(calendar: HolidayCalendar, date: Date): boolean {
  const dateStr = date.toISOString().split('T')[0];
  return calendar.holidays.some(
    (holiday) => holiday.toISOString().split('T')[0] === dateStr
  );
}

/**
 * Check if a date is a business day (not weekend, not holiday).
 */
export function isBusinessDay(
  date: Date,
  activeDays: number[],
  calendar?: HolidayCalendar
): boolean {
  const dayOfWeek = date.getDay();

  // Check if day is in active days
  if (!activeDays.includes(dayOfWeek)) {
    return false;
  }

  // Check if holiday
  if (calendar && isHoliday(calendar, date)) {
    return false;
  }

  return true;
}

/**
 * Parse HH:MM time string to hours and minutes.
 */
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  return { hours, minutes };
}

/**
 * Get the cutoff datetime for a specific date.
 */
export function getCutoffDateTime(
  window: CutoffWindow,
  forDate: Date,
  isStp: boolean = true
): Date {
  const { hours, minutes } = parseTime(window.cutoffTime);

  // Create date in the window's timezone
  const cutoffDate = new Date(forDate);
  cutoffDate.setHours(hours, minutes, 0, 0);

  // Apply STP adjustment if non-STP
  if (!isStp) {
    cutoffDate.setMinutes(cutoffDate.getMinutes() - window.stpAdjustmentMinutes);
  }

  return cutoffDate;
}

/**
 * Check cutoff status for a payment.
 */
export function checkCutoff(
  window: CutoffWindow,
  calendar: HolidayCalendar | undefined,
  at: Date = new Date(),
  isStp: boolean = true
): CutoffCheckResult {
  // Check if today is a business day
  const isBizDay = isBusinessDay(at, window.activeDays, calendar);

  // Get today's cutoff time
  const cutoffTime = getCutoffDateTime(window, at, isStp);

  // Calculate minutes remaining
  const minutesRemaining = Math.floor((cutoffTime.getTime() - at.getTime()) / 60000);
  const cutoffPassed = minutesRemaining < 0;

  // If cutoff passed, find next cutoff
  let nextCutoff: Date | undefined;
  if (cutoffPassed || !isBizDay) {
    const searchDate = new Date(at);
    for (let i = 1; i <= 10; i++) {
      // Look up to 10 days ahead
      searchDate.setDate(searchDate.getDate() + 1);
      if (isBusinessDay(searchDate, window.activeDays, calendar)) {
        nextCutoff = getCutoffDateTime(window, searchDate, isStp);
        break;
      }
    }
  }

  return {
    cutoffPassed: cutoffPassed || !isBizDay,
    cutoffTime,
    minutesRemaining,
    isBusinessDay: isBizDay,
    nextCutoff,
    stpAdjusted: !isStp,
  };
}

/**
 * Get effective cutoff with safety buffer.
 * Applies internal buffer for processing time.
 */
export function getEffectiveCutoff(
  window: CutoffWindow,
  bufferMinutes: number = 30,
  isStp: boolean = true
): Date {
  const now = new Date();
  const cutoff = getCutoffDateTime(window, now, isStp);

  // Apply safety buffer
  cutoff.setMinutes(cutoff.getMinutes() - bufferMinutes);

  return cutoff;
}

/**
 * Format cutoff for display.
 */
export function formatCutoff(window: CutoffWindow): string {
  return `${window.cutoffTime} ${window.timezone}`;
}

/**
 * Get all cutoffs for a bank sorted by time.
 */
export function sortCutoffsByTime(windows: CutoffWindow[]): CutoffWindow[] {
  return [...windows].sort((a, b) => {
    const timeA = parseTime(a.cutoffTime);
    const timeB = parseTime(b.cutoffTime);
    return timeA.hours * 60 + timeA.minutes - (timeB.hours * 60 + timeB.minutes);
  });
}
