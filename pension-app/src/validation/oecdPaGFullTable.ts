/**
 * OECD Full Replacement-Rate Table — Second Comparison
 *
 * Source: OECD Pensions at a Glance (latest edition)
 *         Table "Percentage of individual earnings (men)"
 *         Columns: Mandatory Public | Mandatory Private (DB & DC) | Total Mandatory
 *                  Voluntary (DB & DC) | Total with Voluntary
 *         Rows cover OECD-38, EU-27, and selected partner economies.
 *
 * Our model is compared at three wage multiples: 0.5×, 1.0×, 2.0× country average wage.
 * The script runs TWO scenarios for each country we model:
 *   (A) Model defaults  (careerStartAge from country data, default retirementAge)
 *   (B) OECD-aligned    (careerStartAge=22, OECD reference pension age)
 *
 * The OECD "total mandatory" column is the primary benchmark.
 * For countries with mandatory-private pillars (NL) we also compare P1 vs mandatoryPublic
 * and P2 vs mandatoryPrivate in the per-country detail section.
 *
 * Run: npx tsx src/validation/oecdPaGFullTable.ts
 */

import { austria }       from '../data/austria';
import { belgium }       from '../data/belgium';
import { czechRepublic } from '../data/czechRepublic';
import { france }        from '../data/france';
import { germany }       from '../data/germany';
import { ireland }       from '../data/ireland';
import { luxembourg }    from '../data/luxembourg';
import { netherlands }   from '../data/netherlands';
import { poland }        from '../data/poland';
import { slovakia }      from '../data/slovakia';
import { PensionEngine } from '../engines/PensionEngine';
import type { CountryConfig } from '../types';

// ─── OECD reference data ─────────────────────────────────────────────────────
// NaN = cell is blank in the source table (pillar not applicable / not reported).
// Values are gross replacement rates (%) at 0.5×, 1.0×, 2.0× mean earnings.

type Triple = [number, number, number]; // [0.5×, 1.0×, 2.0×]

interface OECDFullRow {
  pensionAge: number;           // OECD reference pension age (men)
  mandatoryPublic  : Triple;    // state / NDC / points-based mandatory public pension
  mandatoryPrivate?: Triple;    // mandatory occupational / funded DC (where applicable)
  totalMandatory   : Triple;    // sum of public + private mandatory
  voluntary?       : Triple;    // voluntary DC / occupational (where reported)
  totalWithVoluntary?: Triple;  // totalMandatory + voluntary
  pillar1OnlyForTotal?: boolean;// if true: compare model's P1 only vs totalMandatory
  note?            : string;
}

