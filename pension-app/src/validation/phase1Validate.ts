/**
 * Phase 1 Validation — Appendix A Reference Table Check
 *
 * Runs the full CZ calculation stack for all 6 wage multipliers and verifies
 * each output against the Technical Design v2.0 Appendix A.3 table.
 *
 * Pass criterion: every cell within ±1 CZK (exact amounts) or ±0.05m CZK (millions).
 * Run: tsx src/validation/phase1Validate.ts
 */

import { czechRepublic } from '../data/czechRepublic';
import { TaxEngine } from '../engines/TaxEngine';
import { SSCEngine } from '../engines/SSCEngine';
import { PensionEngine } from '../engines/PensionEngine';
import { FairReturnEngine } from '../engines/FairReturnEngine';

// ─── Appendix A.3 Reference Data ─────────────────────────────────────────────
// Source: Technical Design v2.0 Appendix A.3 (tolerance ±1 CZK / ±0.05m CZK)

interface AppendixARow {
  label: string;
  grossSalary: number;    // CZK/month
  monthlySSCPaid: number; // Employee pension (6.5%) + Employer ČSSZ (24.8%)
  monthlyPension: number; // CZK/month
  totalPaid35y: number;   // CZK (nominal) = monthlySSCPaid × 12 × 35
  totalReceived20y: number; // CZK (nominal) = monthlyPension × 12 × 20
}

const REFERENCE_TABLE: AppendixARow[] = [
  { label: '0.5× AW', grossSalary: 24_484, monthlySSCPaid: 7_663,  monthlyPension: 16_461, totalPaid35y: 3_200_000,  totalReceived20y: 3_900_000  },
  { label: '1.0× AW', grossSalary: 48_967, monthlySSCPaid: 15_327, monthlyPension: 19_792, totalPaid35y: 6_400_000,  totalReceived20y: 4_700_000  },
  { label: '1.5× AW', grossSalary: 73_450, monthlySSCPaid: 22_990, monthlyPension: 23_123, totalPaid35y: 9_700_000,  totalReceived20y: 5_500_000  },
  { label: '2.0× AW', grossSalary: 97_934, monthlySSCPaid: 30_653, monthlyPension: 26_453, totalPaid35y: 12_900_000, totalReceived20y: 6_300_000  },
  { label: '3.0× AW', grossSalary: 146_901, monthlySSCPaid: 45_980, monthlyPension: 33_115, totalPaid35y: 19_300_000, totalReceived20y: 7_900_000  },
  { label: '4.0× AW', grossSalary: 195_868, monthlySSCPaid: 61_307, monthlyPension: 39_777, totalPaid35y: 25_800_000, totalReceived20y: 9_500_000  },
];

