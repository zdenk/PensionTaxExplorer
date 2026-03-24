/**
 * computeScenario — derives a full ScenarioResult for one country + wage + career setting.
 * Called on every render; no caching needed (pure functions, fast for this data volume).
 */

import type {
  CountryConfig, WageMode, CareerDefaults, ScenarioResult,
  SelfEmploymentMode, SSCResult, SSCComponentResult, TaxResult,
  CZBenefitSelections, CZBenefitResult,
} from '../types';
import { TaxEngine } from '../engines/TaxEngine';
import { SSCEngine } from '../engines/SSCEngine';
import { PensionEngine } from '../engines/PensionEngine';
import { TimelineBuilder } from '../engines/TimelineBuilder';
import { FairReturnEngine } from '../engines/FairReturnEngine';
import { resolveGross } from './resolveWage';

/**
 * Compute SSC for an OSVČ (Czech self-employed) mode.
 * The OSVČ pays all SSC themselves — no employer split.
 *
 * Assessment base = max(grossMonthly × assessmentBasisRate, minBase)
 * Social components use minSocialInsuranceBase as their floor.
 * Health components use minHealthInsuranceBase as their floor.
 *
 * Source: §5b zákon č. 589/1992 Sb. (social ins.) + §3a zákon č. 592/1992 Sb. (health ins.)
 */
export function computeOSVCSsc(
  grossMonthly: number,
  mode: SelfEmploymentMode,
): SSCResult {
  const ratio     = mode.assessmentBasisRate ?? 0.5;
  const rawBase   = grossMonthly * ratio;
  const socialBase = Math.max(rawBase, mode.minSocialInsuranceBase ?? 0);
  const healthBase = Math.max(rawBase, mode.minHealthInsuranceBase ?? 0);

  let total = 0;
  let pensionPortion = 0;
  const componentResults: SSCComponentResult[] = [];

  for (const comp of (mode.sscOverrideComponents ?? [])) {
    const base    = comp.baseType === 'social' ? socialBase : healthBase;
    const capped  = comp.ceiling != null ? Math.min(base, comp.ceiling) : base;
    const raw     = capped * comp.rate;
    const amount  = comp.roundUp ? Math.ceil(raw) : raw;

    total += amount;
    if (comp.pensionFunded) pensionPortion += amount;
    componentResults.push({
      label:          comp.label,
      employeeAmount: amount,  // OSVČ pays it all; no employer split
      employerAmount: 0,
      fundsPension:   comp.pensionFunded,
    });
  }

  return {
    employeeTotal:           total,
    employerTotal:           0,
    employeePensionPortion:  pensionPortion,
    employerPensionPortion:  0,
    components:              componentResults,
    // No employer overhead — the OSVČ is both employee and employer
    totalEmployerCost: grossMonthly,
  };
}

/**
 * Compute the monthly income tax levied on a pension in retirement.
 * Reuses the standard TaxEngine with fraction/allowance adjustments per country rules.
 */
export function computePensionTax(country: CountryConfig, monthlyPension: number): number {
  const cfg = country.pensionTax;
  if (!cfg || cfg.method === 'none') return 0;

  const fraction  = cfg.taxableFraction  ?? 1.0;
  const allowance = cfg.monthlyAllowance ?? 0;
  const taxableIncome = Math.max(0, monthlyPension * fraction - allowance);
  if (taxableIncome === 0) return 0;

  // Apply the country's standard income-tax config to the taxable pension income
  const taxResult = TaxEngine.calculate(country, taxableIncome);
  return taxResult.incomeTaxMonthly;
}

/**
 * Compute the CZ employer-benefit result.
 *
 * Fringe benefits and meal vouchers increase the employee's effective take-home
 * (no tax / SSC on either side).  Pension contributions are accumulated at the
 * country's Pillar-2 real return rate and annuitised over the retirement period.
 *
 * Accumulation formula (annuity-due): FV = PMT×[(1+r)ⁿ−1]/r×(1+r)
 * Annuity drawdown:                  PMT = PV × r / [1−(1+r)⁻ⁿ]
 */
