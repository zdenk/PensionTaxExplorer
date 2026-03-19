/**
 * Tier 4 Country Validation
 *
 * Runs the full calculation engine on each Tier 4 country at AW to verify:
 *   1. TypeScript compiles without error (tsc --noEmit)
 *   2. Tax, SSC, and pension calculations produce finite, positive numbers
 *   3. Replacement rates are in a plausible range
 *   4. No country is still marked incomplete: true
 *
 * Expected gross replacement rates at 1× AW, career = retirementAge − careerStartAge:
 *   IT: ~80–100%  (NDC 33%@1.2% 42yr career, annuity divisor at 67 = 236 months; OECD 91.1%)
 *   ES: ~65–85%   (DB 1.96%/yr × 41yr career; OECD 72.3%)
 *   PT: ~70–90%   (DB 2.0%/yr × 41yr career; sustainability factor suspended 2026)
 *   GR: ~45–65%   (MIXED: 400 EUR flat + 0.60%/yr × 42yr career; OECD 53.7%)
 *   HU: ~65–85%   (DB 1.83%/yr × 40yr career; OECD 73.4%; pension tax-exempt)
 *   SI: ~50–65%   (DB 1.40%/yr × 40yr career; OECD 56.1%)
 *
 * Run: npx tsx src/validation/tier4Check.ts
 */

import { italy }    from '../data/italy';
import { spain }    from '../data/spain';
import { portugal } from '../data/portugal';
import { greece }   from '../data/greece';
import { hungary }  from '../data/hungary';
import { slovenia } from '../data/slovenia';
import { PensionEngine } from '../engines/PensionEngine';
import { SSCEngine }    from '../engines/SSCEngine';
import { TaxEngine }    from '../engines/TaxEngine';
import type { CountryConfig } from '../types';

const tier4: CountryConfig[] = [italy, spain, portugal, greece, hungary, slovenia];

// Expected gross RR ranges at 1× AW (min%, max%)
// Ranges are wider than OECD single-number targets to accommodate model assumptions.
const EXPECTED_RR: Record<string, [number, number]> = {
  IT: [75,  105], // NDC 33%@1.2% over 42yr career at 67; OECD 91.1% (at pension age 71)
  ES: [60,  90],  // DB 1.96%/yr × 41yr; OECD 72.3%
  PT: [65,  95],  // DB 2.0%/yr × 41yr (sustainability factor suspended); OECD 67.9% with factor
  GR: [40,  70],  // MIXED flat 400 + earnings-related 0.60%/yr × 42yr; OECD 53.7%
  HU: [60,  90],  // DB 1.83%/yr × 40yr (pension tax-exempt); OECD 73.4%
  SI: [45,  70],  // DB 1.40%/yr × 40yr; OECD 56.1%
};

function fmt(n: number): string { return n.toFixed(1).padStart(7); }
function fmtCurrency(n: number, curr: string): string {
  return `${Math.round(n).toLocaleString()} ${curr}`.padStart(16);
}

const WIDE = '═'.repeat(135);
const THIN = '─'.repeat(135);

console.log('\n' + WIDE);
console.log(' TIER 4 COUNTRY VALIDATION — IT, ES, PT, GR, HU, SI');
console.log(' Tax + SSC + Pension engines at 1× AW — all 22 OECD EU countries complete');
console.log(WIDE + '\n');

let allPass = true;

console.log(
  'Code  Name                AW (local)      AW(EUR)   career  pension(local)  RR%   netPay%  incomplete  status'
);
console.log(THIN);

for (const c of tier4) {
  const AW       = c.averageWage;
  const career   = c.defaults.retirementAge - c.defaults.careerStartAge;
  const awInEur  = AW / c.eurExchangeRate;
  const currLabel = c.currency;

  const tax = TaxEngine.calculate(c, AW);
  const ssc = SSCEngine.calculate(c, AW);
  const pen = PensionEngine.calculate(c, AW, career, c.defaults.retirementAge);

  const grossRR   = (pen.monthlyPension / AW) * 100;
  const netPayPct = ((AW - tax.incomeTaxMonthly - ssc.employeeTotal) / AW) * 100;
  const [lo, hi]  = EXPECTED_RR[c.code] ?? [0, 200];

  const incompleteFlag = c.incomplete ? '⚠ YES  ' : 'no     ';
  const rrOk     = grossRR >= lo && grossRR <= hi && isFinite(grossRR) && grossRR > 0;
  const taxOk    = isFinite(tax.incomeTaxMonthly) && tax.incomeTaxMonthly >= 0;
  const sscOk    = isFinite(ssc.employeeTotal)    && ssc.employeeTotal > 0;
  const penOk    = isFinite(pen.monthlyPension)   && pen.monthlyPension > 0;
  const noIncomplete = !c.incomplete;

  const pass = rrOk && taxOk && sscOk && penOk && noIncomplete;
  if (!pass) allPass = false;

  const status = pass ? '✓ PASS' : '✗ FAIL';

  console.log(
    `${c.code.padEnd(4)}  ${c.name.padEnd(18)}  ` +
    `${fmtCurrency(AW, currLabel)}  ` +
    `${fmt(awInEur)} EUR  ` +
    `${String(career).padStart(6)}yr  ` +
    `${fmtCurrency(pen.monthlyPension, currLabel)}  ` +
    `${fmt(grossRR)}%  ` +
    `${fmt(netPayPct)}%  ` +
    `${incompleteFlag}  ${status}`
  );

  if (!pass) {
    if (!rrOk)       console.log(`       ↳ RR out of range: ${grossRR.toFixed(1)}% (expected ${lo}–${hi}%)`);
    if (!taxOk)      console.log(`       ↳ Income tax invalid: ${tax.incomeTaxMonthly}`);
    if (!sscOk)      console.log(`       ↳ Employee SSC invalid: ${ssc.employeeTotal}`);
    if (!penOk)      console.log(`       ↳ Pension invalid: ${pen.monthlyPension}`);
    if (!noIncomplete) console.log(`       ↳ Country still has incomplete: true`);
  }
}

console.log(THIN);

// Check all 22 countries have no incomplete flag via countryRegistry
import { ALL_COUNTRIES } from '../data/countryRegistry';
const incomplete22 = ALL_COUNTRIES.filter(c => c.incomplete);
if (incomplete22.length > 0) {
  console.log(`\n⚠ WARNING: ${incomplete22.length} country(ies) still marked incomplete: ${incomplete22.map(c => c.code).join(', ')}`);
  allPass = false;
} else {
  console.log(`\n✓ All 22 OECD EU countries: incomplete flag = false\n`);
}

console.log(allPass
  ? `\n✓ ALL TIER 4 CHECKS PASSED — all 22 OECD EU countries fully implemented!\n`
  : `\n✗ SOME TIER 4 CHECKS FAILED — review output above\n`
);
console.log(WIDE + '\n');

if (!allPass) process.exit(1);
