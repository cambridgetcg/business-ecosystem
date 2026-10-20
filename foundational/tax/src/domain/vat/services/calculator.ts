/**
 * VAT Calculator Service
 *
 * Calculates UK VAT returns in the MTD 9-box format:
 * - Standard VAT accounting
 * - Flat Rate Scheme
 * - Cash Accounting
 * - EU supplies and acquisitions
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
 * Box 5: Net VAT to pay/reclaim (box 3 - box 4)
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

  // Calculate derived boxes
  const box3 = box1.plus(box2);
  const box5 = box3.minus(box4);

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
 * Under FRS:
 * - Box 1 = Flat Rate % × VAT-inclusive turnover
 * - Box 4 = VAT on capital assets over £2,000
 * - Boxes 6-9 still show actual sales/purchases ex VAT
 */
export function calculateFlatRateVATReturn(
  flatRatePercentage: number,
  vatInclusiveTurnover: Decimal | number | string,
  capitalAssetVAT: Decimal | number | string = 0,
  euSupplies: Decimal | number | string = 0,
  euAcquisitions: Decimal | number | string = 0
): VATBoxes {
  const turnover = new Decimal(vatInclusiveTurnover);
  const capitalVAT = new Decimal(capitalAssetVAT);
  const euSuppliesValue = new Decimal(euSupplies);
  const euAcquisitionsValue = new Decimal(euAcquisitions);

  // Calculate flat rate VAT (Box 1)
  const flatRateDecimal = new Decimal(flatRatePercentage).div(100);
  const box1 = turnover.mul(flatRateDecimal);

  // EU acquisition VAT (Box 2) - use standard rate
  const box2 = euAcquisitionsValue.mul(VATRates.STANDARD);

  // Box 4 - only capital assets over £2,000 can be reclaimed under FRS
  const box4 = capitalVAT;

  // Boxes 6-9 (excluding VAT)
  // Under FRS, turnover is VAT-inclusive, so divide by 1.2 to get ex-VAT
  const turnoverExVAT = turnover.div(1 + VATRates.STANDARD);

  const box3 = box1.plus(box2);
  const box5 = box3.minus(box4);

  return {
    box1: box1.toFixed(2),
    box2: box2.toFixed(2),
    box3: box3.toFixed(2),
    box4: box4.toFixed(2),
    box5: box5.toFixed(2),
    box6: turnoverExVAT.toDecimalPlaces(0, Decimal.ROUND_DOWN).toString(),
    box7: '0', // Purchases not tracked in detail under FRS
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

  // Box 5 = Box 3 - Box 4
  if (!box5.equals(box3.minus(box4))) {
    errors.push('Box 5 must equal Box 3 - Box 4');
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
  if (netVAT.gt(0)) {
    direction = 'pay';
  } else if (netVAT.lt(0)) {
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
