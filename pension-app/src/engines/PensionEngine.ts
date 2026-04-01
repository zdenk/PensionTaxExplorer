/**
 * PensionEngine — Pension Formula Calculator
 *
 * Pure function dispatching to sub-calculators by pension system type.
 * All sub-calculators operate in local currency.
 *
 * Phase 1 fully implements: DB (Czech Republic), PensionAccount (Austria stub),
 * Points (Germany stub), NDC (Poland/Sweden/Italy stub), Mixed.
 */

import type {
  CountryConfig,
  DBConfig,
  PensionAccountConfig,
  PointsConfig,
  NDCConfig,
  PensionSystemConfig,
  PensionResult,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-calculators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DB calculator — Czech Republic (and Hungary, Ireland, Spain, Portugal, Belgium, Greece)
 *
 * Formula:
 *   1. Apply reduction thresholds to monthly earnings → credited assessment base
 *   2. procentní výměra = credited × years × accrualRate
 *   3. Total pension = basePension + procentní výměra
 *
 * BUG FIX NOTE (v2.0): v1.0 contained an erroneous /30 divisor. Removed.
 * See Technical Design v2.0 § 3.3 and Appendix A.
 */
function calcDB(
  config: DBConfig,
  avgMonthlyEarnings: number,
  years: number
): { monthly: number; formulaInputs: Record<string, number> } {
  let credited = 0;
  let previousThreshold = 0;
  const bandAmounts: Record<string, number> = {};

  for (let i = 0; i < config.reductionThresholds.length; i++) {
    const threshold = config.reductionThresholds[i];
    const slice = Math.max(0, Math.min(avgMonthlyEarnings, threshold.upTo) - previousThreshold);
    const creditedSlice = slice * threshold.creditRate;
    credited += creditedSlice;
    bandAmounts[`band${i + 1}Credited`] = creditedSlice;
    previousThreshold = threshold.upTo === Infinity ? avgMonthlyEarnings : threshold.upTo;
  }

  const percentagePension = credited * years * config.accrualRatePerYear;
  let monthly = config.basePension + percentagePension;

  // Apply statutory minimum pension floor (e.g. Belgium minimum guarantee).
  // Phase 7: prorate by careerFraction for partial careers.
  if (config.minimumMonthlyPension != null && monthly < config.minimumMonthlyPension) {
    monthly = config.minimumMonthlyPension;
  }

  return {
    monthly,
    formulaInputs: {
      avgMonthlyEarnings,
      credited,
      years,
      accrualRate: config.accrualRatePerYear,
      basePension: config.basePension,
      percentagePension,
      ...bandAmounts,
    },
  };
}

/**
 * Pension Account calculator — Austria (Pensionskonto, post-2005)
 *
 * Formula:
 *   Accumulates annual credits (capped at ceiling × annualCreditRate) valorised each year.
 *   At retirement: account ÷ Teilungsziffer ÷ 14 payment months × 12 = monthly pension.
 */
function calcPensionAccount(
  config: PensionAccountConfig,
  grossMonthly: number,
  years: number,
  retirementAge: number
): { monthly: number; formulaInputs: Record<string, number> } {
  let account = 0;
  const valorisation = config.valorisationRate;

  for (let y = 0; y < years; y++) {
    const annualCredit = Math.min(grossMonthly, config.ceiling) * 12 * config.annualCreditRate;
    account = (account + annualCredit) * (1 + valorisation);
  }

  const teilungsziffer =
    config.annuityDivisor[retirementAge] ?? config.annuityDivisor[65] ?? 20;

  // Account ÷ Teilungsziffer gives annual pension in 14 payment instalments
  // → convert to calendar monthly: × (12 / 14)
  const monthly = (account / teilungsziffer) * (12 / 14);

  return {
    monthly,
    formulaInputs: {
      finalAccount: account,
      teilungsziffer,
      grossMonthly,
      years,
      annualCreditRate: config.annualCreditRate,
      ceiling: config.ceiling,
    },
  };
}

/**
 * Points calculator — Germany, France, Belgium, Slovakia, Luxembourg
 *
 * Solidarity reduction (e.g. Slovakia POMB § 40/461/2003):
 *   Earnings above solidarityReductionThreshold contribute at (1 − solidarityReductionRate)
 *   effective accrual, reducing the annual point count for high earners.
 */
function calcPoints(
  config: PointsConfig,
  grossMonthly: number,
  years: number
): { monthly: number; formulaInputs: Record<string, number> } {
  // Apply solidarity reduction if configured (e.g. Slovakia POMB)
  let effectiveMonthly = grossMonthly;
  if (
    config.solidarityReductionThreshold != null &&
    config.solidarityReductionRate != null &&
    grossMonthly > config.solidarityReductionThreshold
  ) {
    const belowPart = config.solidarityReductionThreshold;
    const abovePart = grossMonthly - config.solidarityReductionThreshold;
    effectiveMonthly = belowPart + abovePart * (1 - config.solidarityReductionRate);
  }

  const annualPoints = Math.min(
    (effectiveMonthly * 12) / config.referenceWage,
    config.ceiling
  );
  const totalPoints = annualPoints * years;
  let monthly = totalPoints * config.pointValue;

  // Apply statutory minimum pension floor
  if (config.minimumPension != null && monthly < config.minimumPension) {
    monthly = config.minimumPension;
  }

  return {
    monthly,
    formulaInputs: {
      annualPoints,
      totalPoints,
      pointValue: config.pointValue,
      grossMonthly,
      effectiveMonthly,
      years,
      referenceWage: config.referenceWage,
      ceiling: config.ceiling,
    },
  };
}

/**
 * NDC calculator — Poland, Sweden, Italy, Latvia, Estonia
 */
function calcNDC(
  config: NDCConfig,
  grossMonthly: number,
  years: number,
  retirementAge: number
): { monthly: number; formulaInputs: Record<string, number> } {
  let account = 0;
  const returnRate = config.notionalReturnRate;

  for (let y = 0; y < years; y++) {
    const annualContribution =
      Math.min(grossMonthly, config.ceiling) * 12 * config.pillar1ContributionRate;
    account = (account + annualContribution) * (1 + returnRate);
  }

  const divisor =
    config.annuityDivisor[retirementAge] ?? config.annuityDivisor[65] ?? 258;

  // divisor = remaining life expectancy in months; monthly pension = account / divisor
  const monthly = account / divisor;

  return {
    monthly,
    formulaInputs: {
      finalAccount: account,
      divisor,
      notionalReturnRate: config.notionalReturnRate,
      pillar1ContributionRate: config.pillar1ContributionRate,
      years,
      ceiling: config.ceiling,
    },
  };
}

/**
 * Dispatch function — routes to the correct sub-calculator.
 */
function dispatch(
  system: PensionSystemConfig,
  grossMonthly: number,
  years: number,
  retirementAge: number
): { monthly: number; formulaInputs: Record<string, number> } {
  switch (system.type) {
    case 'DB':
      return calcDB(system, grossMonthly, years);

    case 'PENSION_ACCOUNT':
      return calcPensionAccount(system, grossMonthly, years, retirementAge);

    case 'POINTS':
      return calcPoints(system, grossMonthly, years);

    case 'NDC':
      return calcNDC(system, grossMonthly, years, retirementAge);

    case 'MIXED': {
      const pillar1Result = dispatch(system.pillar1, grossMonthly, years, retirementAge);
      let pillar2Monthly: number;

      if (system.pillar2Type === 'payg_points') {
        // PAYG points system (e.g. AGIRC-ARRCO France):
        //   T1: min(gross, pillar2Ceiling) × rate × years × paygFactor
        //   T2: max(0, gross − pillar2Ceiling) × t2Rate × years × t2Factor
        //   (T2 only used when pillar2Ceiling, pillar2T2Rate, pillar2T2PAYGFactor are all set)
        const paygFactor = system.pillar2PAYGFactor ?? 1;
        const ceiling    = system.pillar2Ceiling;
        const t1Base     = ceiling != null ? Math.min(grossMonthly, ceiling) : grossMonthly;
        pillar2Monthly   = t1Base * system.pillar2Rate * years * paygFactor;

        // Tranche 2 above pillar2Ceiling (e.g. AGIRC-ARRCO above PSS)
        if (
          ceiling != null &&
          system.pillar2T2Rate != null &&
          system.pillar2T2PAYGFactor != null &&
          grossMonthly > ceiling
        ) {
          const t2Base = grossMonthly - ceiling;
          pillar2Monthly += t2Base * system.pillar2T2Rate * years * system.pillar2T2PAYGFactor;
        }
      } else {
        // Funded account with optional AOW-style franchise and per-country return rate
        pillar2Monthly = calcSimplePillar2(
          system.pillar2Rate,
          grossMonthly,
          years,
          system.pillar2ReturnRate ?? 0.03,
          system.pillar2Franchise ?? 0,
        );
      }

      return {
        monthly: pillar1Result.monthly + pillar2Monthly,
        formulaInputs: {
          ...pillar1Result.formulaInputs,
          pillar2Rate: system.pillar2Rate,
          pillar2Monthly,
        },
      };
    }
  }
}

/**
 * Simplified Pillar 2 projection — used within MixedConfig.
 *
 * @param rate        Contribution rate (% of eligible earnings)
 * @param grossMonthly Monthly gross pre-retirement earnings (local currency)
 * @param years       Career length (years of contributions)
 * @param returnRate  Annual real net-of-fees return rate (default 3% per OECD convention).
 *                    Pass pillar2ReturnRate from MixedConfig to override.
 * @param franchise   Monthly earnings offset excluded from the P2 contribution base
 *                    (e.g. NL AOW franchise: max(0, gross - franchise) × rate).
 */
function calcSimplePillar2(
  rate: number,
  grossMonthly: number,
  years: number,
  returnRate = 0.03,
  franchise = 0,
): number {
  const contributionBase = Math.max(0, grossMonthly - franchise);
  let account = 0;
  for (let y = 0; y < years; y++) {
    const annual = contributionBase * 12 * rate;
    account = (account + annual) * (1 + returnRate);
  }
  // Annuitise over 20 years at the same real return rate
  const r = returnRate / 12;
  const n = 20 * 12;
  return r > 0 ? (account * r) / (1 - Math.pow(1 + r, -n)) : account / n;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export const PensionEngine = {
  /**
   * Calculate the monthly pension for a given scenario.
   *
   * @param country       Full CountryConfig
   * @param grossMonthly  Average lifetime monthly gross earnings (local currency)
   * @param careerYears   Total years of contributions
   * @param retirementAge Age at which pension is drawn
   */
  calculate(
    country: CountryConfig,
    grossMonthly: number,
    careerYears: number,
    retirementAge: number
  ): PensionResult {
    const system = country.pensionSystem;
    const { monthly, formulaInputs } = dispatch(system, grossMonthly, careerYears, retirementAge);

    // Extract pillar split if Mixed
    let pillar2Monthly: number | undefined;
    if (system.type === 'MIXED') {
      pillar2Monthly = (formulaInputs['pillar2Monthly'] as number) ?? 0;
    }

    const pillar1Monthly = system.type === 'MIXED' ? monthly - (pillar2Monthly ?? 0) : monthly;

    return {
      monthlyPension: monthly,
      pillar1Monthly,
      pillar2Monthly,
      replacementRate: grossMonthly > 0 ? monthly / grossMonthly : 0,
      systemType: system.type,
      formulaInputs,
    };
  },
};