function computeCZBenefits(
  selections: CZBenefitSelections,
  returnRate: number,
  careerYears: number,
  retirementDuration: number,
): CZBenefitResult {
  const fringeBenefitMonthly  = selections.fringe_benefit.enabled  ? selections.fringe_benefit.amountMonthly  : 0;
  const mealVoucherMonthly    = selections.meal_voucher.enabled    ? selections.meal_voucher.amountMonthly    : 0;
  const pensionContribMonthly = selections.pension_contrib.enabled ? selections.pension_contrib.amountMonthly : 0;

  const totalNetAdd = fringeBenefitMonthly + mealVoucherMonthly;

  // DPS: annual contribution compounded over career years
  const annualDPS = pensionContribMonthly * 12;
  let dpsPotAtRetirement = 0;
  if (annualDPS > 0) {
    if (returnRate === 0) {
      dpsPotAtRetirement = annualDPS * careerYears;
    } else {
      const r = returnRate;
      const n = careerYears;
      // FV of annuity-due
      dpsPotAtRetirement = annualDPS * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
    }
  }

  // Monthly annuity from DPS pot over retirement duration
  let dpsMonthlyPension = 0;
  if (dpsPotAtRetirement > 0 && retirementDuration > 0) {
    const rM = returnRate / 12;
    const nM = retirementDuration * 12;
    dpsMonthlyPension = rM === 0
      ? dpsPotAtRetirement / nM
      : (dpsPotAtRetirement * rM) / (1 - Math.pow(1 + rM, -nM));
  }

  return {
    fringeBenefitMonthly,
    mealVoucherMonthly,
    pensionContribMonthly,
    totalNetAdd,
    dpsPotAtRetirement,
    dpsMonthlyPension,
    dpsReturnRate: returnRate,
  };
}

