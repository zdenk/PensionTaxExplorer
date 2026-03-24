/**
 * scripts/euromod/lib.ts
 *
 * Shared utilities for EUROMOD ↔ app diff scripts.
 */

import * as path from 'path';
import * as XLSX from 'xlsx';

export const XLSX_PATH = path.resolve(
  __dirname,
  '../../../EUROMOD/Documentation/EUROMOD policy parameters J2.0+.xlsx',
);

// ─── Value parsing ─────────────────────────────────────────────────────────────

export type ValueUnit = 'rate' | 'monthly' | 'annual' | 'unknown';

export function parseEMValue(raw: string | undefined): { value: number; unit: ValueUnit } {
  if (!raw || raw === 'n/a') return { value: NaN, unit: 'unknown' };
  const s = raw.trim();
  if (s.endsWith('#y')) return { value: parseFloat(s), unit: 'annual' };
  if (s.endsWith('#m')) return { value: parseFloat(s), unit: 'monthly' };
  const n = parseFloat(s);
  return { value: n, unit: isNaN(n) ? 'unknown' : 'rate' };
}

/** Convert raw EM parameter to monthly value (annual ÷ 12; monthly as-is; rates as-is). */
export function toMonthly(raw: string | undefined): number {
  const { value, unit } = parseEMValue(raw);
  if (isNaN(value)) return NaN;
  return unit === 'annual' ? value / 12 : value;
}

/** Return raw numeric value without unit conversion. */
export function toNumber(raw: string | undefined): number {
  return parseEMValue(raw).value;
}

// ─── Excel loading ──────────────────────────────────────────────────────────────

export interface EuromodRow { policy: string; paramName: string; description: string; values: Record<number, string>; }

let _workbook: XLSX.WorkBook | null = null;
function getWorkbook(): XLSX.WorkBook {
  if (!_workbook) _workbook = XLSX.readFile(XLSX_PATH);
  return _workbook;
}

function parseSheet(wb: XLSX.WorkBook, sheetName: string): EuromodRow[] {
  const sh = wb.Sheets[sheetName];
  if (!sh) throw new Error(`Sheet "${sheetName}" not found in EUROMOD Excel`);
  const raw = XLSX.utils.sheet_to_json<(string | number)[]>(sh, { header: 1 });
  const hdr = raw[0] as string[];
  const yearCols: Record<number, number> = {};
  hdr.forEach((h, i) => {
    const m = String(h).match(/^y(\d{4})$/);
    if (m) yearCols[parseInt(m[1])] = i;
  });
  return raw.slice(1).filter(r => r[1] && r[2]).map(r => {
    const values: Record<number, string> = {};
    for (const [yr, col] of Object.entries(yearCols)) {
      const v = r[col];
      if (v !== undefined && v !== null) values[parseInt(yr)] = String(v);
    }
    return { policy: String(r[1]), paramName: String(r[2]), description: String(r[3] ?? ''), values };
  });
}

/** Load rows for a country sheet. Pass a pre-loaded WorkBook to avoid re-reading the file. */
export function loadEuromodSheet(cc: string): EuromodRow[];
export function loadEuromodSheet(wb: XLSX.WorkBook, cc: string): EuromodRow[];
export function loadEuromodSheet(arg0: string | XLSX.WorkBook, arg1?: string): EuromodRow[] {
  if (typeof arg0 === 'string') return parseSheet(getWorkbook(), arg0);
  return parseSheet(arg0, arg1!);
}

export function lookupParam(
  rows: EuromodRow[],
  paramName: string,
  maxYear = 2025,
): { raw: string; year: number } | null {
  const row = rows.find(r => r.paramName === paramName);
  if (!row) return null;
  for (let y = maxYear; y >= 2005; y--) {
    const v = row.values[y];
    if (v && v !== 'n/a') return { raw: v, year: y };
  }
  return null;
}

// ─── Diff types & classification ──────────────────────────────────────────────

export type DiffStatus = 'MATCH' | 'CHANGED' | 'YEAR_GAP' | 'MISSING_EM';

export interface DiffResult {
  section: string; label: string; emParam: string; emYear: number;
  emValue: number; appValue: number; displayUnit: string;
  delta: number; deltaPct: number | null; status: DiffStatus; note: string;
}

