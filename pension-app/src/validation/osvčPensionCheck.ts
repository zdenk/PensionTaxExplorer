/**
 * osvčPensionCheck.ts — OSVČ Paušální Daň Pension Validator
 *
 * Checks estimated pension for self-employed (OSVČ) in the Czech Republic's
 * flat-rate tax scheme (paušální daň), comparing Band 1 and Band 2.
 *
 * Key 2026 parameters (from czechRepublic.ts):
 *   AW_2026               = 48,967 CZK/month
 *   Band 1 social base    = 22,527 CZK/month  (≥ OSSZ minimum; derived from 6,578 ÷ 29.2%)
 *   Band 2 social base    = 28,050 CZK/month  (from 2026 ČSSZ decree)
 *   Reduction threshold 1 = 44% × AW = 21,546 CZK  (@ 99% credit rate)
 *   Reduction threshold 2 = 4 × AW  = 195,868 CZK  (@ 26% credit rate)
 *   Base pension          = 4,900 CZK/month (základní výměra)
 *   Accrual rate          = 1.495% per credited year
 *
 * For OSVČ in paušální daň:
 *   - The social assessment base is FIXED per band (not 50% of profit).
 *   - The pension formula applies the same DB reduction ladder as for employees.
 *   - Only the pension-relevant social insurance portion (29.2% rate) is used
 *     to back-calculate the vyměřovací základ.
 *
 * Social insurance rate for OSVČ § 589/1992 Sb.:
 *   28.0% pension insurance + 1.2% state employment policy = 29.2% total to ČSSZ
 */

import { czechRepublic } from '../data/czechRepublic';
import { PensionEngine } from '../engines/PensionEngine';

// ─── Constants (mirrors czechRepublic.ts exact values) ───────────────────────

const AW = czechRepublic.averageWage;                   // 48,967 CZK/month

// Band social assessment bases (fixed monthly vyměřovací základ)
const BAND1_SOCIAL_BASE = 22_527;                       // CZK/month
const BAND2_SOCIAL_BASE = 28_050;                       // CZK/month

// Band monthly social insurance payments (29.2% of respective base, rounded)
const BAND1_SOCIAL_PAYMENT = Math.round(BAND1_SOCIAL_BASE * 0.292);  // 6,578 CZK
const BAND2_SOCIAL_PAYMENT = Math.round(BAND2_SOCIAL_BASE * 0.292);  // 8,191 CZK

// Reduction thresholds (from czechRepublic.ts)
const RT1 = Math.round(0.44 * AW);   // 21,546 CZK — 44% of AW (@ 99%)
const RT2 = 4 * AW;                  // 195,868 CZK — 4× AW (@ 26%)

// Pension parameters
const BASE_PENSION = 4_900;          // základní výměra CZK/month
const ACCRUAL_RATE = 0.01495;        // 1.495% per year

// ─── Core pension formula (mirrors PensionEngine calcDB) ─────────────────────

interface PensionBreakdown {
  band: number;
  socialBase: number;
  socialPayment: number;
  // Reduction bands
  slice1: number; credited1: number;
  slice2: number; credited2: number;
  výpočtovýZáklad: number;
  // Pension at different career lengths
  pensions: { years: number; procentníVýměra: number; totalMonthly: number; replacementRate: number }[];
}

function computeOsvčBreakdown(band: number, socialBase: number, socialPayment: number): PensionBreakdown {
  // Band 1: base ≤ RT1, so slice2 may be zero if base ≤ RT1
  const slice1 = Math.min(socialBase, RT1);
  const credited1 = slice1 * 0.99;

  const slice2 = Math.max(0, Math.min(socialBase, RT2) - RT1);
  const credited2 = slice2 * 0.26;

  // No contribution above RT2 for these bands (both well below 195,868)
  const výpočtovýZáklad = credited1 + credited2;

  const careerLengths = [30, 35, 40, 43];   // common Czech career lengths
  const pensions = careerLengths.map(years => {
    const procentníVýměra = výpočtovýZáklad * years * ACCRUAL_RATE;
    const totalMonthly = BASE_PENSION + procentníVýměra;
    const replacementRate = (totalMonthly / socialBase) * 100; // RR vs the OSVČ assessment base
    return { years, procentníVýměra, totalMonthly, replacementRate };
  });

  return { band, socialBase, socialPayment, slice1, credited1, slice2, credited2, výpočtovýZáklad, pensions };
}

// ─── Cross-check against PensionEngine ───────────────────────────────────────

function engineCheck(socialBase: number, years: number): number {
  const result = PensionEngine.calculate(czechRepublic, socialBase, years, czechRepublic.defaults.retirementAge);
  return result.monthlyPension;
}

