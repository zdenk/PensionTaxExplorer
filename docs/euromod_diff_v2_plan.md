# EUROMOD Diff v2 — Technical Design

**Status:** Approved  
**Date:** 2026-03-20  
**Replaces:** ad-hoc per-country `diffXX.ts` scripts (v1)  
**Scope:** CZ, DE, FR, PL, AT + all countries present in both the EUROMOD Excel and `countryRegistry.ts`

---

## 1. Motivation — What's Wrong With v1

| Problem | Impact |
|---|---|
| 5 near-identical per-country scripts (~750 lines total) | Adding a new country requires copying a whole script |
| No declarative registry — every parameter is hardcoded inline as a `check()` call | Cannot enumerate or validate param coverage without reading all scripts |
| `diffAll.ts` uses `spawnSync` + fragile JSON-from-stdout extraction (`indexOf('[')`) | Breaks silently if a script prints anything before the JSON array |
| `DiffResult.deltaPct` is `number` but is `NaN` when `appValue === 0` — crashes `printReport` | Live bug hit during PL diff |
| Each subprocess re-reads the entire XLSX file — 5× wasted I/O | ~1–2 s added per country |
| Dead `APPROX` status in `DiffStatus` — never set by `classify()` | Misleading type definition |
| `appYear` in `COUNTRIES[]` in diffAll can drift from the country's actual `dataYear` | Silent stale check |
| Non-null assertions `find(...)!` in diffCZ / diffDE — crash on label mismatch | Fragile against label refactors |
| No patch generation — ACTION REQUIRED items must be applied manually with no guidance | Friction in the fix loop |

---

## 2. Architecture Overview

```
scripts/euromod/
  lib.ts              ← (refactored) shared types, parseEMValue, loadEuromodSheet(wb, cc)
  parameterMap.ts     ← NEW: declarative registry  ParamMapping[] per country code
  runner.ts           ← NEW: generic runCountryDiff(cc, config, rows, appYear)
  generatePatch.ts    ← NEW: renders patches/<CC>_patch_<date>.ts for CHANGED params
  diffAll.ts          ← (rewritten) single-process orchestrator; no spawnSync
  [diffCZ/DE/FR/PL/AT.ts deleted]
```

### 2.1 Data flow

```
diffAll.ts
  │
  ├─ XLSX.readFile(XLSX_PATH)           ← once, shared workbook
  │
  ├─ for each cc in PARAM_REGISTRY:
  │    loadEuromodSheet(wb, cc)  →  EuromodRow[]
  │    import data/<cc config>   →  CountryConfig
  │    runCountryDiff(cc, config, rows, appYear)  →  DiffResult[]
  │    printReport(results, cc, appYear)
  │    if --patch: generatePatch(cc, results, config)  →  patches/<CC>_patch_<date>.ts
  │
  └─ printCombinedSummary(allResults)
     exit(1) if any CHANGED else exit(0)
```

---

## 3. File-by-File Specification

### 3.1 `lib.ts` changes

#### 3.1.1 `DiffStatus` — remove dead `APPROX`

```typescript
// v1
export type DiffStatus = 'MATCH' | 'CHANGED' | 'YEAR_GAP' | 'MISSING_EM' | 'APPROX';

// v2
export type DiffStatus = 'MATCH' | 'CHANGED' | 'YEAR_GAP' | 'MISSING_EM';
```

#### 3.1.2 `DiffResult.deltaPct` — `number | null`

```typescript
// v1
deltaPct: number;   // NaN when appValue=0 or emValue=NaN

// v2
deltaPct: number | null;   // null when undefined (appValue=0, MISSING_EM, etc.)
```

`buildCheck` computes:
```typescript
const deltaPct = (appValue === 0 || isNaN(emValue) || isNaN(appValue))
  ? null
  : (delta / Math.abs(appValue)) * 100;
```