export function classify(
  emValue: number,
  appValue: number,
  emYear: number,
  appYear: number,
  tolerance = 0.005,
  /** Max % gap attributable to a 1-year legislative lag. Differences beyond this are flagged CHANGED even if emYear < appYear. */
  maxYearGapPct = 0.15,
): DiffStatus {
  if (isNaN(emValue)) return 'MISSING_EM';
  const pct = appValue !== 0 ? Math.abs(emValue - appValue) / Math.abs(appValue) : Math.abs(emValue - appValue);
  if (pct <= tolerance) return 'MATCH';
  // Year-gap: EUROMOD is behind the app, and the difference is within what annual
  // indexation / legislation can shift in one year (≤ maxYearGapPct).
  if (emYear < appYear && pct <= maxYearGapPct) return 'YEAR_GAP';
  return 'CHANGED';
}

// ─── Check builder ────────────────────────────────────────────────────────────

export interface CheckOpts {
  section: string;
  label: string;
  emParam: string;
  appValue: number;
  emTransform?: (raw: string) => number;
  displayUnit: string;
  tolerance?: number;
  note?: string;
}

export function buildCheck(
  rows: EuromodRow[],
  appYear: number,
  opts: CheckOpts,
): DiffResult {
  const found = lookupParam(rows, opts.emParam, 2025);
  if (!found) {
    return {
      section: opts.section, label: opts.label, emParam: opts.emParam,
      emYear: 0, emValue: NaN, appValue: opts.appValue,
      displayUnit: opts.displayUnit, delta: NaN, deltaPct: null,
      status: 'MISSING_EM', note: opts.note ?? 'Parameter not found in EUROMOD Excel',
    };
  }
  const emValue = opts.emTransform ? opts.emTransform(found.raw) : toNumber(found.raw);
  const delta = emValue - opts.appValue;
  const deltaPct = (opts.appValue === 0 || isNaN(opts.appValue) || isNaN(emValue))
    ? null
    : (delta / Math.abs(opts.appValue)) * 100;
  const status = classify(emValue, opts.appValue, found.year, appYear, opts.tolerance ?? 0.005);
  return {
    section: opts.section, label: opts.label, emParam: opts.emParam,
    emYear: found.year, emValue, appValue: opts.appValue,
    displayUnit: opts.displayUnit, delta, deltaPct, status,
    note: opts.note ?? '',
  };
}

// ─── Report printer ───────────────────────────────────────────────────────────

const STATUS_ICON: Record<DiffStatus, string> = {
  MATCH: '✅', CHANGED: '❌', YEAR_GAP: '🕐', MISSING_EM: '⬜',
};

export function fmtValue(v: number, unit: string): string {
  if (isNaN(v)) return 'n/a';
  if (unit === '%') return `${(v * 100).toFixed(2)}%`;
  return `${Math.round(v).toLocaleString()}`;
}

