/**
 * VAT Calculator Service
 *
 * Calculates UK VAT returns in the MTD 9-box format:
 * - Standard VAT accounting
 * - Flat Rate Scheme
 * - Cash Accounting
 * - EU supplies and acquisitions
 *
 * Box rules follow HMRC's "How to fill in and submit your VAT Return (VAT Notice 700/12)":
 * https://www.gov.uk/guidance/how-to-fill-in-and-submit-your-vat-return-vat-notice-70012
 *
 * This is a synthetic calculator. Nothing here files a return or talks to HMRC.
 */

import { Decimal } from 'decimal.js';
import { VATRates } from '../../value-objects/index.js';
import type { VATTransaction, VATBoxes } from '../models/return.js';

// Configure Decimal.js for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Empty VAT boxes (all zeros)
 */
export function emptyVATBoxes(): VATBoxes {
  return {
    box1: '0.00',
    box2: '0.00',
    box3: '0.00',
    box4: '0.00',
    box5: '0.00',
    box6: '0',
    box7: '0',
    box8: '0',
    box9: '0',
  };
}

/**
 * Calculate VAT return from transactions (Standard Accounting)
 *
 * Box 1: VAT due on sales and other outputs
 * Box 2: VAT due on acquisitions from other EC Member States
 * Box 3: Total VAT due (sum of boxes 1 and 2)
 * Box 4: VAT reclaimed on purchases and other inputs
 * Box 5: Net VAT to pay or reclaim: the difference between boxes 3 and 4, never negative
 *        (Notice 700/12 §3.6; §3.1: "not enter a minus sign in box 5"). Whether it is a payment
 *        or a reclaim comes from comparing boxes 3 and 4 (see getVATLiabilitySummary).
 * Box 6: Total value of sales and outputs excluding VAT
 * Box 7: Total value of purchases and inputs excluding VAT
 * Box 8: Total value of supplies of goods to EC Member States
 * Box 9: Total value of acquisitions of goods from EC Member States
 */
export function calculateVATReturn(transactions: VATTransaction[]): VATBoxes {
  let box1 = new Decimal(0); // Output VAT
  let box2 = new Decimal(0); // Acquisition VAT
  let box4 = new Decimal(0); // Input VAT
  let box6 = new Decimal(0); // Total sales ex VAT
  let box7 = new Decimal(0); // Total purchases ex VAT
  let box8 = new Decimal(0); // EU supplies
  let box9 = new Decimal(0); // EU acquisitions

  for (const tx of transactions) {
    const net = new Decimal(tx.netAmount);
    const vat = new Decimal(tx.vatAmount);

    switch (tx.type) {
      case 'sale':
        // Standard sales - VAT goes to box 1, net to box 6
        box1 = box1.plus(vat);
        box6 = box6.plus(net);

        // If EU supply, also add to box 8
        if (tx.isEUSupply) {
          box8 = box8.plus(net);
        }
        break;

      case 'purchase':
        // Standard purchases - VAT goes to box 4, net to box 7
        box4 = box4.plus(vat);
        box7 = box7.plus(net);

        // Reverse charge - also include output VAT in box 1
        if (tx.isReverseCharge) {
          box1 = box1.plus(vat);
        }
        break;

      case 'eu_acquisition':
        // EU acquisition - acquisition VAT to box 2, net to boxes 7 and 9
        box2 = box2.plus(vat);
        box4 = box4.plus(vat); // Can reclaim if business is VAT registered
        box7 = box7.plus(net);
        box9 = box9.plus(net);
        break;

      case 'eu_supply':
        // EU supply - net to boxes 6 and 8 (usually zero-rated)
        box6 = box6.plus(net);
        box8 = box8.plus(net);
        break;
    }
  }

  // Calculate derived boxes. Box 5 is the unsigned difference (Notice 700/12 §3.6).
  const box3 = box1.plus(box2);
  const box5 = box3.minus(box4).abs();

  // Format boxes - boxes 1-5 have 2 decimal places, boxes 6-9 are whole pounds
  return {
    box1: box1.toFixed(2),
    box2: box2.toFixed(2),
    box3: box3.toFixed(2),
    box4: box4.toFixed(2),
    box5: box5.toFixed(2),
    box6: box6.toDecimalPlaces(0, Decimal.ROUND_DOWN).toString(),
    box7: box7.toDecimalPlaces(0, Decimal.ROUND_DOWN).toString(),
    box8: box8.toDecimalPlaces(0, Decimal.ROUND_DOWN).toString(),
    box9: box9.toDecimalPlaces(0, Decimal.ROUND_DOWN).toString(),
  };
}

/**
 * Calculate VAT return under Flat Rate Scheme
 *
 * Under FRS (Notice 700/12 §4.1):
 * - Box 1 = Flat Rate % × VAT-inclusive flat rate turnover
 * - Box 4 = VAT on capital goods of £2,000 or more (including VAT)
 * - Box 5 = the unsigned difference between boxes 3 and 4 (§3.6)
 * - Box 6 = the turnover the flat rate percentage was applied to, "including VAT"
 * - Box 7 = the value, excluding VAT, of a capital good whose VAT is claimed in box 4,
 *           plus "any amount you've entered in box 9"
 *
 * `vatInclusiveTurnover` is the flat rate turnover (VAT Notice 733 §6.2): all supplies including
 * VAT, zero-rated ones too, so any box 8 dispatches are taken to be inside it already. Supplies
 * accounted for outside the scheme, and reverse charge transactions, are not modelled here.
 */