`printReport` — remove the `== null || isNaN()` workaround, use typed null check:
```typescript
const deltaDisplay = r.deltaPct !== null
  ? `${r.deltaPct > 0 ? '+' : ''}${r.deltaPct.toFixed(1)}%`
  : '';
```

Action-required block — same null guard prevents the live crash.

#### 3.1.3 `loadEuromodSheet` — accept pre-loaded workbook

```typescript
// v2 signature (backwards compatible via overload)
export function loadEuromodSheet(cc: string): EuromodRow[];
export function loadEuromodSheet(wb: XLSX.WorkBook, cc: string): EuromodRow[];
```

When a `WorkBook` is passed as the first argument, skip `getWorkbook()`. This lets `diffAll.ts`
load the file once and pass the same workbook instance to every country.

#### 3.1.4 `CheckOpts` — add `appResolver` variant

```typescript
export interface CheckOpts {
  section: string;
  label: string;
  emParam: string;
  /** Explicit numeric value (v1 style — still supported) */
  appValue?: number;
  /** Lambda against CountryConfig — preferred for registry entries */
  appResolver?: (config: CountryConfig) => number;
  emTransform?: (raw: string) => number;
  tolerance?: number;
  displayUnit?: string;
  note?: string;
}
```

`buildCheck` resolves `appValue` from `appResolver(config)` when `appValue` is omitted. If both
are provided, `appValue` wins.

---

### 3.2 `parameterMap.ts` — NEW

```typescript
import type { CountryConfig } from '../../src/types';
import { toMonthly, toNumber } from './lib';

export interface ParamMapping {
  section: string;
  label: string;
  emParam: string;
  appResolver: (config: CountryConfig) => number;
  emTransform?: (raw: string) => number;
  tolerance?: number;        // default 0.005 (0.5%)
  displayUnit?: string;      // default '%'
  note?: string;
}

export const PARAM_REGISTRY: Record<string, ParamMapping[]> = {
  CZ: [ /* migrated from diffCZ.ts check() calls */ ],
  DE: [ /* migrated from diffDE.ts */ ],
  FR: [ /* migrated from diffFR.ts */ ],
  PL: [ /* migrated from diffPL.ts */ ],
  AT: [ /* migrated from diffAT.ts */ ],
  // Additional countries from countryRegistry.ts whose sheets exist in EUROMOD Excel:
  BE: [ /* ... */ ],
  NL: [ /* ... */ ],
  // etc.
};
```

**Migration rule for each `check()` call in v1 scripts:**

```typescript
// v1 (in diffDE.ts)
check({
  section: 'Employee SSC',
  label: 'Pension (RV) rate',
  emParam: '$tscee_rv',
  appValue: de.employeeSSC.components.find(c => c.label.includes('Pension'))!.rate,
  displayUnit: '%',
  tolerance: 0.001,
});

// v2 (in parameterMap.ts)
{
  section: 'Employee SSC',
  label: 'Pension (RV) rate',
  emParam: '$tscee_rv',
  appResolver: c => c.employeeSSC.components.find(
    comp => comp.label.includes('Pension')
  )?.rate ?? NaN,
  displayUnit: '%',
  tolerance: 0.001,
}
```

Non-null assertions (`!`) are replaced with optional chaining + `?? NaN`. A missing component
propagates `NaN` → `MISSING_EM` result rather than throwing at runtime.

---

### 3.3 `runner.ts` — NEW

```typescript
import { PARAM_REGISTRY } from './parameterMap';
import { buildCheck, EuromodRow, DiffResult, CheckOpts } from './lib';
import type { CountryConfig } from '../../src/types';

export function runCountryDiff(
  cc: string,
  config: CountryConfig,
  rows: EuromodRow[],
  appYear: number,
): DiffResult[] {
  const mappings = PARAM_REGISTRY[cc] ?? [];
  return mappings.map(m =>
    buildCheck(rows, appYear, {
      section:     m.section,
      label:       m.label,
      emParam:     m.emParam,
      appValue:    m.appResolver(config),
      emTransform: m.emTransform,
      tolerance:   m.tolerance,
      displayUnit: m.displayUnit,
      note:        m.note,
    } satisfies CheckOpts)
  );
}
```

