/**
 * scripts/euromod/runner.ts
 *
 * Generic per-country diff runner.
 * Iterates PARAM_REGISTRY[cc], resolves appValue from each mapping's appResolver,
 * and delegates to buildCheck. No country-specific logic lives here.
 */

import { buildCheck, EuromodRow, DiffResult, CheckOpts } from './lib';
import { PARAM_REGISTRY } from './parameterMap';
import type { CountryConfig } from '../../src/types';

export function runCountryDiff(
  cc: string,
  config: CountryConfig,
  rows: EuromodRow[],
  appYear: number,
): DiffResult[] {
  const mappings = PARAM_REGISTRY[cc];
  if (!mappings || mappings.length === 0) return [];

  return mappings.map(m => {
    const appValue = m.appResolver(config);
    const opts: CheckOpts = {
      section:     m.section,
      label:       m.label,
      emParam:     m.emParam,
      appValue,
      emTransform: m.emTransform,
      tolerance:   m.tolerance,
      displayUnit: m.displayUnit ?? '%',
      note:        m.note,
    };
    return buildCheck(rows, appYear, opts);
  });
}