export function calculateFlatRateVATReturn(
  flatRatePercentage: number,
  vatInclusiveTurnover: Decimal | number | string,
  capitalAssetVAT: Decimal | number | string = 0,
  euSupplies: Decimal | number | string = 0,
  euAcquisitions: Decimal | number | string = 0,
  capitalAssetNetValue: Decimal | number | string = 0
): VATBoxes {
  const turnover = new Decimal(vatInclusiveTurnover);
  const capitalVAT = new Decimal(capitalAssetVAT);
  const euSuppliesValue = new Decimal(euSupplies);
  const euAcquisitionsValue = new Decimal(euAcquisitions);
  const capitalNetValue = new Decimal(capitalAssetNetValue);

  // Calculate flat rate VAT (Box 1)
  const flatRateDecimal = new Decimal(flatRatePercentage).div(100);
  const box1 = turnover.mul(flatRateDecimal);

  // EU acquisition VAT (Box 2) - use standard rate
  const box2 = euAcquisitionsValue.mul(VATRates.STANDARD);

  // Box 4 - only capital goods of £2,000 or more can be reclaimed under FRS
  const box4 = capitalVAT;

  const box3 = box1.plus(box2);
  const box5 = box3.minus(box4).abs();

  // Box 6 is the flat rate turnover including VAT; box 7 holds the capital good's net value
  // and every box 9 amount (Notice 700/12 §4.1).
  const box6 = turnover;
  const box7 = capitalNetValue.plus(euAcquisitionsValue);

  return {
    box1: box1.toFixed(2),
    box2: box2.toFixed(2),
    box3: box3.toFixed(2),
    box4: box4.toFixed(2),
    box5: box5.toFixed(2),
    box6: box6.toDecimalPlaces(0, Decimal.ROUND_DOWN).toString(),
    box7: box7.toDecimalPlaces(0, Decimal.ROUND_DOWN).toString(),
    box8: euSuppliesValue.toDecimalPlaces(0, Decimal.ROUND_DOWN).toString(),
    box9: euAcquisitionsValue.toDecimalPlaces(0, Decimal.ROUND_DOWN).toString(),
  };
}

/**
 * Calculate VAT on a net amount
 */
export function calculateVATOnNet(
  netAmount: Decimal | number | string,
  rate: 'standard' | 'reduced' | 'zero' = 'standard'
): { net: string; vat: string; gross: string } {
  const net = new Decimal(netAmount);
  const rateValue = rate === 'standard' ? VATRates.STANDARD
    : rate === 'reduced' ? VATRates.REDUCED
    : VATRates.ZERO;

  const vat = net.mul(rateValue);
  const gross = net.plus(vat);

  return {
    net: net.toFixed(2),
    vat: vat.toFixed(2),
    gross: gross.toFixed(2),
  };
}

/**
 * Extract VAT from a gross (VAT-inclusive) amount
 */
export function extractVATFromGross(
  grossAmount: Decimal | number | string,
  rate: 'standard' | 'reduced' | 'zero' = 'standard'
): { net: string; vat: string; gross: string } {
  const gross = new Decimal(grossAmount);
  const rateValue = rate === 'standard' ? VATRates.STANDARD
    : rate === 'reduced' ? VATRates.REDUCED
    : VATRates.ZERO;

  // VAT = Gross × (Rate / (1 + Rate))
  const vatFraction = new Decimal(rateValue).div(1 + rateValue);
  const vat = gross.mul(vatFraction);
  const net = gross.minus(vat);

  return {
    net: net.toFixed(2),
    vat: vat.toFixed(2),
    gross: gross.toFixed(2),
  };
}

/**
 * Validate VAT boxes are consistent
 */
export function validateVATBoxes(boxes: VATBoxes): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const box1 = new Decimal(boxes.box1);
  const box2 = new Decimal(boxes.box2);
  const box3 = new Decimal(boxes.box3);
  const box4 = new Decimal(boxes.box4);
  const box5 = new Decimal(boxes.box5);

  // Box 3 = Box 1 + Box 2
  if (!box3.equals(box1.plus(box2))) {
    errors.push('Box 3 must equal Box 1 + Box 2');
  }

  // Box 5 = the difference between Box 3 and Box 4, with no minus sign (Notice 700/12 §3.1, §3.6)
  if (box5.lt(0)) {
    errors.push('Box 5 must not be negative');
  }
  if (!box5.equals(box3.minus(box4).abs())) {
    errors.push('Box 5 must equal the difference between Box 3 and Box 4');
  }

  // Boxes 6-9 must be whole numbers (no decimals)
  const wholeNumberBoxes = ['box6', 'box7', 'box8', 'box9'] as const;
  for (const boxName of wholeNumberBoxes) {
    const value = new Decimal(boxes[boxName]);
    if (!value.isInteger()) {
      errors.push(`${boxName.toUpperCase()} must be a whole number (no pence)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate VAT liability summary
 *
 * Box 5 carries no sign, so the direction comes from comparing box 3 with box 4: more VAT due
 * than reclaimed means a payment, less means a repayment (Notice 700/12 §3.6).
 */
export function getVATLiabilitySummary(boxes: VATBoxes): {
  outputVAT: string;
  inputVAT: string;
  netVAT: string;
  direction: 'pay' | 'reclaim' | 'nil';
} {
  const outputVAT = new Decimal(boxes.box3);
  const inputVAT = new Decimal(boxes.box4);
  const netVAT = new Decimal(boxes.box5);

  let direction: 'pay' | 'reclaim' | 'nil';
  if (outputVAT.gt(inputVAT)) {
    direction = 'pay';
  } else if (outputVAT.lt(inputVAT)) {
    direction = 'reclaim';
  } else {
    direction = 'nil';
  }

  return {
    outputVAT: outputVAT.toFixed(2),
    inputVAT: inputVAT.toFixed(2),
    netVAT: netVAT.abs().toFixed(2),
    direction,
  };
}