// ─── Employee reference (at average wage for comparison) ─────────────────────

function employeeReference(years: number): number {
  return engineCheck(AW, years);
}

// ─── Paušální záloha cross-check ─────────────────────────────────────────────
//   Band 1 total = daň (100) + social (6,578) + health (3,306) = 9,984 CZK/month
//   Band 2 total = daň (4,963) + social (8,191) + health (3,591) = 16,745 CZK/month

interface BandTotals { daň: number; social: number; health: number; total: number; }
const BAND_PAYMENTS: Record<1 | 2, BandTotals> = {
  1: { daň: 100,   social: BAND1_SOCIAL_PAYMENT, health: 3_306, total: 9_984 },
  2: { daň: 4_963, social: BAND2_SOCIAL_PAYMENT, health: 3_591, total: 16_745 },
};

function verifyPayments(): void {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Paušální záloha cross-check (2026)');
  console.log('═══════════════════════════════════════════════════════════════');
  for (const band of [1, 2] as const) {
    const p = BAND_PAYMENTS[band];
    const computed = p.daň + p.social + p.health;
    const ok = computed === p.total;
    console.log(`  Band ${band}: daň ${p.daň} + social ${p.social} + health ${p.health} = ${computed} CZK/mo  ${ok ? '✅ matches' : `❌ expect ${p.total}`}`);
  }
  console.log();
}

// ─── Print helpers ───────────────────────────────────────────────────────────

function row(label: string, got: number, ref: number | null = null): void {
  if (ref !== null) {
    const ok = Math.abs(got - ref) < 1;
    console.log(`  ${ok ? '✅' : '❌'}  ${label.padEnd(42)} ${got.toFixed(2).padStart(10)} CZK${ok ? '' : `  (expected ${ref})`}`);
  } else {
    console.log(`       ${label.padEnd(42)} ${got.toFixed(2).padStart(10)} CZK`);
  }
}

function printBreakdown(b: PensionBreakdown): void {
  const bandName = b.band === 1 ? 'Pásmo 1 (≤ 1 000 000 CZK/yr)' : 'Pásmo 2 (≤ 1 500 000 CZK/yr)';
  console.log(`\n${'─'.repeat(63)}`);
  console.log(`  OSVČ Paušální Daň — ${bandName}`);
  console.log(`${'─'.repeat(63)}`);

  // Assessment base
  console.log(`\n  Vyměřovací základ (měsíční / monthly assessment base)`);
  row('Pevný vyměřovací základ', b.socialBase);
  row('Sociální pojištění (29.2%)', b.socialPayment, BAND_PAYMENTS[b.band as 1 | 2].social);

  // Reduction calculation
  console.log(`\n  Redukce → výpočtový základ`);
  console.log(`       Threshold 1 = 21,546 CZK (44% of AW = 44% × ${AW})`);
  console.log(`       Threshold 2 = 195,868 CZK (4× AW)`);
  row(`Slice 1: min(${b.socialBase}, 21546) = ${b.slice1.toFixed(0)}  × 99%`, b.credited1);
  if (b.slice2 > 0) {
    row(`Slice 2: (${b.socialBase}−21546 = ${b.slice2.toFixed(0)})  × 26%`, b.credited2);
  } else {
    console.log(`       Slice 2: ${b.socialBase} ≤ 21,546 — base falls entirely in band 1  (0 CZK)`);
  }
  row('Výpočtový základ (credited base)', b.výpočtovýZáklad);

  // Pension results
  console.log(`\n  Odhadovaný měsíční důchod @ různých délkách kariéry`);
  console.log(`  ${'Délka kariéry'.padEnd(14)} ${'Procentní výměra'.padEnd(18)} ${'Základní'.padEnd(10)} ${'Celkem'.padEnd(10)} ${'RR vs base'.padEnd(10)}`);
  console.log(`  ${'─'.repeat(66)}`);
  for (const p of b.pensions) {
    const engineVal = engineCheck(b.socialBase, p.years);
    const ok = Math.abs(p.totalMonthly - engineVal) < 1;
    console.log(
      `  ${String(p.years + ' let').padEnd(14)} ` +
      `${p.procentníVýměra.toFixed(0).padStart(8)} CZK      ` +
      `${BASE_PENSION.toFixed(0).padStart(5)} CZK  ` +
      `${p.totalMonthly.toFixed(0).padStart(8)} CZK   ` +
      `${p.replacementRate.toFixed(1).padStart(5)}%` +
      `  ${ok ? '✅' : `❌ engine=${engineVal.toFixed(0)}`}`
    );
  }
}

// ─── Employee comparison ──────────────────────────────────────────────────────

