/**
 * App — EU27 Pension & Tax Burden Explorer
 * Phase 2: Controls bar + wage breakdown + SSC redistribution tables
 * Phase 3 (next): Charts
 */

import { useReducer } from 'react';
import { appReducer, INITIAL_STATE } from './state/appReducer';
import { COUNTRY_MAP } from './data/countryRegistry';
import { computeScenario } from './utils/computeScenario';
import { ControlsBar } from './components/ControlsBar';
import { CountryCard } from './components/CountryCard';
import { ComparisonCharts } from './components/ComparisonCharts';
import type { ScenarioResult } from './types';

/** Stable key for a (country, mode) card column. */
function cardKey(code: string, modeName: string | null) {
  return modeName ? `${code}::${modeName}` : code;
}

export default function App() {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);

  // Build card specs: one per (country, mode) pair, in country-selection order.
  // Each spec produces a separate column.
  const cardSpecs: Array<{ code: string; modeName: string | null }> = [];
  for (const code of state.selectedCountries) {
    const modes = state.selfEmploymentModes[code] ?? [null];
    for (const modeName of modes) {
      cardSpecs.push({ code, modeName });
    }
  }

  // Compute scenarios — one per card spec
  const scenarios: Record<string, ScenarioResult> = {};
  for (const { code, modeName } of cardSpecs) {
    const country = COUNTRY_MAP[code];
    if (country) {
      scenarios[cardKey(code, modeName)] = computeScenario(
        country,
        state.wageMode,
        state.careerOverrides,
        state.awSource,
        modeName,
      );
    }
  }

  // Entries for comparison charts (fixed-wage modes only, 2+ countries)
  const comparisonEntries = state.selectedCountries
    .map((code) => {
      const country = COUNTRY_MAP[code];
      // Use the first mode's scenario for comparison charts
      const firstMode = state.selfEmploymentModes[code]?.[0] ?? null;
      const result  = scenarios[cardKey(code, firstMode)];
      if (!country || !result) return null;
      return { code, country, result };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  const showComparison =
    state.wageMode.type !== 'multiplier' && comparisonEntries.length >= 2;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* App header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-semibold text-sky-400 leading-tight">
            EU27 Pension &amp; Tax Burden Explorer
          </h1>
          <p className="text-xs text-slate-500">OECD EU-22 · {new Date().getFullYear()} data</p>
        </div>
        <div className="text-xs text-slate-600 font-mono">v2.0 Phase 2</div>
      </header>

      {/* Controls */}
      <ControlsBar state={state} dispatch={dispatch} />

      {/* Country cards + comparison */}
      <main className="flex-1 overflow-auto p-4">
        {state.selectedCountries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-slate-500 text-lg mb-2">No countries selected</p>
            <p className="text-slate-600 text-sm">
              Use the controls bar above to add countries (up to 3 cards total, including mode comparisons).
            </p>
          </div>
        ) : (
          <div
            className="grid gap-4 items-start"
            style={{
              gridTemplateColumns: `repeat(${cardSpecs.length}, minmax(0, 1fr))`,
            }}
          >
            {cardSpecs.map(({ code, modeName }) => {
              const country = COUNTRY_MAP[code];
              const result = scenarios[cardKey(code, modeName)];
              if (!country || !result) return null;
              return (
                <CountryCard
                  key={cardKey(code, modeName)}
                  country={country}
                  result={result}
                  selfEmploymentModeName={modeName}
                  appState={state}
                  dispatch={dispatch}
                />
              );
            })}
          </div>
        )}

        {/* Cross-country comparison charts */}
        {showComparison && (
          <ComparisonCharts
            entries={comparisonEntries}
            wageMode={state.wageMode}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-4 py-2 text-xs text-slate-600 shrink-0 flex justify-between">
        <span>
          Sources: OECD Taxing Wages · MISSOC · Eurostat · ECB · National social insurance authorities
        </span>
        <span className="text-slate-500">
          Constant Prices (real terms) · Funded returns 2–3% real net-of-fees · Single adult earner · Standard employment · No personal circumstances modelled
        </span>
      </footer>
    </div>
  );
}
