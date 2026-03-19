/**
 * SSCEngine — Social Security Contribution Calculator
 *
 * Pure function. No side effects.
 * Computes both employee and employer SSC, broken down by component.
 * The pensionFunded flag on each component drives the pension contribution split
 * used by the FairReturnEngine and TimelineBuilder.
 */

import type { CountryConfig, SSCConfig, SSCComponentResult, SSCResult } from '../types';

/**
 * Calculate SSC for a single side (employee or employer) of a given config.
 * Applies per-component ceilings if set, otherwise uses the top-level ceiling.
 */
function computeSide(
  config: SSCConfig,
  grossMonthly: number
): { total: number; pensionPortion: number; componentAmounts: { label: string; amount: number; pensionFunded: boolean }[] } {
  const effectiveCeiling = config.ceiling ?? Infinity;

  let total = 0;
  let pensionPortion = 0;
  const componentAmounts: { label: string; amount: number; pensionFunded: boolean }[] = [];

  for (const comp of config.components) {
    // Component-level ceiling overrides the top-level cap if set
    const compCap = comp.ceiling ?? effectiveCeiling;
    const contributoryBase = Math.min(grossMonthly, compCap);
    // CZ/SK health insurance law requires ceiling (roundUp) rather than half-up rounding
    const rawAmount = contributoryBase * comp.rate;
    const amount = comp.roundUp ? Math.ceil(rawAmount) : rawAmount;

    total += amount;
    if (comp.pensionFunded) pensionPortion += amount;
    componentAmounts.push({ label: comp.label, amount, pensionFunded: comp.pensionFunded });
  }

  return { total, pensionPortion, componentAmounts };
}

/**
 * Merge employee and employer component lists into a unified SSCComponentResult[].
 * Components are matched by label. All unique labels from both sides are included.
 * fundsPension is true if EITHER side marks the component as pension-funded
 * (e.g. employer pension insurance exists only on the employer side).
 */
function mergeComponents(
  eeComponents: { label: string; amount: number; pensionFunded: boolean }[],
  erComponents: { label: string; amount: number; pensionFunded: boolean }[]
): SSCComponentResult[] {
  const labels = new Set([
    ...eeComponents.map(c => c.label),
    ...erComponents.map(c => c.label),
  ]);

  const result: SSCComponentResult[] = [];
  for (const label of labels) {
    const ee = eeComponents.find(c => c.label === label);
    const er = erComponents.find(c => c.label === label);
    result.push({
      label,
      employeeAmount: ee?.amount ?? 0,
      employerAmount: er?.amount ?? 0,
      // True if EITHER side funds pension for this component
      fundsPension: (ee?.pensionFunded ?? false) || (er?.pensionFunded ?? false),
    });
  }
  return result;
}

export const SSCEngine = {
  /**
   * Calculate all SSC for a given country config and monthly gross wage.
   * @param country Full CountryConfig (employeeSSC and employerSSC are used)
   * @param grossMonthly Monthly gross wage in local currency
   */
  calculate(country: CountryConfig, grossMonthly: number): SSCResult {
    const ee = computeSide(country.employeeSSC, grossMonthly);
    const er = computeSide(country.employerSSC, grossMonthly);

    const components = mergeComponents(ee.componentAmounts, er.componentAmounts);

    return {
      employeeTotal: ee.total,
      employerTotal: er.total,
      employeePensionPortion: ee.pensionPortion,
      employerPensionPortion: er.pensionPortion,
      components,
      totalEmployerCost: grossMonthly + er.total,
    };
  },

  /**
   * Compute the total pension-related SSC (employee + employer), used as the
   * contribution base in FairReturnEngine and TimelineBuilder.
   */
  pensionSSCTotal(sscResult: SSCResult): number {
    return sscResult.employeePensionPortion + sscResult.employerPensionPortion;
  },
};