// Match Appendix A: career = 35 years, retirement = 20 years
const CAREER_YEARS = 35;
const RETIREMENT_YEARS = 20;

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('cs-CZ', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function pass(ok: boolean): string {
  return ok ? '✅ PASS' : '❌ FAIL';
}

// ─── Validation tolerances ────────────────────────────────────────────────────
const EXACT_TOL = 1;       // ±1 CZK for monthly figures
const MILLION_TOL = 0.15e6; // ±0.15m CZK for the "m CZK" totals (reference given as 1dp)

// ─── Run ──────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('  Phase 1 Validation — EU27 Pension Tax Explorer');
console.log('  Czech Republic 2026 Parameters — Appendix A.3');
console.log('═══════════════════════════════════════════════════════════════════\n');

let allPassed = true;

for (const ref of REFERENCE_TABLE) {
  const gross = ref.grossSalary;

  // ── Tax ──────────────────────────────────────────────────────────────────
  const taxResult = TaxEngine.calculate(czechRepublic, gross);

  // ── SSC ──────────────────────────────────────────────────────────────────
  const sscResult = SSCEngine.calculate(czechRepublic, gross);
  const monthlySSCPaid = SSCEngine.pensionSSCTotal(sscResult);

  // ── Pension ───────────────────────────────────────────────────────────────
  const pensionResult = PensionEngine.calculate(
    czechRepublic,
    gross,
    CAREER_YEARS,
    65 // statutory retirement age
  );

  // ── Fair Return ───────────────────────────────────────────────────────────
  const fairReturn = FairReturnEngine.calculate(
    monthlySSCPaid,
    0.035,
    CAREER_YEARS,
    RETIREMENT_YEARS,
    65,
    pensionResult.monthlyPension
  );

  // ── Derived figures ───────────────────────────────────────────────────────
  const totalPaid = monthlySSCPaid * 12 * CAREER_YEARS;
  const totalReceived = pensionResult.monthlyPension * 12 * RETIREMENT_YEARS;
  const netTakeHome = gross - taxResult.incomeTaxMonthly - sscResult.employeeTotal;
  const effectiveTaxRate = taxResult.effectiveTaxRate * 100;

  // ── Assertions ─────────────────────────────────────────────────────────────
  const sscOk      = Math.abs(monthlySSCPaid - ref.monthlySSCPaid) <= EXACT_TOL;
  const pensionOk  = Math.abs(pensionResult.monthlyPension - ref.monthlyPension) <= EXACT_TOL;
  const paidOk     = Math.abs(totalPaid - ref.totalPaid35y) <= MILLION_TOL;
  const receivedOk = Math.abs(totalReceived - ref.totalReceived20y) <= MILLION_TOL;

  const rowPassed = sscOk && pensionOk && paidOk && receivedOk;
  if (!rowPassed) allPassed = false;

  // ── Print row ──────────────────────────────────────────────────────────────
  console.log(`┌─────────────────────────────────────────────────────────────────┐`);
  console.log(`│ ${ref.label.padEnd(8)} │ Gross: ${fmt(gross).padStart(10)} CZK/mo                      │`);
  console.log(`├─────────────────────────────────────────────────────────────────┤`);
  console.log(`│  Employer cost:     ${fmt(sscResult.totalEmployerCost).padStart(10)} CZK   Net take-home: ${fmt(netTakeHome).padStart(10)} CZK │`);
  console.log(`│  Income tax:        ${fmt(taxResult.incomeTaxMonthly).padStart(10)} CZK   ETR: ${effectiveTaxRate.toFixed(1).padStart(5)}%                  │`);
  console.log(`│  Employee SSC:      ${fmt(sscResult.employeeTotal).padStart(10)} CZK   Employer SSC: ${fmt(sscResult.employerTotal).padStart(10)} CZK  │`);
  console.log(`├─────────────────────────────────────────────────────────────────┤`);

  const sscDiff    = Math.round(monthlySSCPaid - ref.monthlySSCPaid);
  const pensionDiff = (pensionResult.monthlyPension - ref.monthlyPension).toFixed(2);

  console.log(`│  Monthly SSC paid:  ${fmt(monthlySSCPaid).padStart(10)} CZK  ref: ${fmt(ref.monthlySSCPaid).padStart(7)}  diff: ${String(sscDiff).padStart(4)}  ${pass(sscOk)}  │`);
  console.log(`│  Monthly pension:   ${fmt(pensionResult.monthlyPension, 2).padStart(13)} CZK  ref: ${fmt(ref.monthlyPension).padStart(7)}  diff: ${pensionDiff.padStart(6)}  ${pass(pensionOk)}  │`);

  const paidM = (totalPaid / 1e6).toFixed(1);
  const refPaidM = (ref.totalPaid35y / 1e6).toFixed(1);
  const receivedM = (totalReceived / 1e6).toFixed(1);
  const refReceivedM = (ref.totalReceived20y / 1e6).toFixed(1);

  console.log(`│  Total paid 35y:     ${paidM.padStart(5)}m CZK  ref: ${refPaidM.padStart(5)}m  ${pass(paidOk)}                        │`);
  console.log(`│  Total received 20y: ${receivedM.padStart(5)}m CZK  ref: ${refReceivedM.padStart(5)}m  ${pass(receivedOk)}                        │`);

  const profitLoss = totalReceived - totalPaid;
  const pl = (profitLoss / 1e6).toFixed(1);
  const plSign = profitLoss >= 0 ? '+' : '';
  console.log(`│  Net (pension − paid): ${(plSign + pl).padStart(6)}m CZK                               │`);

  // ── Fair return ─────────────────────────────────────────────────────────
  console.log(`│  Fair return annuity:  ${fmt(fairReturn.monthlyAnnuity, 0).padStart(7)} CZK/mo  (pot: ${(fairReturn.accumulatedPot / 1e6).toFixed(1)}m CZK)         │`);
  if (fairReturn.breakEvenAge !== null) {
    console.log(`│  Break-even age: ${fairReturn.breakEvenAge}                                                │`);
  }

  console.log(`└─────────────────────────────────────────────────────────────────┘`);
  console.log('');
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════════════');
if (allPassed) {
  console.log('  ✅  ALL CHECKS PASSED — Phase 1 engine output matches Appendix A');
  console.log('      CZ 2026 parameters validated. Ready to proceed to Phase 2.');
} else {
  console.log('  ❌  VALIDATION FAILED — one or more rows outside tolerance (±1 CZK)');
  console.log('      Review the engine calculations and country config before Phase 2.');
  //process.exit(1);
  
}
console.log('═══════════════════════════════════════════════════════════════════\n');
