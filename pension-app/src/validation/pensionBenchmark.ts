/**
 * Pension Benchmark Verification Script
 * Compares engine outputs with OECD / official published benchmarks.
 * Run: npx tsx src/validation/pensionBenchmark.ts
 */

import { germany } from '../data/germany';
import { austria } from '../data/austria';
import { czechRepublic } from '../data/czechRepublic';
import { poland } from '../data/poland';
import { slovakia } from '../data/slovakia';
import { PensionEngine } from '../engines/PensionEngine';

interface Benchmark {
  source: string;
  grossReplRate_pct: number; // OECD Pensions at a Glance 2023, mandatory gross RR at AW
  pillar1Only?: boolean;     // compare against pillar1Monthly only (when OECD figure excludes opt-in DC)
  note?: string;
}

const BENCHMARKS: Record<string, Benchmark> = {
  DE: {
    source: 'OECD PaG 2023, DE gross RR average earner (mandatory only)',
    grossReplRate_pct: 43.2,
    note: '42-45% quoted by DRV for 45yr career; 42yr career ≈ 40-42%',
  },
  AT: {
    source: 'OECD PaG 2023, AT gross RR average earner',
    grossReplRate_pct: 78.0,
    note: 'Austria infamous for high replacement; model uses no real valorisation (conservative)',
  },
  CZ: {
    source: 'OECD PaG 2023, CZ gross RR average earner',
    grossReplRate_pct: 45.6,
    note: 'ČSSZ/MPSV calculators also ~42-48% for average earner',
  },
  PL: {
    source: 'OECD PaG 2023, PL gross RR average earner (mandatory P1 only — OFE opt-in since 2014 excluded)',
    grossReplRate_pct: 38.4,
    pillar1Only: true,
    note: 'OECD figure is ZUS NDC (P1) only. Model P1 alone ≈42%; total incl. opt-in OFE Pillar 2 shown separately.',
  },
  SK: {
    source: 'OECD PaG 2023, SK gross RR average earner',
    grossReplRate_pct: 64.0,
    note: 'Includes POMB pillar 1 + DSS pillar 2 (Sociálna poisťovňa)',
  },
};

const LINE = '─'.repeat(98);
console.log('\n' + LINE);
console.log(' PENSION BENCHMARK VERIFICATION — engine vs OECD Pensions at a Glance 2023');
console.log(LINE + '\n');

const countries = [germany, austria, czechRepublic, poland, slovakia];

let anyFail = false;

for (const c of countries) {
  const aw = c.averageWage;
  const retAge = c.defaults.retirementAge;
  const startAge = c.defaults.careerStartAge;
  const years = retAge - startAge;

  const r = PensionEngine.calculate(c, aw, years, retAge);
  const bm = BENCHMARKS[c.code];
  // For countries where OECD figure excludes opt-in DC, compare P1 only
  const compareMonthly = bm.pillar1Only ? r.pillar1Monthly : r.monthlyPension;
  const modelRR = (compareMonthly / aw) * 100;
  const delta = modelRR - bm.grossReplRate_pct;

  // Allow ±12pp tolerance for structural differences (model is always-constant-real-wage, 
  // OECD uses stylised career with wage growth, no valorisation in our model, etc.)
  const TOLERANCE_PP = 12;
  const pass = Math.abs(delta) <= TOLERANCE_PP;
  if (!pass) anyFail = true;

  const monthly_eur = (r.monthlyPension / c.eurExchangeRate).toFixed(0);

  console.log(`${pass ? '✅ PASS' : '❌ FAIL'}  ${c.name} (${c.code}) — ${c.defaults.careerStartAge}→${retAge} (${years}yr) at AW`);
  console.log(`   AW: ${aw.toLocaleString()} ${c.currency}/mo | System: ${r.systemType}`);
  console.log(`   Monthly pension : ${r.monthlyPension.toFixed(0)} ${c.currency}/mo  (${monthly_eur} EUR equiv)`);
  if (r.pillar2Monthly != null && r.pillar2Monthly > 0) {
    console.log(`     Pillar 1      : ${(r.pillar1Monthly ?? 0).toFixed(0)} ${c.currency}/mo`);
    console.log(`     Pillar 2      : ${r.pillar2Monthly.toFixed(0)} ${c.currency}/mo`);
  }
  console.log(`   Model RR        : ${modelRR.toFixed(1)}%${bm.pillar1Only ? ' (Pillar 1 only)' : ''}`);
  console.log(`   OECD benchmark  : ${bm.grossReplRate_pct}%   (${bm.source})`);
  console.log(`   Delta           : ${delta > 0 ? '+' : ''}${delta.toFixed(1)}pp  → ${pass ? 'within ±12pp tolerance' : '⚠️  EXCEEDS ±12pp tolerance'}`);
  if (bm.note) console.log(`   Note            : ${bm.note}`);
  console.log('');
}

console.log(LINE);
console.log(anyFail ? '⚠️  One or more countries EXCEED tolerance — review parameters!' : '✅  All countries within benchmark tolerance.');
console.log(LINE + '\n');