export function computeScenario(
  country: CountryConfig,
  wageMode: WageMode,
  careerOverrides: Partial<CareerDefaults>,
  awSource: 'model' | 'oecd' = 'model',
  selfEmploymentModeName?: string | null,
  czBenefits?: CZBenefitSelections,
): ScenarioResult {
  // Resolve the effective average wage based on the selected AW source.
  // For 'oecd', fall back to model AW if oecdAverageWage is not present on this country.
  const effectiveAW = awSource === 'oecd' && country.oecdAverageWage
    ? country.oecdAverageWage
    : country.averageWage;
  const resolvedWage = resolveGross(wageMode, country, effectiveAW);

  const career: CareerDefaults = {
    careerStartAge: careerOverrides.careerStartAge ?? country.defaults.careerStartAge,
    retirementAge: careerOverrides.retirementAge ?? country.defaults.retirementAge,
    retirementDuration: careerOverrides.retirementDuration ?? country.defaults.retirementDuration,
  };

  const careerYears = career.retirementAge - career.careerStartAge;

  // ── Self-employment mode resolution ─────────────────────────────────────────
  // If a named mode is active and this country supports it, use OSVČ SSC rules.
  // Otherwise fall through to standard employee calculation.
  const selfEmpMode: SelfEmploymentMode | null =
    selfEmploymentModeName && country.selfEmployment?.available
      ? (country.selfEmployment.modes.find(m => m.name === selfEmploymentModeName) ?? null)
      : null;

  // ── Gross override for OSVČ + fixed_employer_cost_eur ──────────────────────
  // For OSVČ/PD there is no employer SSC: totalEmployerCost === gross (profit).
  // resolveGross called SSCEngine (employee model) and subtracted phantom employer
  // overhead, giving a lower-than-intended gross.  Correct by treating the fixed
  // cost directly as the monthly profit when self-employment mode is active.
  let gross = resolvedWage.grossLocal;
  let resolvedWageActual = resolvedWage;
  if (selfEmpMode && wageMode.type === 'fixed_employer_cost_eur') {
    const profitLocal = wageMode.value * country.eurExchangeRate;
    const impliedMultiplier = effectiveAW > 0 ? profitLocal / effectiveAW : 0;
    resolvedWageActual = {
      ...resolvedWage,
      grossLocal: profitLocal,
      grossEUR: wageMode.value,
      displayNote: `= ${impliedMultiplier.toFixed(2)}× AW profit in ${country.name}`,
      impliedMultiplier,
    };
    gross = profitLocal;
  }

  // ── SSC ─────────────────────────────────────────────────────────────────────
  let sscResult: SSCResult;
  // For OSVČ, the pension formula uses the social assessment base, not raw profit.
  // This matches how ČSSZ records OSVČ entitlements: based on 50% of profit (≥ min base).
  let pensionBase: number;

  if (selfEmpMode?.sscOverrideComponents?.length) {
    sscResult  = computeOSVCSsc(gross, selfEmpMode);
    const ratio = selfEmpMode.assessmentBasisRate ?? 0.5;
    pensionBase = Math.max(gross * ratio, selfEmpMode.minSocialInsuranceBase ?? 0);
  } else {
    sscResult   = SSCEngine.calculate(country, gross);
    pensionBase = gross;
  }

  // ── Income Tax ────────────────────────────────────────────────────────────
  // For paušální daň modes the standard PIT calculation is replaced by a fixed
  // monthly advance set per band (zákon č. 7/2021 Sb. §7f).
  let taxResult: TaxResult;
  if (selfEmpMode?.pausalniDan) {
    const fixedTax = selfEmpMode.pausalniDan.fixedMonthlyTaxAdvance;
    taxResult = {
      grossMonthly:      gross,
      taxableBase:       gross,
      incomeTaxMonthly:  fixedTax,
      effectiveTaxRate:  gross > 0 ? fixedTax / gross : 0,
      marginalTaxRate:   0,   // paušální daň has no marginal rate — amount is flat
      bracketBreakdown: [{
        bracket: `Paušální daň ${selfEmpMode.pausalniDan.bandLabel} (fixed advance)`,
        amount: gross,
        tax:    fixedTax,
      }],
    };
  } else {
    taxResult = TaxEngine.calculate(country, gross);
  }

  const rawPension = PensionEngine.calculate(country, pensionBase, careerYears, career.retirementAge);

  // Augment pension result with post-retirement income tax on pension income
  const pensionTaxMonthly = computePensionTax(country, rawPension.monthlyPension);
  const pensionResult = {
    ...rawPension,
    pensionIncomeTax:  pensionTaxMonthly,
    netMonthlyPension: rawPension.monthlyPension - pensionTaxMonthly,
  };

  const monthlyPensionSSC = SSCEngine.pensionSSCTotal(sscResult);
  const returnRate = country.pillar2?.defaultAnnualReturnRate ?? 0.030; // 3% real net-of-fees fallback — constant prices model

  const fairReturn = FairReturnEngine.calculate(
    monthlyPensionSSC,
    returnRate,
    careerYears,
    career.retirementDuration,
    career.retirementAge,
    pensionResult.monthlyPension
  );

  // ── CZ employer benefits ──────────────────────────────────────────────────────
  // Computed before TimelineBuilder so it can be passed in for snapshot population.
  const czBenefitResult: CZBenefitResult | undefined =
    country.code === 'CZ' && !selfEmploymentModeName && country.employerBenefits?.available && czBenefits
      ? computeCZBenefits(czBenefits, returnRate, careerYears, career.retirementDuration)
      : undefined;

  const timeline = TimelineBuilder.build(
    country,
    gross,
    career.careerStartAge,
    career.retirementAge,
    career.retirementDuration,
    // Pass OSVČ overrides so the timeline uses the correct SSC, pension base and tax result.
    // taxResult is critical for Paušální daň modes: without it TimelineBuilder would call
    // TaxEngine.calculate() and get the full progressive PIT instead of the fixed advance.
    selfEmpMode?.sscOverrideComponents?.length
      ? { sscResult, pensionGross: pensionBase, taxResult }
      : undefined,
    czBenefitResult,
  );

  return { resolvedWage: resolvedWageActual, taxResult, sscResult, pensionResult, timeline, fairReturn, czBenefitResult };
}