`buildCheck` is unchanged. `runner.ts` is a pure dispatch adapter — no logic lives here.

---

### 3.4 `generatePatch.ts` — NEW

Produces a TypeScript comment block for each `CHANGED` result, written to
`patches/<CC>_patch_<YYYY-MM-DD>.ts` when `--patch` is passed.

```typescript
import * as path from 'path';
import * as fs from 'fs';
import type { DiffResult } from './lib';
import type { CountryConfig } from '../../src/types';

export function generatePatch(
  cc: string,
  results: DiffResult[],
  config: CountryConfig,
): string {
  const changed = results.filter(r => r.status === 'CHANGED');
  if (!changed.length) return '';

  const lines: string[] = [
    `// EUROMOD Diff Patch — ${cc} — generated ${new Date().toISOString().slice(0, 10)}`,
    `// Source: EUROMOD J2.0+ policy parameters Excel`,
    `// Review each block, verify against primary source, then apply manually.`,
    `//`,
  ];

  for (const r of changed) {
    const sign = (r.deltaPct ?? 0) > 0 ? '+' : '';
    lines.push(`// ── ${r.section} → ${r.label}`);
    lines.push(`//    EUROMOD (${r.emYear}): ${r.emValue}  ${r.displayUnit}`);
    lines.push(`//    App     (${config.dataYear}): ${r.appValue}  ${r.displayUnit}`);
    lines.push(`//    Δ: ${sign}${r.deltaPct?.toFixed(1) ?? 'n/a'}%`);
    if (r.note) lines.push(`//    Note: ${r.note}`);
    lines.push(`//    → Proposed value: ${r.emValue}  (replace existing: ${r.appValue})`);
    lines.push(`//`);
  }

  return lines.join('\n');
}

export function writePatch(
  cc: string,
  content: string,
  outDir: string,
): void {
  fs.mkdirSync(outDir, { recursive: true });
  const fname = `${cc}_patch_${new Date().toISOString().slice(0, 10)}.ts`;
  fs.writeFileSync(path.join(outDir, fname), content, 'utf-8');
  console.log(`  → Patch written: patches/${fname}`);
}
```

---

### 3.5 `diffAll.ts` — rewritten

```typescript
import * as XLSX from 'xlsx';
import * as path from 'path';
import { loadEuromodSheet, printReport, printCombinedSummary, XLSX_PATH, DiffResult } from './lib';
import { PARAM_REGISTRY } from './parameterMap';
import { runCountryDiff } from './runner';
import { generatePatch, writePatch } from './generatePatch';

// All country config objects keyed by ISO-2 code
import { countryConfigs } from '../../src/data/countryRegistry';

const PATCH_FLAG   = process.argv.includes('--patch');
const SINGLE_CC    = (() => {
  const idx = process.argv.indexOf('--country');
  return idx !== -1 ? process.argv[idx + 1]?.toUpperCase() ?? null : null;
})();
const PATCHES_DIR  = path.join(__dirname, '../../patches');