function printEmployeeComparison(): void {
  console.log(`\n${'─'.repeat(63)}`);
  console.log(`  Zaměstnanec na průměrné mzdě (${AW.toLocaleString('cs-CZ')} CZK/měsíc)`);
  console.log(`${'─'.repeat(63)}`);
  console.log(`\n  Důchod zaměstnance @ různých délkách kariéry`);
  console.log(`  ${'Délka kariéry'.padEnd(14)} ${'Důchod'.padEnd(12)} ${'RR vs AW'}`);
  console.log(`  ${'─'.repeat(40)}`);

  for (const years of [30, 35, 40, 43]) {
    const pension = employeeReference(years);
    const rr = (pension / AW) * 100;
    console.log(`  ${String(years + ' let').padEnd(14)} ${pension.toFixed(0).padStart(8)} CZK   ${rr.toFixed(1)}%`);
  }
}

// ─── Band comparison summary ──────────────────────────────────────────────────

function printBandComparison(b1: PensionBreakdown, b2: PensionBreakdown): void {
  console.log(`\n${'═'.repeat(63)}`);
  console.log(`  SHRNUTÍ: OSVČ Pásmo 1 vs. Pásmo 2 vs. Zaměstnanec @ AW`);
  console.log(`  (40letá kariéra / 40-year career)`);
  console.log(`${'═'.repeat(63)}`);
  const YEARS = 40;
  const p1 = b1.pensions.find(p => p.years === YEARS)!;
  const p2 = b2.pensions.find(p => p.years === YEARS)!;
  const emp = employeeReference(YEARS);

  console.log(`\n  ${'Kategorie'.padEnd(28)} ${'Záloha/měsíc'.padEnd(14)} ${'Vym. základ'.padEnd(14)} ${'Výpočtový zákl.'.padEnd(18)} ${'Důchod 40 let'.padEnd(14)} RR`);
  console.log(`  ${'─'.repeat(104)}`);

  const line = (label: string, záloha: number, base: number, credited: number, pension: number) => {
    const rr = (pension / base * 100).toFixed(1) + '%';
    console.log(
      `  ${label.padEnd(28)} ` +
      `${záloha.toFixed(0).padStart(8)} CZK   ` +
      `${base.toFixed(0).padStart(8)} CZK   ` +
      `${credited.toFixed(0).padStart(10)} CZK   ` +
      `${pension.toFixed(0).padStart(8)} CZK   ${rr}`
    );
  };

  line('OSVČ Pásmo 1',      BAND_PAYMENTS[1].social, b1.socialBase, b1.výpočtovýZáklad, p1.totalMonthly);
  line('OSVČ Pásmo 2',      BAND_PAYMENTS[2].social, b2.socialBase, b2.výpočtovýZáklad, p2.totalMonthly);
  line('Zaměstnanec @ 1×AW', Math.round(AW * 0.065), AW,           engineCheck(AW, YEARS) - BASE_PENSION,
       emp); // note: 0%/26% split for employee at AW (also above RT1 but below RT2)

  console.log();
  console.log(`  ℹ️  Záloha zaměstnance = pouze důchodové pojištění (6.5% × ${AW} = ${Math.round(AW * 0.065).toLocaleString('cs-CZ')} CZK)`);
  console.log(`     Záloha OSVČ = celé sociální pojištění OSVČ (29.2% × vyměřovací základ)`);
  console.log(`     RR = replacement rate vs. vlastní vyměřovací základ`);
  console.log();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║  CZ OSVČ Paušální Daň — Pension Validator 2026               ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');
console.log(`  AW 2026 = ${AW.toLocaleString('cs-CZ')} CZK/month`);
console.log(`  Základní výměra = ${BASE_PENSION.toLocaleString('cs-CZ')} CZK/month`);
console.log(`  Accrual rate = ${(ACCRUAL_RATE * 100).toFixed(3)}% per year`);
console.log(`  RT1 = ${RT1.toLocaleString('cs-CZ')} CZK (44% × AW, credited @ 99%)`);
console.log(`  RT2 = ${RT2.toLocaleString('cs-CZ')} CZK (4× AW, credited @ 26%)\n`);

verifyPayments();

const band1 = computeOsvčBreakdown(1, BAND1_SOCIAL_BASE, BAND1_SOCIAL_PAYMENT);
const band2 = computeOsvčBreakdown(2, BAND2_SOCIAL_BASE, BAND2_SOCIAL_PAYMENT);

printBreakdown(band1);
printBreakdown(band2);
printEmployeeComparison();
printBandComparison(band1, band2);

console.log('═══════════════════════════════════════════════════════════════');
console.log('  All ✅ = formula matches PensionEngine calcDB exactly.');
console.log('═══════════════════════════════════════════════════════════════\n');
