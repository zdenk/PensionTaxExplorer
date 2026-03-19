/**
 * TaxEngine — Income Tax Calculator
 *
 * Pure function. No side effects. Handles progressive and flat-rate income tax.
 * Models the Czech system: progressive brackets applied to gross income,
 * with an annual personal allowance converted to a monthly credit.
 */

import type { CountryConfig, IncomeTaxConfig, BracketBreakdown, TaxResult } from '../types';

/**
 * Calculate progressive income tax for a given gross monthly income.
 *
 * Czech implementation note:
 *   The personal allowance (základní sleva na poplatníka) is technically a TAX CREDIT
 *   (not a deduction from the tax base), i.e. it reduces the final tax bill directly.
 *   We model it by first computing tax on the full gross, then subtracting the monthly
 *   allowance from the resulting tax. This exactly replicates the Czech § 35ba approach.
 *
 * The `personalAllowance` field in IncomeTaxConfig carries the MONTHLY credit equivalent
 * (30,840 / 12 = 2,570 CZK for CZ 2026).
 */
function calculateProgressive(
  config: IncomeTaxConfig,
  grossMonthly: number
): TaxResult {
  const brackets = config.brackets ?? [];

  // CZ § 38h: round gross UP to nearest 100 CZK for monthly záloha computation.
  // The gross stored in the result still reflects the actual wage, but tax is
  // computed on the rounded-up base so that 48,967 → 49,000.
  const roundedGross =
    config.taxBaseRounding === 'ceil100'
      ? Math.ceil(grossMonthly / 100) * 100
      : grossMonthly;

  // When allowanceIsCredit is false/omitted (default), the personal allowance
  // is a deduction from the tax base (most EU countries: SK NČZD, FR, IE, PT …).
  // When true it is subtracted from the final tax bill (CZ §35ba, PL).
  const taxableBase = config.allowanceIsCredit
    ? roundedGross
    : Math.max(0, roundedGross - config.personalAllowance);

  let remainingIncome = taxableBase;
  let previousThreshold = 0;
  let rawTax = 0;
  const breakdown: BracketBreakdown[] = [];
  let marginalRate = 0;

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;

    const bracketTop = bracket.upTo === Infinity ? Infinity : bracket.upTo;
    const sliceTop = Math.min(taxableBase, bracketTop);
    const slice = Math.max(0, sliceTop - previousThreshold);
    const tax = slice * bracket.rate;

    if (slice > 0) {
      breakdown.push({
        bracket:
          bracketTop === Infinity
            ? `>${previousThreshold.toLocaleString()} (${(bracket.rate * 100).toFixed(0)}%)`
            : `≤${bracketTop.toLocaleString()} (${(bracket.rate * 100).toFixed(0)}%)`,
        amount: slice,
        tax,
      });
    }

    rawTax += tax;
    remainingIncome -= slice;

    // Marginal rate: the rate bracket that the last crown of income falls into
    if (taxableBase > previousThreshold) {
      marginalRate = bracket.rate;
    }

    previousThreshold = bracketTop === Infinity ? taxableBase : bracketTop;
  }

  // Apply personal allowance: as a tax credit (CZ, PL) or already deducted from base above
  const incomeTaxMonthly = config.allowanceIsCredit
    ? Math.max(0, rawTax - config.personalAllowance)
    : rawTax;

  return {
    grossMonthly,
    taxableBase,   // reflects ceil100 rounding and/or base deduction
    incomeTaxMonthly,
    effectiveTaxRate: grossMonthly > 0 ? incomeTaxMonthly / grossMonthly : 0,
    marginalTaxRate: marginalRate,
    bracketBreakdown: breakdown,
  };
}

function calculateFlat(
  config: IncomeTaxConfig,
  grossMonthly: number
): TaxResult {
  const rate = config.flatRate ?? 0;
  const taxableBase = Math.max(0, grossMonthly - config.personalAllowance);
  const incomeTaxMonthly = taxableBase * rate;

  return {
    grossMonthly,
    taxableBase,
    incomeTaxMonthly,
    effectiveTaxRate: grossMonthly > 0 ? incomeTaxMonthly / grossMonthly : 0,
    marginalTaxRate: rate,
    bracketBreakdown: [
      {
        bracket: `${(rate * 100).toFixed(0)}% flat`,
        amount: taxableBase,
        tax: incomeTaxMonthly,
      },
    ],
  };
}

export const TaxEngine = {
  /**
   * Calculate income tax for a given country config and monthly gross wage.
   * @param country  Full CountryConfig (only incomeTax fields are used)
   * @param grossMonthly  Monthly gross wage in local currency
   */
  calculate(country: CountryConfig, grossMonthly: number): TaxResult {
    const cfg = country.incomeTax;
    switch (cfg.type) {
      case 'progressive':
        return calculateProgressive(cfg, grossMonthly);
      case 'flat':
        return calculateFlat(cfg, grossMonthly);
    }
  },
};
