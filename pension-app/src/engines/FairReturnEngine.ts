/**
 * FairReturnEngine — "What would you get if your contributions had been invested?"
 *
 * Computes the hypothetical monthly annuity if all pension-related SSC
 * had been invested at the per-country Pillar 2 default return rate and
 * then paid out as a level annuity over the retirement period.
 *
 * This is used in Graph 2 (Accumulation) to show the opportunity cost of
 * a PAYG system versus a funded equivalent.
 */

import type { FairReturnResult } from '../types';

/**
 * Build the future value of a stream of equal annual contributions
 * compounded at annualReturnRate over careerYears.
 *
 * FV of an annuity-due (contributions added at start of each year):
 *   FV = PMT × [(1 + r)^n - 1] / r × (1 + r)
 *
 * We treat each year's pension SSC as a lump-sum added at the start of
 * each year, then grown for the remaining career years.
 */
function buildFutureValue(
  annualContribution: number,
  annualReturnRate: number,
  careerYears: number
): number {
  if (annualReturnRate === 0) {
    return annualContribution * careerYears;
  }
  const r = annualReturnRate;
  const n = careerYears;
  // FV of ordinary annuity compounded forward one more year (annuity-due)
  return annualContribution * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
}

/**
 * Compute the level monthly annuity that exhausts a lump sum pot over
 * retirementYears at the given annual return rate.
 *
 * Standard present-value of annuity formula rearranged:
 *   PMT = PV × r / (1 − (1 + r)^−n)
 * where r = monthly rate, n = total months.
 */
function levelAnnuity(pot: number, annualReturnRate: number, retirementYears: number): number {
  const r = annualReturnRate / 12;
  const n = retirementYears * 12;
  if (r === 0) return pot / n;
  return (pot * r) / (1 - Math.pow(1 + r, -n));
}

/**
 * Estimate the age at which cumulative pension received equals cumulative
 * pension contributions paid (nominal, no discounting — the "break-even" shown in Graph 1).
 *
 * @param retirementAge         Age pension payments start
 * @param monthlyPension        Monthly pension amount
 * @param totalContributions    Nominal lifetime contributions (no compounding)
 * @returns Age of break-even, or null if never reached within 40 years of retirement
 */
function calcBreakEvenAge(
  retirementAge: number,
  monthlyPension: number,
  totalContributions: number
): number | null {
  if (monthlyPension <= 0) return null;
  const monthsToBreakEven = totalContributions / monthlyPension;
  const yearsToBreakEven = monthsToBreakEven / 12;
  const breakEvenAge = retirementAge + yearsToBreakEven;
  // Only report if within realistic lifespan (up to age 105)
  return breakEvenAge <= 105 ? Math.round(breakEvenAge) : null;
}

export const FairReturnEngine = {
  /**
   * Calculate the fair return annuity for a given scenario.
   *
   * @param monthlyPensionSSC     Monthly pension SSC (employee + employer funded portion)
   * @param annualReturnRate      Per-country default Pillar 2 return rate (e.g. 0.035)
   * @param careerYears           Total years contributions are made
   * @param retirementYears       Years in retirement (used for annuity calculation)
   * @param retirementAge         Used for break-even age calculation
   * @param monthlyPension        Country's actual pension (for break-even comparison)
   */
  calculate(
    monthlyPensionSSC: number,
    annualReturnRate: number,
    careerYears: number,
    retirementYears: number,
    retirementAge: number,
    monthlyPension: number
  ): FairReturnResult {
    const annualContribution = monthlyPensionSSC * 12;
    const totalContributionsPaid = annualContribution * careerYears; // nominal

    const accumulatedPot = buildFutureValue(annualContribution, annualReturnRate, careerYears);
    const monthlyAnnuity = levelAnnuity(accumulatedPot, annualReturnRate, retirementYears);
    const breakEvenAge = calcBreakEvenAge(retirementAge, monthlyPension, totalContributionsPaid);

    return {
      accumulatedPot,
      monthlyAnnuity,
      totalContributionsPaid,
      breakEvenAge,
    };
  },
};
