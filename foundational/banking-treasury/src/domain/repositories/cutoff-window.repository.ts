/**
 * Cutoff Window Repository Interface
 *
 * Domain-level interface for cutoff window and holiday calendar persistence.
 * Implementation resides in infrastructure layer.
 */

import type { CutoffWindow, HolidayCalendar } from '../value-objects/cutoff-window.js';

/**
 * Repository interface for CutoffWindow value objects.
 */
export interface CutoffWindowRepository {
  /**
   * Find a cutoff window by its unique identifier.
   */
  findById(id: string): Promise<CutoffWindow | null>;

  /**
   * Find cutoff window for a specific bank, rail, and currency combination.
   */
  findByBankAndRail(
    bankId: string,
    railId: string,
    currency: string
  ): Promise<CutoffWindow | null>;

  /**
   * Find all cutoff windows for a specific bank.
   */
  findByBank(bankId: string): Promise<CutoffWindow[]>;

  /**
   * Find all cutoff windows for a specific rail.
   */
  findByRail(railId: string): Promise<CutoffWindow[]>;

  /**
   * Find all cutoff windows.
   */
  findAll(): Promise<CutoffWindow[]>;

  /**
   * Save a cutoff window (create or update).
   */
  save(window: CutoffWindow): Promise<void>;

  /**
   * Delete a cutoff window by ID.
   */
  delete(id: string): Promise<void>;
}

/**
 * Repository interface for HolidayCalendar value objects.
 */
export interface HolidayCalendarRepository {
  /**
   * Find a holiday calendar by its unique identifier.
   */
  findById(id: string): Promise<HolidayCalendar | null>;

  /**
   * Find holiday calendar for a specific country and year.
   */
  findByCountryAndYear(
    countryCode: string,
    year: number
  ): Promise<HolidayCalendar | null>;

  /**
   * Find holiday calendar for a specific bank and year.
   */
  findByBankAndYear(
    bankCode: string,
    year: number
  ): Promise<HolidayCalendar | null>;

  /**
   * Find all holiday calendars for a specific year.
   */
  findByYear(year: number): Promise<HolidayCalendar[]>;

  /**
   * Save a holiday calendar (create or update).
   */
  save(calendar: HolidayCalendar): Promise<void>;

  /**
   * Delete a holiday calendar by ID.
   */
  delete(id: string): Promise<void>;
}
