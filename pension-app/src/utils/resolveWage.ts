/**
 * resolveWage — maps a WageMode + CountryConfig → concrete ResolvedWage
 * Implements §4.3 of Technical Design v2.0
 */

import type { WageMode, CountryConfig, ResolvedWage } from '../types';
import { SSCEngine } from '../engines/SSCEngine';

/**
 * Bisection solver: find grossLocal such that
 *   SSCEngine.calculate(country, gross).totalEmployerCost ≈ targetCostLocal
 *
 * Converges in 40 iterations to < 0.001 CZK / 0.0001 EUR accuracy.
 * totalEmployerCost is strictly monotone in gross, so bisection is guaranteed.
 */
function solveGrossFromEmployerCost(country: CountryConfig, targetCostLocal: number): number {
  if (targetCostLocal <= 0) return 0;
  let lo = 0;
  let hi = targetCostLocal; // gross can never exceed total employer cost
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const result = SSCEngine.calculate(country, mid);
    if (result.totalEmployerCost < targetCostLocal) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function resolveGross(mode: WageMode, country: CountryConfig, effectiveAW?: number): ResolvedWage {
  // effectiveAW lets callers substitute the OECD AW for multiplier calculations
  // without mutating the country config.  Falls back to country.averageWage.
  const aw = effectiveAW ?? country.averageWage;
  const fx = country.eurExchangeRate;

  switch (mode.type) {
    case 'multiplier': {
      const grossLocal = aw * mode.value;
      return {
        grossLocal,
        grossEUR: grossLocal / fx,
        referenceLabel: `${mode.value}× AW`,
        averageWageLocal: aw,
        averageWageEUR: aw / fx,
        displayNote: `1× AW = ${aw.toLocaleString()} ${country.currency}`,
      };
    }
    case 'fixed_gross_eur': {
      const grossLocal = mode.value * fx;
      const impliedMultiplier = grossLocal / aw;
      return {
        grossLocal,
        grossEUR: mode.value,
        referenceLabel: `€${mode.value.toLocaleString()} fixed gross`,
        averageWageLocal: aw,
        averageWageEUR: aw / fx,
        displayNote: `= ${impliedMultiplier.toFixed(2)}× AW in ${country.name}`,
        impliedMultiplier,
      };
    }
    case 'fixed_employer_cost_eur': {
      const targetCostLocal = mode.value * fx;
      const grossLocal = solveGrossFromEmployerCost(country, targetCostLocal);
      const impliedMultiplier = aw > 0 ? grossLocal / aw : 0;
      return {
        grossLocal,
        grossEUR: grossLocal / fx,
        referenceLabel: `€${mode.value.toLocaleString()} employer cost`,
        averageWageLocal: aw,
        averageWageEUR: aw / fx,
        displayNote: `= ${impliedMultiplier.toFixed(2)}× AW gross in ${country.name}`,
        impliedMultiplier,
      };
    }
  }
}