export function printReport(results: DiffResult[], countryCode: string, appYear: number): void {
  const isJson = process.argv.includes('--json');
  if (isJson) { console.log(JSON.stringify(results, null, 2)); return; }

  console.log('\n' + '═'.repeat(96));
  console.log(`  EUROMOD J2.0+ ↔ App  —  ${countryCode} diff   (EUROMOD year: up to 2025 | App year: ${appYear})`);
  console.log('═'.repeat(96));
  console.log(' St  ' + 'Section          '.padEnd(18) + 'Parameter                         '.padEnd(35) + 'EUROMOD(yr)    '.padEnd(16) + 'App            '.padEnd(16) + 'Δ%');
  console.log('─'.repeat(96));

  let currentSection = '';
  for (const r of results) {
    if (r.section !== currentSection) { if (currentSection) console.log(''); currentSection = r.section; }
    const emDisplay = isNaN(r.emValue) ? 'n/a'.padEnd(14) : `${fmtValue(r.emValue, r.displayUnit)} (${r.emYear})`.padEnd(14);
    const appDisplay = fmtValue(r.appValue, r.displayUnit).padEnd(14);
    const deltaDisplay = r.deltaPct !== null ? `${r.deltaPct > 0 ? '+' : ''}${r.deltaPct.toFixed(1)}%` : '';
    console.log(` ${STATUS_ICON[r.status]}  ` + r.section.padEnd(18) + r.label.padEnd(35) + emDisplay + ' ' + appDisplay + ' ' + deltaDisplay);
    if (r.note && (r.status === 'CHANGED' || r.status === 'YEAR_GAP')) {
      console.log('          ↳ ' + r.note);
    }
  }

  console.log('\n' + '─'.repeat(96));
  console.log(' Legend:  ✅ MATCH   ❌ CHANGED (action required)   🕐 YEAR_GAP (expected)   ⬜ NOT IN EUROMOD');
  console.log('─'.repeat(96));

  const changed = results.filter(r => r.status === 'CHANGED');
  const yearGap = results.filter(r => r.status === 'YEAR_GAP');
  const missing = results.filter(r => r.status === 'MISSING_EM');
  const matched = results.filter(r => r.status === 'MATCH');
  console.log(`\n Summary: ${matched.length} match  |  ${changed.length} changed  |  ${yearGap.length} year-gap  |  ${missing.length} not in EUROMOD`);

  if (changed.length > 0) {
    console.log('\n ❌ ACTION REQUIRED:');
    for (const r of changed) {
      console.log(`    • ${r.section} → ${r.label}`);
      console.log(`      EUROMOD (${r.emYear}): ${fmtValue(r.emValue, r.displayUnit)}  vs  App (${appYear}): ${fmtValue(r.appValue, r.displayUnit)}  [Δ ${r.deltaPct != null ? r.deltaPct.toFixed(1) : 'n/a'}%]`);
      if (r.note) console.log(`      ${r.note}`);
    }
  }

  if (yearGap.length > 0) {
    console.log('\n 🕐 YEAR GAP (verify on next EUROMOD release):');
    for (const r of yearGap) {
      console.log(`    • ${r.section} → ${r.label}  [EUROMOD ${r.emYear}: ${fmtValue(r.emValue, r.displayUnit)}  vs  App ${appYear}: ${fmtValue(r.appValue, r.displayUnit)}]`);
    }
  }

  console.log('');
}

// ─── Combined cross-country summary ──────────────────────────────────────────

export function printCombinedSummary(allResults: Record<string, DiffResult[]>): void {
  console.log('\n' + '═'.repeat(72));
  console.log('  COMBINED SUMMARY');
  console.log('═'.repeat(72));
  console.log(
    ' CC  ' +
    'Match  '.padEnd(8) +
    'Changed '.padEnd(10) +
    'Year-gap '.padEnd(11) +
    'Missing '.padEnd(10) +
    'Status'
  );
  console.log('─'.repeat(72));

  let totalMatch = 0, totalChanged = 0, totalYearGap = 0, totalMissing = 0;

  for (const [cc, results] of Object.entries(allResults)) {
    const matched  = results.filter(r => r.status === 'MATCH').length;
    const changed  = results.filter(r => r.status === 'CHANGED').length;
    const yearGap  = results.filter(r => r.status === 'YEAR_GAP').length;
    const missing  = results.filter(r => r.status === 'MISSING_EM').length;
    totalMatch += matched; totalChanged += changed;
    totalYearGap += yearGap; totalMissing += missing;

    const icon = changed > 0 ? '❌' : '✅';
    console.log(
      ` ${cc}  ` +
      String(matched).padEnd(8) +
      String(changed).padEnd(10) +
      String(yearGap).padEnd(11) +
      String(missing).padEnd(10) +
      icon + (changed > 0 ? ` ${changed} params need update` : ' Clean')
    );
    for (const r of results.filter(r => r.status === 'CHANGED')) {
      console.log(`        ↳ ❌ ${r.section} → ${r.label}`);
    }
  }

  console.log('\n' + '─'.repeat(72));
  console.log(` TOTAL  Match:${totalMatch}  Changed:${totalChanged}  YearGap:${totalYearGap}  Missing:${totalMissing}`);

  if (totalChanged > 0) {
    console.log(`\n ❌ ${totalChanged} parameter(s) across all countries require manual review in the app TS files.\n`);
  } else {
    console.log('\n ✅ All countries clean — no action required.\n');
  }
}
