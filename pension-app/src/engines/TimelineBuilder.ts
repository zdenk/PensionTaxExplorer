/**
 * TimelineBuilder — Year-by-year data for Graph 1 and Graph 2
 *
 * Produces one YearlySnapshot per age from careerStartAge to (retirementAge + retirementDuration).
 * Pure function — no side effects.
 */

import type { CountryConfig, YearlySnapshot, SSCResult, TaxResult, CZBenefitResult } from '../types';
import { TaxEngine } from './TaxEngine';
import { SSCEngine } from './SSCEngine';
import { PensionEngine } from './PensionEngine';
import { FairReturnEngine } from './FairReturnEngine';
import { computePensionTax } from '../utils/computeScenario';

function getReturnRate(country: CountryConfig): number {
  // Use Pillar 2 default return rate if available, otherwise 3.5% baseline
  return country.pillar2?.defaultAnnualReturnRate ?? 0.030; // 3% real net-of-fees fallback — constant prices model
}

export const TimelineBuilder = {
  /**
   * Build the full age 25→90 timeline.
   *
   * @param country         Full CountryConfig
   * @param grossMonthly    Monthly gross wage / profit (constant — no real wage growth modelled in V1)
   * @param careerStartAge  Age contributions start (default 25)
   * @param retirementAge   Age at which pension is drawn (country statutory default)
   * @param retirementDuration Years in retirement (default 20 for CZ, up to 25/age 90)
   * @param overrides       Optional OSVČ / self-employment overrides:
   *                        - sscResult: pre-computed SSC (replaces SSCEngine.calculate)
   *                        - pensionGross: effective earnings for PensionEngine (50% of profit for OSVČ)
   *                        - taxResult: pre-computed tax result (replaces TaxEngine.calculate);
   *                          required for Paušální daň modes which use a fixed tax advance.
   */
  build(
    country: CountryConfig,
    grossMonthly: number,
    careerStartAge: number,
    retirementAge: number,
    retirementDuration: number,
    overrides?: { sscResult?: SSCResult; pensionGross?: number; taxResult?: TaxResult },
    czBenefitResult?: CZBenefitResult,
  ): YearlySnapshot[] {
    const returnRate = getReturnRate(country);
    const careerYears = retirementAge - careerStartAge;
    const endAge = retirementAge + retirementDuration;

    // Pre-calculate career results (same for every career year in V1 — no wage growth).
    // taxResult override is used for Paušální daň modes (fixed advance replaces standard PIT).
    const taxResult = overrides?.taxResult ?? TaxEngine.calculate(country, grossMonthly);
    const sscResult = overrides?.sscResult ?? SSCEngine.calculate(country, grossMonthly);
    const pensionGross = overrides?.pensionGross ?? grossMonthly;
    const monthlyPensionSSC = SSCEngine.pensionSSCTotal(sscResult);
    const annualPensionSSC = monthlyPensionSSC * 12;

    // ── CZ benefit amounts (0 when not active) ──────────────────────────────
    const czNetBenefit  = czBenefitResult?.totalNetAdd       ?? 0;
    const czDps         = czBenefitResult?.pensionContribMonthly ?? 0;
    const totalErCostWithBenefits =
      sscResult.totalEmployerCost + czNetBenefit + czDps;
    const annualDps = czDps * 12;

    const pensionResult = PensionEngine.calculate(
      country,
      pensionGross,
      careerYears,
      retirementAge
    );

    const fairReturnResult = FairReturnEngine.calculate(
      monthlyPensionSSC,
      returnRate,
      careerYears,
      retirementDuration,
      retirementAge,
      pensionResult.monthlyPension
    );

    const snapshots: YearlySnapshot[] = [];

    // ── Career phase ────────────────────────────────────────────────────────
    let cumulativeContribNominal = 0;
    let cumulativeContribCompounded = 0;
    let cumulativeIncomeTax = 0;
    let cumulativeNetTakeHome = 0;
    let cumulativeDpsCompounded = 0;
    const annualIncomeTax = taxResult.incomeTaxMonthly * 12;
    const netTakeHome = grossMonthly - taxResult.incomeTaxMonthly - sscResult.employeeTotal;
    const annualNetTakeHome = netTakeHome * 12;

    for (let age = careerStartAge; age < retirementAge; age++) {
      cumulativeContribNominal += annualPensionSSC;
      cumulativeContribCompounded =
        (cumulativeContribCompounded + annualPensionSSC) * (1 + returnRate);
      cumulativeIncomeTax += annualIncomeTax;
      cumulativeNetTakeHome += annualNetTakeHome;
      // DPS pot grows: (prev pot + annual contribution) × (1 + r) — annuity-due
      cumulativeDpsCompounded = (cumulativeDpsCompounded + annualDps) * (1 + returnRate);

      snapshots.push({
        age,
        phase: 'career',
        grossMonthly,
        netTakeHome,
        incomeTax: taxResult.incomeTaxMonthly,
        employeeSSC: sscResult.employeeTotal,
        employerSSC: sscResult.employerTotal,
        totalEmployerCost: sscResult.totalEmployerCost,
        totalEmployerCostWithBenefits: czDps > 0 || czNetBenefit > 0 ? totalErCostWithBenefits : undefined,
        employeePensionSSC: sscResult.employeePensionPortion,
        employerPensionSSC: sscResult.employerPensionPortion,
        cumulativePensionContributions: cumulativeContribNominal,
        cumulativeContributionsCompounded: cumulativeContribCompounded,
        cumulativeIncomeTax,
        cumulativeNetTakeHome,
        czNetBenefitMonthly:  czNetBenefit > 0  ? czNetBenefit : undefined,
        czDpsMonthly:         czDps > 0         ? czDps        : undefined,
        cumulativeDpsCompounded: czDps > 0 ? cumulativeDpsCompounded : undefined,
      });
    }

    const finalNominalContribs = cumulativeContribNominal;
    const finalCumulativeIncomeTax = cumulativeIncomeTax;
    const finalCumulativeNetTakeHome = cumulativeNetTakeHome;
    const finalDpsPot = cumulativeDpsCompounded;

    // ── Retirement phase ─────────────────────────────────────────────────────
    let cumulativePensionReceived = 0;    let netCumulativePensionReceived = 0;
    const pensionTaxMonthly = computePensionTax(country, pensionResult.monthlyPension);
    const netMonthlyPension = pensionResult.monthlyPension - pensionTaxMonthly;
    for (let age = retirementAge; age < endAge; age++) {
      const annualPension = pensionResult.monthlyPension * 12;
      cumulativePensionReceived += annualPension;
      netCumulativePensionReceived += netMonthlyPension * 12;
      const breakEvenReached = cumulativePensionReceived >= finalNominalContribs;

      snapshots.push({
        age,
        phase: 'retirement',
        monthlyPension: pensionResult.monthlyPension,
        fairReturnMonthly: fairReturnResult.monthlyAnnuity,
        cumulativePensionReceived,
        netCumulativePensionReceived,
        cumulativePensionContributionsAtRetirement: finalNominalContribs,
        cumulativeIncomeTax: finalCumulativeIncomeTax,       // flat during retirement
        cumulativeNetTakeHome: finalCumulativeNetTakeHome,   // flat during retirement
        breakEvenReached,
        cumulativeDpsCompounded: czDps > 0 ? finalDpsPot : undefined,
        czDpsMonthly: czDps > 0 ? czDps : undefined,
        czDpsMonthlyPension: czBenefitResult?.dpsMonthlyPension,
      });
    }

    return snapshots;
  },
};
