/**
 * App — EU27 Pension & Tax Burden Explorer
 */

import { useReducer, useState, useEffect, useRef } from 'react';
import { appReducer, INITIAL_STATE } from './state/appReducer';
import { COUNTRY_MAP } from './data/countryRegistry';
import { computeScenario } from './utils/computeScenario';
import { ControlsBar } from './components/ControlsBar';
import { EUMap } from './components/EUMap';
import { CountryCard } from './components/CountryCard';
import { ComparisonCharts } from './components/ComparisonCharts';
import { SourcesPage } from './components/SourcesPage';
import { decodeHashToState, buildShareUrl } from './utils/shareUrl';
import type { ScenarioResult } from './types';

/** Stable key for a (country, mode) card column. */
function cardKey(code: string, modeName: string | null) {
  return modeName ? `${code}::${modeName}` : code;
}

export default function App() {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);
  const [showSources, setShowSources] = useState(false);
  const [copied, setCopied] = useState(false);
  // Prevents the hash-write useEffect from re-triggering the hash-read on init
  const skipHashRead = useRef(false);

  // ── On mount: restore state from URL hash ──────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash === '#') return;
    const decoded = decodeHashToState(hash);
    skipHashRead.current = true;
    if (decoded.selectedCountries) {
      dispatch({ type: 'SET_COUNTRIES', codes: decoded.selectedCountries });
    }
    if (decoded.wageMode) {
      dispatch({ type: 'SET_WAGE_MODE', mode: decoded.wageMode });
    }
    if (decoded.awSource) {
      dispatch({ type: 'SET_AW_SOURCE', source: decoded.awSource });
    }
    if (decoded.rrSource) {
      dispatch({ type: 'SET_RR_SOURCE', source: decoded.rrSource });
    }
    if (decoded.fairReturnRate != null) {
      dispatch({ type: 'SET_FAIR_RETURN_RATE', rate: decoded.fairReturnRate });
    }
    if (decoded.currency) {
      dispatch({ type: 'SET_CURRENCY', currency: decoded.currency });
    }
    if (decoded.careerOverrides) {
      for (const [key, value] of Object.entries(decoded.careerOverrides) as [keyof typeof decoded.careerOverrides, number][]) {
        if (value != null) dispatch({ type: 'SET_CAREER_OVERRIDE', key, value });
      }
    }
    // selfEmploymentModes via SET_SELF_EMPLOYMENT_MODE is complex; skip for now
    // (mode state will fall back to default employee)
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync state → URL hash (debounced 400 ms) ──────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      const hash = buildShareUrl(state);
      const newHash = '#' + new URL(hash).hash.slice(1);
      if (window.location.hash !== newHash) {
        window.history.replaceState(null, '', hash);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [state]);

  // ── Share handler ──────────────────────────────────────────────────────────
  function handleShare() {
    const url = buildShareUrl(state);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

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
        // CZ employer benefits — only consumed by the CZ engine; ignored for other countries
        state.czBenefits,
        state.fairReturnRate,
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
        <div className="flex items-center gap-3">
          <button
            onClick={handleShare}
            title="Copy shareable link to clipboard"
            className={`text-xs px-3 py-1 rounded border transition-colors flex items-center gap-1.5 ${
              copied
                ? 'bg-emerald-700 border-emerald-500 text-white'
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
          >
            {/* Bar-chart icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              width="12"
              height="12"
              fill="currentColor"
              aria-hidden="true"
            >
              <rect x="1" y="9" width="3" height="6" rx="0.5" />
              <rect x="6" y="5" width="3" height="10" rx="0.5" />
              <rect x="11" y="1" width="3" height="14" rx="0.5" />
            </svg>
            {copied ? 'Copied!' : 'Share'}
          </button>
          <button
            onClick={() => setShowSources(s => !s)}
            className={`text-xs px-3 py-1 rounded border transition-colors ${
              showSources
                ? 'bg-sky-700 border-sky-500 text-white'
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
          >
            Sources
          </button>
          <span className="text-xs text-slate-600 font-mono">v2.0</span>
        </div>
      </header>

      {/* WIP disclaimer banner */}
      <div className="bg-amber-950 border-b border-amber-700 px-4 py-1.5 flex items-center gap-2 shrink-0">
        <span className="text-amber-400 text-xs font-semibold shrink-0">🚧 Work in progress</span>
        <span className="text-amber-300/80 text-xs">
          Calculation errors may be present — parameters and formulas have not been fully audited. For illustrative purposes only; not financial or tax advice.{' '}
          <a
            href="https://github.com/zdenk/PensionTaxExplorer/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-200 transition-colors"
          >
            Report an issue
          </a>
          {' · '}
          <a
            href="https://github.com/zdenk/PensionTaxExplorer"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-200 transition-colors"
          >
            GitHub repo
          </a>
        </span>
      </div>

      {/* Controls — hidden when Sources page is open */}
      {!showSources && <ControlsBar state={state} dispatch={dispatch} />}

      {/* EU choropleth map — just below wage controls */}
      {!showSources && <EUMap state={state} dispatch={dispatch} />}

      {/* Sources page — replaces main content when open */}
      {showSources ? (
        <div className="flex-1 overflow-hidden">
          <SourcesPage onClose={() => setShowSources(false)} />
        </div>
      ) : (
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
      )}

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