async function main(): Promise<void> {
  // Single XLSX read shared across all countries
  const wb = XLSX.readFile(XLSX_PATH);

  const countries = Object.keys(PARAM_REGISTRY).filter(
    cc => !SINGLE_CC || cc === SINGLE_CC,
  );

  const allResults: Record<string, DiffResult[]> = {};

  for (const cc of countries) {
    const config = countryConfigs[cc];
    if (!config) {
      console.warn(`[SKIP] ${cc} — not found in countryRegistry`);
      continue;
    }

    const rows    = loadEuromodSheet(wb, cc);
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
```

---

## 4. `package.json` Script Changes

```jsonc
// Remove:  diff:cz  diff:de  diff:fr  diff:pl  diff:at
// Add / replace:
{
  "scripts": {
    "diff:all":       "tsx scripts/euromod/diffAll.ts",
    "diff:all:patch": "tsx scripts/euromod/diffAll.ts --patch",
    "diff:country":   "tsx scripts/euromod/diffAll.ts --country"
    // usage: npm run diff:country -- DE
  }
}
```

---

## 5. Type Safety Improvements Summary

| v1 issue | v2 fix |
|---|---|
| `deltaPct: number` — silently `NaN` when `appValue === 0` | `deltaPct: number \| null` — `null` when undefined |
| `find(...)!` non-null assertions crash on label mismatch | `?.rate ?? NaN` — propagates to `MISSING_EM` |
| `APPROX` status unreachable dead code | Removed from `DiffStatus` union |
| XLSX re-read once per subprocess (5–15× per run) | Single `XLSX.readFile` in diffAll, workbook passed by reference |
| `appYear` in `COUNTRIES[]` can drift from country `dataYear` | `appYear = config.dataYear` always — no parallel value |
| Fragile `stdout.indexOf('[')` JSON extraction across subprocess boundary | Eliminated — single process, no subprocess channel |
| Per-country `runDiff()` helper inconsistently void vs return-value across scripts | Unified via `runner.ts` `runCountryDiff()` |

---

## 6. Expanding to Additional Countries

To add a country:

1. Confirm the sheet exists in the EUROMOD Excel:
   ```typescript
   const wb = XLSX.readFile(XLSX_PATH);
   console.log(wb.SheetNames);
   ```
2. Confirm the country is exported from `countryRegistry.ts` with a `CountryConfig`.
3. Add a `ParamMapping[]` array under the new country code key in `PARAM_REGISTRY`.
4. Run `npm run diff:country -- <CC>` to validate before committing.

No new files, no script registration, no subprocess wiring required.

---

## 7. Files Deleted

| File | Replaced by |
|---|---|
| `scripts/euromod/diffCZ.ts` | `parameterMap.ts` CZ entry |
| `scripts/euromod/diffDE.ts` | `parameterMap.ts` DE entry |
| `scripts/euromod/diffFR.ts` | `parameterMap.ts` FR entry |
| `scripts/euromod/diffPL.ts` | `parameterMap.ts` PL entry |
| `scripts/euromod/diffAT.ts` | `parameterMap.ts` AT entry |

---

## 8. Files Created / Modified

| File | Status | Purpose |
|---|---|---|
| `scripts/euromod/lib.ts` | Modified | `deltaPct: number \| null`; workbook overload; remove `APPROX`; `appResolver` in `CheckOpts` |
| `scripts/euromod/parameterMap.ts` | **New** | Declarative registry of all EUROMOD ↔ `CountryConfig` param bindings |
| `scripts/euromod/runner.ts` | **New** | Generic per-country diff runner — iterates registry entries |
| `scripts/euromod/generatePatch.ts` | **New** | Renders `patches/<CC>_patch_<date>.ts` for `CHANGED` results |
| `scripts/euromod/diffAll.ts` | Rewritten | Single-process orchestrator; no `spawnSync`; `--patch` / `--country` flags |
| `pension-app/package.json` | Modified | Remove individual `diff:cc` scripts; add `diff:all:patch` and `diff:country` |

---

## 9. Verification Checklist

- [ ] `npm run diff:all` — combined summary matches prior run: 56 match / 4 changed / 8 year-gap
- [ ] `npx tsc --noEmit` — zero errors; `deltaPct: number | null` propagates cleanly
- [ ] Synthetic `appValue: 0` entry — `deltaPct` is `null`, no crash, status `MISSING_EM` or `CHANGED`
- [ ] `npm run diff:all:patch` — `patches/` directory created; patch files written for DE, FR, AT
- [ ] `npm run diff:country -- CZ` — only CZ report printed, exit 0
- [ ] `npm run diff:country -- DE` — only DE report, exit 1 (Reichensteuer `CHANGED`)
- [ ] Adding a new country entry to `PARAM_REGISTRY` (e.g. `BE`) runs without touching any other file
