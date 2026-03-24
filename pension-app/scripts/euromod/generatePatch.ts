/**
 * scripts/euromod/generatePatch.ts
 *
 * Renders a human-readable patch comment block for every CHANGED parameter
 * in a country diff. Output is a .ts file with structured comments — the
 * developer reviews it and applies changes manually.
 *
 * Activated by the --patch flag on diffAll.ts.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DiffResult, fmtValue } from './lib';
import type { CountryConfig } from '../../src/types';

export function generatePatch(
  cc: string,
  results: DiffResult[],
  config: CountryConfig,
): string {
  const changed = results.filter(r => r.status === 'CHANGED');
  if (changed.length === 0) return '';

  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [
    `// ═══════════════════════════════════════════════════════════════`,
    `// EUROMOD Diff Patch — ${cc} — generated ${date}`,
    `// Source: EUROMOD J2.0+ policy parameters Excel`,
    `//`,
    `// Review each block below, verify against the primary legislative source,`,
    `// then apply the proposed change manually to src/data/<country>.ts.`,
    `// ═══════════════════════════════════════════════════════════════`,
    ``,
  ];

  for (const r of changed) {
    const sign = (r.deltaPct ?? 0) > 0 ? '+' : '';
    const deltaStr = r.deltaPct != null ? `${sign}${r.deltaPct.toFixed(1)}%` : 'n/a';
    lines.push(`// ── ${r.section} → ${r.label}`);
    lines.push(`//    emParam:      ${r.emParam}`);
    lines.push(`//    EUROMOD (${r.emYear}): ${fmtValue(r.emValue, r.displayUnit)}  ${r.displayUnit}`);
    lines.push(`//    App     (${config.dataYear}): ${fmtValue(r.appValue, r.displayUnit)}  ${r.displayUnit}`);
    lines.push(`//    Δ:            ${deltaStr}`);
    if (r.note) lines.push(`//    Note:         ${r.note}`);
    lines.push(`//`);
    lines.push(`//    → Proposed value: ${fmtValue(r.emValue, r.displayUnit)}`);
    lines.push(`//      Replace:        ${fmtValue(r.appValue, r.displayUnit)}`);
    lines.push(`//`);
    lines.push(`//    Verify at: [add primary source URL here]`);
    lines.push(``);
  }

  return lines.join('\n');
}

export function writePatch(
  cc: string,
  content: string,
  outDir: string,
): void {
  fs.mkdirSync(outDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const fname = `${cc}_patch_${date}.ts`;
  const fullPath = path.join(outDir, fname);
  fs.writeFileSync(fullPath, content, 'utf-8');
  console.log(`  → Patch written: patches/${fname}`);
}
