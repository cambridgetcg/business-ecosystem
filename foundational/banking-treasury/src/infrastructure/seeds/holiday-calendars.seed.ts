/**
 * Holiday Calendars Seed Data
 *
 * Default holiday calendar configurations for major markets.
 * @see docs/research/nuances/10_PAYMENT_TIMING_CUTOFFS.md
 */

import type { HolidayCalendar } from '../../domain/value-objects/cutoff-window.js';

/**
 * US Federal Reserve holidays for 2026.
 * Source: Federal Reserve Bank holiday schedule
 */
export const usFederalHolidays2026: Omit<HolidayCalendar, 'id'> = {
  name: 'US Federal Reserve Holidays 2026',
  countryCode: 'US',
  year: 2026,
  holidays: [
    new Date('2026-01-01'), // New Year's Day
    new Date('2026-01-19'), // Martin Luther King Jr. Day
    new Date('2026-02-16'), // Washington's Birthday
    new Date('2026-05-25'), // Memorial Day
    new Date('2026-06-19'), // Juneteenth
    new Date('2026-07-03'), // Independence Day (observed)
    new Date('2026-09-07'), // Labor Day
    new Date('2026-10-12'), // Columbus Day
    new Date('2026-11-11'), // Veterans Day
    new Date('2026-11-26'), // Thanksgiving Day
    new Date('2026-12-25'), // Christmas Day
  ],
};

/**
 * UK Bank holidays for 2026.
 * Source: gov.uk bank holidays
 */
export const ukBankHolidays2026: Omit<HolidayCalendar, 'id'> = {
  name: 'UK Bank Holidays 2026',
  countryCode: 'GB',
  year: 2026,
  holidays: [
    new Date('2026-01-01'), // New Year's Day
    new Date('2026-04-03'), // Good Friday
    new Date('2026-04-06'), // Easter Monday
    new Date('2026-05-04'), // Early May bank holiday
    new Date('2026-05-25'), // Spring bank holiday
    new Date('2026-08-31'), // Summer bank holiday
    new Date('2026-12-25'), // Christmas Day
    new Date('2026-12-28'), // Boxing Day (observed)
  ],
};

/**
 * EU TARGET2 holidays for 2026.
 * Source: ECB TARGET2 operating days
 */
export const euTarget2Holidays2026: Omit<HolidayCalendar, 'id'> = {
  name: 'EU TARGET2 Holidays 2026',
  countryCode: 'EU',
  year: 2026,
  holidays: [
    new Date('2026-01-01'), // New Year's Day
    new Date('2026-04-03'), // Good Friday
    new Date('2026-04-06'), // Easter Monday
    new Date('2026-05-01'), // Labour Day
    new Date('2026-12-25'), // Christmas Day
    new Date('2026-12-26'), // Boxing Day
  ],
};

/**
 * J.P. Morgan specific holiday calendar (includes bank-specific closures).
 */
export const jpMorganHolidays2026: Omit<HolidayCalendar, 'id'> = {
  name: 'J.P. Morgan Holidays 2026',
  countryCode: 'US',
  bankCode: 'CHASUS33',
  year: 2026,
  holidays: [
    // All Federal Reserve holidays plus any bank-specific closures
    ...usFederalHolidays2026.holidays,
    // Add any additional bank-specific holidays here
  ],
};

/**
 * Combined list of all default holiday calendars.
 */
export const defaultHolidayCalendars: Omit<HolidayCalendar, 'id'>[] = [
  usFederalHolidays2026,
  ukBankHolidays2026,
  euTarget2Holidays2026,
  jpMorganHolidays2026,
];

/**
 * Get holiday calendar by country and year.
 */
export function getHolidayCalendar(
  countryCode: string,
  year: number
): Omit<HolidayCalendar, 'id'> | undefined {
  return defaultHolidayCalendars.find(
    (cal) => cal.countryCode === countryCode && cal.year === year
  );
}

/**
 * Check if a date is a holiday in a given country.
 */
export function isHolidayInCountry(
  date: Date,
  countryCode: string
): boolean {
  const year = date.getFullYear();
  const calendar = getHolidayCalendar(countryCode, year);
  if (!calendar) return false;

  const dateStr = date.toISOString().split('T')[0];
  return calendar.holidays.some(
    (holiday) => holiday.toISOString().split('T')[0] === dateStr
  );
}

/**
 * Get next business day after a given date.
 */
export function getNextBusinessDay(
  date: Date,
  countryCode: string,
  workingDays: number[] = [1, 2, 3, 4, 5] // Mon-Fri default
): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + 1);

  while (
    !workingDays.includes(result.getDay()) ||
    isHolidayInCountry(result, countryCode)
  ) {
    result.setDate(result.getDate() + 1);
  }

  return result;
}