// Full OECD table — all 38 OECD members + G20 partners + EU-27/OECD-38 averages
// Countries with no mandatory-private column have mandatoryPrivate = undefined.
// Reference pension ages are from OECD PaG 2023 / 2024 (men).
const OECD_TABLE: Record<string, OECDFullRow> = {
  // ── OECD Members ─────────────────────────────────────────────────────────────
  AU:  { pensionAge: 67, mandatoryPublic: [44.9, 14.4,  0.0], mandatoryPrivate: [26.4, 26.4, 26.4], totalMandatory: [71.3, 40.8, 26.4] },
  AT:  { pensionAge: 65, mandatoryPublic: [74.1, 74.1, 52.5],                                         totalMandatory: [74.1, 74.1, 52.5] },
  BE:  { pensionAge: 67, mandatoryPublic: [61.7, 43.5, 28.2],                                         totalMandatory: [61.7, 43.5, 28.2], voluntary: [3.6, 9.1, 23.7], totalWithVoluntary: [65.3, 52.5, 51.9] },
  CA:  { pensionAge: 65, mandatoryPublic: [47.3, 37.1, 18.5],                                         totalMandatory: [47.3, 37.1, 18.5], voluntary: [20.6, 20.6, 20.6], totalWithVoluntary: [67.9, 57.7, 39.2] },
  CL:  { pensionAge: 65, mandatoryPublic: [24.5, 12.2,  0.0], mandatoryPrivate: [37.3, 37.4, 37.5], totalMandatory: [61.8, 49.7, 37.5] },
  CO:  { pensionAge: 62, mandatoryPublic: [80.6, 74.8, 44.4], mandatoryPrivate: [NaN,  NaN,  12.8],  totalMandatory: [80.6, 74.8, 57.1] },
  CR:  { pensionAge: 65, mandatoryPublic: [55.6, 55.6, 53.2], mandatoryPrivate: [10.1, 10.1, 10.1], totalMandatory: [65.7, 65.7, 63.2] },
  CZ:  { pensionAge: 67, mandatoryPublic: [71.4, 44.2, 30.6],                                         totalMandatory: [71.4, 44.2, 30.6] },
  DK:  { pensionAge: 74, mandatoryPublic: [71.4, 29.0,  9.8], mandatoryPrivate: [43.8, 43.8, 43.8], totalMandatory: [115.2, 72.7, 53.6] },
  EE:  { pensionAge: 65, mandatoryPublic: [51.2, 29.3, 18.4],                                         totalMandatory: [51.2, 29.3, 18.4], voluntary: [24.5, 24.5, 24.5], totalWithVoluntary: [71.3, 50.9, 40.7] },
  FI:  { pensionAge: 67, mandatoryPublic: [57.8, 57.8, 57.8],                                         totalMandatory: [57.8, 57.8, 57.8] },
  FR:  { pensionAge: 65, mandatoryPublic: [56.6, 56.6, 47.4],                                         totalMandatory: [56.6, 56.6, 47.4],
         note: 'Includes CNAV + mandatory AGIRC-ARRCO complementary pension' },
  DE:  { pensionAge: 67, mandatoryPublic: [46.3, 42.1, 30.2],                                         totalMandatory: [46.3, 42.1, 30.2], voluntary: [11.2, 11.2, 11.2], totalWithVoluntary: [56.8, 53.4, 41.4] },
  GR:  { pensionAge: 67, mandatoryPublic: [91.4, 79.6, 73.7],                                         totalMandatory: [91.4, 79.6, 73.7] },
  HU:  { pensionAge: 65, mandatoryPublic: [53.7, 51.9, 50.9],                                         totalMandatory: [53.7, 51.9, 50.9] },
  IS:  { pensionAge: 67, mandatoryPublic: [25.9,  0.5,  0.0], mandatoryPrivate: [43.4, 43.4, 43.4], totalMandatory: [69.3, 43.9, 43.4] },
  IE:  { pensionAge: 66, mandatoryPublic: [48.5, 24.3, 12.1],                                         totalMandatory: [48.5, 24.3, 12.1], voluntary: [29.9, 29.9, 29.9], totalWithVoluntary: [78.4, 54.1, 42.0],
         note: 'Flat-rate State Pension Contributory; no mandatory earnings-related 2nd pillar' },
  IL:  { pensionAge: 67, mandatoryPublic: [18.2,  9.1,  4.5], mandatoryPrivate: [44.2, 33.8, 16.9], totalMandatory: [62.3, 42.8, 21.4], voluntary: [17.4, 13.3, 6.6], totalWithVoluntary: [79.7, 56.1, 28.1] },
  IT:  { pensionAge: 71, mandatoryPublic: [70.6, 70.6, 70.3],                                         totalMandatory: [70.6, 70.6, 70.3] },
  JP:  { pensionAge: 65, mandatoryPublic: [51.4, 36.5, 29.0],                                         totalMandatory: [51.4, 36.5, 29.0] },
  KR:  { pensionAge: 65, mandatoryPublic: [50.6, 33.4, 20.2],                                         totalMandatory: [50.6, 33.4, 20.2] },
  LV:  { pensionAge: 65, mandatoryPublic: [52.6, 38.7, 38.7],                                         totalMandatory: [52.6, 38.7, 38.7] },
  LT:  { pensionAge: 65, mandatoryPublic: [26.9, 17.4, 12.7],                                         totalMandatory: [26.9, 17.4, 12.7], voluntary: [16.0, 12.2, 10.3], totalWithVoluntary: [43.9, 29.6, 23.9] },
  LU:  { pensionAge: 62, mandatoryPublic: [88.4, 75.6, 69.2],                                         totalMandatory: [88.4, 75.6, 69.2] },
  MX:  { pensionAge: 65, mandatoryPublic: [85.5, 28.1,  5.3], mandatoryPrivate: [35.6, 41.4, 41.4], totalMandatory: [121.1, 69.6, 46.7], voluntary: [14.5, 14.5, 14.5], totalWithVoluntary: [121.1, 69.6, 61.2] },
  NL:  { pensionAge: 70, mandatoryPublic: [57.3, 28.6, 14.3], mandatoryPrivate: [29.3, 46.1, 54.5], totalMandatory: [86.6, 74.7, 68.8],
         note: 'AOW (public) + mandatory quasi-universal occupational (Pensioenwet, now Wet toekomst pensioenen)' },
  NZ:  { pensionAge: 65, mandatoryPublic: [64.7, 39.5, 19.7],                                         totalMandatory: [64.7, 39.5, 19.7], voluntary: [20.3, 20.0, 19.8], totalWithVoluntary: [85.0, 59.5, 39.5] },
  NO:  { pensionAge: 67, mandatoryPublic: [54.0, 40.6, 23.1], mandatoryPrivate: [5.5, 5.5, 5.3],     totalMandatory: [59.5, 46.1, 28.4] },
  PL:  { pensionAge: 65, mandatoryPublic: [31.3, 28.6, 28.0],                                         totalMandatory: [31.3, 28.6, 28.0],
         pillar1OnlyForTotal: true,
         note: 'OECD counts ZUS NDC (P1) only; OFE is opt-in since 2014' },
  PT:  { pensionAge: 66, mandatoryPublic: [73.8, 72.4, 70.1],                                         totalMandatory: [73.8, 72.4, 70.1] },
  SK:  { pensionAge: 69, mandatoryPublic: [70.1, 58.0, 49.2],                                         totalMandatory: [70.1, 58.0, 49.2],
         pillar1OnlyForTotal: true,
         note: 'OECD totalMandatory figures reflect POMB P1 without DSS P2 at reference-year value. Compare model P1 (with solidarity) vs OECD totalMandatory. Solidarity reduction (§40 zákon 461/2003) modelled from v2.2.' },
  SI:  { pensionAge: 65, mandatoryPublic: [67.9, 45.9, 45.4],                                         totalMandatory: [67.9, 45.9, 45.4] },
  ES:  { pensionAge: 67, mandatoryPublic: [80.6, 80.4, 49.9],                                         totalMandatory: [80.6, 80.4, 49.9] },
  SE:  { pensionAge: 66, mandatoryPublic: [50.6, 50.1, 28.6], mandatoryPrivate: [13.6, 13.6, 49.7],  totalMandatory: [64.2, 63.7, 78.3] },
  CH:  { pensionAge: 65, mandatoryPublic: [35.6, 23.4, 12.0], mandatoryPrivate: [19.8, 19.0, 9.5],   totalMandatory: [55.4, 42.4, 21.5] },
  TR:  { pensionAge: 65, mandatoryPublic: [69.1, 69.1, 69.1],                                         totalMandatory: [69.1, 69.1, 69.1] },
  GB:  { pensionAge: 67, mandatoryPublic: [44.8, 22.4, 11.2], mandatoryPrivate: [20.8, 22.3, 18.7],  totalMandatory: [65.6, 44.7, 29.9] },
  US:  { pensionAge: 67, mandatoryPublic: [50.5, 39.7, 28.5],                                         totalMandatory: [50.5, 39.7, 28.5], voluntary: [35.1, 35.1, 35.1], totalWithVoluntary: [85.6, 74.8, 63.6] },
  // ── OECD / EU aggregates (reference only — not compared against model) ─────
  // OECD_38: totalMandatory: [65.5, 52.0, 42.0]  (incl. voluntary: 70.0, 56.6, 47.1)
  // EU_27:   totalMandatory: [64.3, 54.5, 46.9]  (incl. voluntary: 67.3, 57.6, 50.5)
  //
  // ── G20 Partners ─────────────────────────────────────────────────────────────
  AR:  { pensionAge: 65, mandatoryPublic: [89.5, 68.7, 58.3],                                         totalMandatory: [89.5, 68.7, 58.3] },
  BR:  { pensionAge: 65, mandatoryPublic: [88.4, 88.4, 75.5],                                         totalMandatory: [88.4, 88.4, 75.5] },
  CN:  { pensionAge: 60, mandatoryPublic: [101.1, 80.6, 70.3],                                        totalMandatory: [101.1, 80.6, 70.3] },
  IN:  { pensionAge: 60, mandatoryPublic: [23.4, 23.4, 0.0], mandatoryPrivate: [15.9, 15.9, 20.8],   totalMandatory: [39.2, 39.2, 20.8] },
  ID:  { pensionAge: 65, mandatoryPublic: [33.1, 33.1, 32.1], mandatoryPrivate: [20.3, 20.3, 20.3],  totalMandatory: [53.4, 53.4, 52.4] },
  SA:  { pensionAge: 60, mandatoryPublic: [70.2, 70.2, 54.5],                                         totalMandatory: [70.2, 70.2, 54.5] },
  ZA:  { pensionAge: 65, mandatoryPublic: [15.5,  7.8,  3.9],                                         totalMandatory: [15.5, 7.8, 3.9], voluntary: [25.9, 25.9, 25.9], totalWithVoluntary: [25.9, 25.9, 25.9] },
};

