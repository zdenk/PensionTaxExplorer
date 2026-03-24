/**
 * scripts/euromod/diffAll.ts  (v2)
 *
 * Single-process orchestrator — no subprocess spawning.
 * Reads the EUROMOD Excel once, runs all country diffs in-process, prints
 * per-country reports, optionally writes patch files, then prints a combined summary.
 *
 * Usage:
 *   npm run diff:all                     — all countries
 *   npm run diff:all:patch               — all countries + write patches/ files
 *   npm run diff:country -- DE           — single country
 *   npm run diff:country -- DE --patch   — single country with patch
 */

import * as XLSX from 'xlsx';
import * as path from 'path';
import {
  loadEuromodSheet, printReport, printCombinedSummary,
  XLSX_PATH, DiffResult,
} from './lib';
import { PARAM_REGISTRY } from './parameterMap';
import { runCountryDiff } from './runner';
import { generatePatch, writePatch } from './generatePatch';
import { COUNTRY_MAP } from '../../src/data/countryRegistry';

const PATCHES_DIR = path.join(__dirname, '../../patches');

// ── CLI flags ─────────────────────────────────────────────────────────────────

const PATCH_FLAG  = process.argv.includes('--patch');
const SINGLE_CC   = (() => {
  const idx = process.argv.indexOf('--country');
  return idx !== -1 ? (process.argv[idx + 1] ?? '').toUpperCase() || null : null;
})();

// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  // Read the XLSX file once and share the workbook across all countries
  const wb = XLSX.readFile(XLSX_PATH);

  const countries = Object.keys(PARAM_REGISTRY).filter(
    cc => !SINGLE_CC || cc === SINGLE_CC,
  );

  if (countries.length === 0) {
    console.error(`[ERROR] Country "${SINGLE_CC}" not found in PARAM_REGISTRY.`);
    console.error(`Available: ${Object.keys(PARAM_REGISTRY).join(', ')}`);
    process.exit(1);
  }

  console.log('\n' + '█'.repeat(96));
  console.log('  EUROMOD DIFF — ALL COUNTRIES');
  console.log('█'.repeat(96) + '\n');

  const allResults: Record<string, DiffResult[]> = {};

  for (const cc of countries) {
    const config = COUNTRY_MAP[cc];
    if (!config) {
      console.warn(`[SKIP] ${cc} — not found in COUNTRY_MAP (countryRegistry.ts)`);
      continue;
    }

    let rows;
    try {
      rows = loadEuromodSheet(wb, cc);
    } catch (e) {
      console.warn(`[SKIP] ${cc} — sheet not found in EUROMOD Excel: ${(e as Error).message}`);
      continue;
    }

    const results = runCountryDiff(cc, config, rows, config.dataYear);
    allResults[cc] = results;
    printReport(results, cc, config.dataYear);

    if (PATCH_FLAG) {
      const patch = generatePatch(cc, results, config);
      if (patch) writePatch(cc, patch, PATCHES_DIR);
    }
  }

  printCombinedSummary(allResults);

  const anyChanged = Object.values(allResults).flat().some(r => r.status === 'CHANGED');
  process.exit(anyChanged ? 1 : 0);
}

main();