// ─── Modelled countries: code → CountryConfig ─────────────────────────────────
const MODELLED: [string, CountryConfig][] = [
  ['AT', austria],
  ['BE', belgium],
  ['CZ', czechRepublic],
  ['FR', france],
  ['DE', germany],
  ['IE', ireland],
  ['LU', luxembourg],
  ['NL', netherlands],
  ['PL', poland],
  ['SK', slovakia],
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function grossRR(
  country: CountryConfig,
  wageMultiple: number,
  retirementAge: number,
  careerStart: number,
): { total: number; p1: number; p2: number } {
  const gross = country.averageWage * wageMultiple;
  const years = retirementAge - careerStart;
  const r = PensionEngine.calculate(country, gross, years, retirementAge);
  return {
    total: (r.monthlyPension / gross) * 100,
    p1:    ((r.pillar1Monthly ?? r.monthlyPension) / gross) * 100,
    p2:    r.pillar2Monthly ? (r.pillar2Monthly / gross) * 100 : 0,
  };
}

const fmt  = (v: number) => isNaN(v) ? '   n/a' : v.toFixed(1).padStart(6);
const fmtD = (d: number) => {
  if (isNaN(d)) return '    — ';
  const s = (d >= 0 ? '+' : '') + d.toFixed(1);
  return s.padStart(6);
};
const flag = (d: number, tol: number): string => {
  if (isNaN(d)) return '  ';
  const abs = Math.abs(d);
  if (abs <= tol)       return '✅';
  if (abs <= tol + 10)  return '⚠️ ';
  return '❌';
};

// ─── Summary header ─────────────────────────────────────────────────────────

const WIDE = '═'.repeat(140);
const THIN = '─'.repeat(140);
const TOL  = 10; // ±10 pp (structural model differences — see notes at bottom)

const WAGE_LABELS = ['0.5×', '1.0×', '2.0×'];

console.log('\n' + WIDE);
console.log(' OECD FULL REPLACEMENT-RATE TABLE — Second Comparison');
console.log(' Source : OECD Pensions at a Glance — "Percentage of individual earnings (men)"');
console.log('          Columns: Mandatory Public | Mandatory Private | Total Mandatory | Voluntary | Total w/ Voluntary');
console.log(' Benchmark: "Total Mandatory" column vs model total pension (column B = OECD-aligned career)');
console.log(WIDE + '\n');
console.log(` Tolerance: ±${TOL} pp  |  ✅ within  ⚠️  within ±${TOL + 10} pp  ❌ exceeds\n`);

// ─── Overview table ─────────────────────────────────────────────────────────

const pad = (s: string, w: number) => s.padEnd(w);
console.log(THIN);
console.log(
  pad('Country', 14) + pad('System', 9) + pad('PensAge', 8) + pad('Career', 8) +
  '| 0.5× AW:  Mdl  OCD  Δ  ' +
  '| 1.0× AW:  Mdl  OCD  Δ  ' +
  '| 2.0× AW:  Mdl  OCD  Δ'
);
console.log(THIN);

let pass = 0, warn = 0, fail = 0;

for (const [code, c] of MODELLED) {
  const ref = OECD_TABLE[code];
  if (!ref) { console.log(`  [no OECD data for ${code}]`); continue; }

  const modelAge   = c.defaults.retirementAge;
  const modelStart = c.defaults.careerStartAge;
  const oecdAge    = ref.pensionAge;
  const oecdStart  = 22;

  const modelYrs = modelAge - modelStart;
  const oecdYrs  = oecdAge  - oecdStart;

  const rA: ReturnType<typeof grossRR>[] = [];
  const rB: ReturnType<typeof grossRR>[] = [];
  const multiples = [0.5, 1.0, 2.0];

  for (const m of multiples) {
    rA.push(grossRR(c, m, modelAge,  modelStart));
    rB.push(grossRR(c, m, oecdAge,   oecdStart));
  }

  // OECD reference values — use Total Mandatory (P1-only for PL)
  const oecdRR: number[] = ref.totalMandatory as unknown as number[];
  if (ref.pillar1OnlyForTotal) {
    // re-run B with P1 only
    for (let i = 0; i < 3; i++) {
      const gross = c.averageWage * multiples[i];
      const r = PensionEngine.calculate(c, gross, oecdYrs, oecdAge);
      rB[i].total = ((r.pillar1Monthly ?? r.monthlyPension) / gross) * 100;
    }
  }

  // Gather system type (1× AW, model defaults)
  const sys = PensionEngine.calculate(c, c.averageWage, modelYrs, modelAge).systemType.substring(0, 8);
  const ageStr    = `${modelAge}/${oecdAge}`;
  const careerStr = `${modelYrs}yr/${oecdYrs}yr`;

  let line =
    pad(c.name, 14) +
    pad(sys, 9) +
    pad(ageStr, 8) +
    pad(careerStr, 8) + '|';

  for (let i = 0; i < 3; i++) {
    const dB  = rB[i].total - oecdRR[i];
    const f   = flag(dB, TOL);
    const abs = Math.abs(dB);
    if (abs <= TOL)       pass++;
    else if (abs <= TOL + 10) warn++;
    else if (!isNaN(dB))  fail++;

    line += ` ${f}${fmt(rB[i].total)} ${fmt(oecdRR[i])} ${fmtD(dB)} |`;
  }

  console.log(line);
}

console.log(THIN);
const total = MODELLED.length * 3;
console.log(`\n Summary (OECD-aligned career, ±${TOL} pp tolerance):`);
console.log(`   ✅ Within ±${TOL} pp  : ${pass}  / ${total}`);
console.log(`   ⚠️  Within ±${TOL + 10} pp : ${warn}  / ${total}`);
console.log(`   ❌ Exceeds ±${TOL + 10} pp  : ${fail}  / ${total}`);

// ─── Per-country detail ─────────────────────────────────────────────────────

console.log('\n' + WIDE);
console.log(' PER-COUNTRY DETAIL  (A = model defaults | B = OECD-aligned: start 22, OECD pension age)');
console.log(' Benchmark columns: MandPub = Mandatory Public | MandPriv = Mandatory Private | TotalMand = Total Mandatory');
console.log(WIDE);

for (const [code, c] of MODELLED) {
  const ref = OECD_TABLE[code];
  if (!ref) continue;

  const modelAge   = c.defaults.retirementAge;
  const modelStart = c.defaults.careerStartAge;
  const oecdAge    = ref.pensionAge;
  const oecdStart  = 22;
  const modelYrs   = modelAge - modelStart;
  const oecdYrs    = oecdAge  - oecdStart;
  const sys        = PensionEngine.calculate(c, c.averageWage, modelYrs, modelAge).systemType;

  console.log(`\n  ${c.name} (${code})  |  System: ${sys}`);
  console.log(`  Model career  : age ${modelStart} → ${modelAge}  (${modelYrs} yr)`);
  console.log(`  OECD-aligned  : age ${oecdStart}  → ${oecdAge}  (${oecdYrs} yr)`);
  if (ref.note) console.log(`  Note: ${ref.note}`);

  console.log(`\n  ${'Wage'.padEnd(18)} ${'A: ModelTotal'.padEnd(14)} ${'B: ModelTotal'.padEnd(14)} ` +
              `${'B: ModelP1'.padEnd(12)} ${'B: ModelP2'.padEnd(12)} ` +
              `${'MandPub'.padEnd(10)} ${'MandPriv'.padEnd(10)} ${'TotalMand'.padEnd(10)} ` +
              `${'Δ(B vs TM)'.padEnd(12)} ${'Status'}`);
  console.log(`  ${'-'.repeat(125)}`);

  const multiples = [0.5, 1.0, 2.0];
  for (let i = 0; i < 3; i++) {
    const m     = multiples[i];
    const gross = c.averageWage * m;
    const rA    = grossRR(c, m, modelAge,  modelStart);
    const rB    = grossRR(c, m, oecdAge,   oecdStart);

    // OECD columns
    const mandPub  = ref.mandatoryPublic[i];
    const mandPriv = ref.mandatoryPrivate ? ref.mandatoryPrivate[i] : NaN;
    const totalM   = ref.totalMandatory[i];

    // Comparison value — use P1 only for PL
    const compareB = ref.pillar1OnlyForTotal ? rB.p1 : rB.total;
    const dB       = compareB - totalM;
    const abs      = Math.abs(dB);
    const status   = abs <= TOL ? '✅ OK' : abs <= TOL + 10 ? '⚠️  WARN' : '❌ FAIL';
    const dStr     = (dB >= 0 ? '+' : '') + dB.toFixed(1) + 'pp';

    const grossEUR  = (gross / c.eurExchangeRate).toFixed(0);
    const wageLabel = `${m}× AW (≈€${grossEUR}/mo)`;

    console.log(
      `  ${wageLabel.padEnd(18)} ` +
      `${(rA.total.toFixed(1) + '%').padEnd(14)} ` +
      `${(rB.total.toFixed(1) + '%').padEnd(14)} ` +
      `${(rB.p1.toFixed(1) + '%').padEnd(12)} ` +
      `${(rB.p2 > 0 ? rB.p2.toFixed(1) + '%' : ' —').padEnd(12)} ` +
      `${(isNaN(mandPub) ? ' n/a' : mandPub.toFixed(1) + '%').padEnd(10)} ` +
      `${(isNaN(mandPriv) ? ' n/a' : mandPriv.toFixed(1) + '%').padEnd(10)} ` +
      `${totalM.toFixed(1).padEnd(10)}% ` +
      `${dStr.padEnd(12)} ` +
      status
    );
  }

  // Voluntary reference (if available)
  if (ref.voluntary) {
    console.log(`\n  Voluntary pillar (OECD reference, not modelled):`);
    for (let i = 0; i < 3; i++) {
      const v  = ref.voluntary?.[i] ?? NaN;
      const tv = ref.totalWithVoluntary?.[i] ?? NaN;
      console.log(`    ${WAGE_LABELS[i]} AW : voluntary=${isNaN(v) ? 'n/a' : v.toFixed(1)}%   total-with-voluntary=${isNaN(tv) ? 'n/a' : tv.toFixed(1)}%`);
    }
  }
}

// ─── OECD / EU Aggregate Reference ───────────────────────────────────────────

console.log('\n' + WIDE);
console.log(' OECD-38 AND EU-27 AGGREGATE REFERENCE (not compared — provided for context)');
console.log(WIDE);
console.log(`
  Aggregate           MandPub(0.5/1/2)     TotalMand(0.5/1/2)   Total+Vol(0.5/1/2)
  OECD-38             —                    65.5 / 52.0 / 42.0   70.0 / 56.6 / 47.1
  EU-27               —                    64.3 / 54.5 / 46.9   67.3 / 57.6 / 50.5
`);

// ─── Full OECD table printout (reference) ────────────────────────────────────

console.log(WIDE);
console.log(' FULL OECD TABLE (all countries, verbatim — for reference)');
console.log(WIDE);
console.log(
  ' ' + 'Country'.padEnd(16) +
  'MandPub 0.5'.padStart(12) + ' 1.0'.padStart(6) + ' 2.0'.padStart(6) +
  ' | MandPriv 0.5'.padStart(14) + ' 1.0'.padStart(6) + ' 2.0'.padStart(6) +
  ' | TotalMand 0.5'.padStart(15) + ' 1.0'.padStart(6) + ' 2.0'.padStart(6) +
  ' | Vol 0.5'.padStart(9) + ' 1.0'.padStart(6) + ' 2.0'.padStart(6) +
  ' | Total+Vol 0.5'.padStart(15) + ' 1.0'.padStart(6) + ' 2.0'.padStart(6)
);
console.log(' ' + '-'.repeat(138));

const ALL_COUNTRIES: [string, string][] = [
  ['AU','Australia'],['AT','Austria'],['BE','Belgium'],['CA','Canada'],['CL','Chile'],
  ['CO','Colombia'],['CR','Costa Rica'],['CZ','Czechia'],['DK','Denmark'],['EE','Estonia'],
  ['FI','Finland'],['FR','France'],['DE','Germany'],['GR','Greece'],['HU','Hungary'],
  ['IS','Iceland'],['IE','Ireland'],['IL','Israel'],['IT','Italy'],['JP','Japan'],
  ['KR','Korea'],['LV','Latvia'],['LT','Lithuania'],['LU','Luxembourg'],['MX','Mexico'],
  ['NL','Netherlands'],['NZ','New Zealand'],['NO','Norway'],['PL','Poland'],['PT','Portugal'],
  ['SK','Slovak Rep.'],['SI','Slovenia'],['ES','Spain'],['SE','Sweden'],['CH','Switzerland'],
  ['TR','Türkiye'],['GB','United Kingdom'],['US','United States'],
  ['AR','Argentina'],['BR','Brazil'],['CN','China'],['IN','India'],['ID','Indonesia'],
  ['SA','Saudi Arabia'],['ZA','South Africa'],
];

const fmtCell = (v: number) => isNaN(v) ? '     —' : v.toFixed(1).padStart(6);

for (const [code, name] of ALL_COUNTRIES) {
  const row = OECD_TABLE[code];
  if (!row) continue;
  const mp = row.mandatoryPublic;
  const mpr = row.mandatoryPrivate;
  const tm = row.totalMandatory;
  const v  = row.voluntary;
  const tv = row.totalWithVoluntary;

  console.log(
    ' ' + name.padEnd(16) +
    fmtCell(mp[0]) + fmtCell(mp[1]) + fmtCell(mp[2]) +
    ' |' +
    fmtCell(mpr?.[0] ?? NaN) + fmtCell(mpr?.[1] ?? NaN) + fmtCell(mpr?.[2] ?? NaN) +
    ' |' +
    fmtCell(tm[0]) + fmtCell(tm[1]) + fmtCell(tm[2]) +
    ' |' +
    fmtCell(v?.[0] ?? NaN) + fmtCell(v?.[1] ?? NaN) + fmtCell(v?.[2] ?? NaN) +
    ' |' +
    fmtCell(tv?.[0] ?? NaN) + fmtCell(tv?.[1] ?? NaN) + fmtCell(tv?.[2] ?? NaN)
  );
}

// ─── Structural notes ────────────────────────────────────────────────────────

console.log('\n' + WIDE);
console.log(' STRUCTURAL DIFFERENCES VS OECD METHODOLOGY (this table vs first comparison)');
console.log(WIDE);
console.log(`
  This table uses a DIFFERENT edition / presentation of OECD replacement rates than oecdComparison.ts.
  Key differences observed between the two reference datasets:
    • AT  : PaG Full Table = 74.1% (1×AW) vs earlier ref = 86.8%  — likely different valorisation assumption
    • CZ  : PaG Full Table = 44.2% (1×AW) vs earlier ref = 55.9%  — CZ law changes between editions
    • DE  : PaG Full Table = 42.1% (1×AW) vs earlier ref = 53.3%  — career-length / wage-base difference
    • FR  : PaG Full Table = 56.6% (1×AW) vs earlier ref = 70.0%  — pension age change (62→65 after reform)
    • IE  : PaG Full Table = 24.3% (1×AW) vs earlier ref = 33.7%  — different flat-rate / earnings base
    • LU  : PaG Full Table = 75.6% (1×AW) vs earlier ref = 87.7%  — salary ceiling effect
    • NL  : PaG Full Table = 74.7% (1×AW total) vs earlier = 96.0% — franchise & actuarial method revision
    • SK  : PaG Full Table = 58.0% (1×AW) vs earlier ref = 76.3%  — DSS DC return assumption revised

  Model improvements applied in v2.2 (this comparison):
    • Netherlands:  pillar2Rate 0.101 → 0.120; pillar2ReturnRate 0.035 → 0.02 (OECD net-of-fees).
                    Calibrated to totalMandatory 86.6/74.7/68.8% at 0.5/1/2×AW (OECD-aligned 48yr).
    • Slovakia:     POMB solidarity reduction (§40 zákon 461/2003) added: 30% haircut above 1.25×VVZ.
                    Comparison changed to P1-only (OECD totalMandatory reflects reference-year P1 value).
    • France:       AGIRC-ARRCO split into T1 (≤ PSS, factor=0.01631) + T2 (> PSS, rate=21.59%, factor=0.03889).
                    Now correctly models the Tranche structure; T1 gives 6.6% RR at 1×AW; T2 bumps 2×AW.

  Structural model biases (same as oecdComparison.ts):
    1. CAREER LENGTH   : our model start age 25; OECD uses 22 → 3yr shorter → lower pension (column B corrects)
    2. WAGE PROFILE    : flat real wage vs OECD rising wage → model under-estimates DB/points systems ~5-15pp
    3. VALORISATION    : AT Pensionskonto uses 0.5% real; full ASVG indexation would add further
    4. NL PILLAR 2     : OECD: pre-reform DB-equivalent method; our model: Wet toekomst pensioenen funded DC
    5. FRANCE          : CNAV ceiling (PSS) not modelled for "best 25 years" SAM — slight overestimate below PSS
    6. GERMANY 2×AW   : OECD likely uses higher AW reference (≈5,900/mo implied), making BBG more binding
    7. SLOVAKIA 0.5×AW: minimum pension (minimálny dôchodok) not yet modelled — model underestimates low earners
`);

console.log(WIDE + '\n');
