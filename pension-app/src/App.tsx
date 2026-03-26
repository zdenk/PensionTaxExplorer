/**
 * App — EU27 Pension & Tax Burden Explorer
 */

import { useReducer, useState, useEffect, useRef, useCallback } from 'react';
import { usePostHog } from '@posthog/react';
import { appReducer, INITIAL_STATE } from './state/appReducer';
import { COUNTRY_MAP } from './data/countryRegistry';
import { computeScenario } from './utils/computeScenario';
import { ControlsBar } from './components/ControlsBar';
import { EUMap } from './components/EUMap';
import { CountryGrid } from './components/CountryGrid';
import { ComparisonCharts } from './components/ComparisonCharts';
import { SourcesPage } from './components/SourcesPage';
import { PrivacyNotice } from './components/PrivacyNotice';
import { ConsentBanner } from './components/ConsentBanner';
import { decodeHashToState, buildShareUrl } from './utils/shareUrl';
import type { ScenarioResult } from './types';

/** Stable key for a (country, mode) card column. */
function cardKey(code: string, modeName: string | null) {
  return modeName ? `${code}::${modeName}` : code;
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  const handler = useCallback(() => setIsMobile(window.innerWidth < breakpoint), [breakpoint]);
  useEffect(() => {
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [handler]);
  return isMobile;
}

export default function App() {
  const posthog = usePostHog();
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);
  const isMobile = useIsMobile();
  const [showSources, setShowSources] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [copied, setCopied] = useState(false);
  // Prevents the hash-write useEffect from re-triggering the hash-read on init
  const skipHashRead = useRef(false);
  // Track previous showComparison to fire event only on transition to true
  const prevShowComparison = useRef(false);

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
    posthog?.capture('share_clicked', {
      country_codes: state.selectedCountries,
      wage_mode_type: state.wageMode.type,
      wage_mode_value: state.wageMode.value,
      aw_source: state.awSource,
      rr_source: state.rrSource,
      fair_return_rate: state.fairReturnRate,
      career_overrides: Object.keys(state.careerOverrides).length > 0
        ? JSON.stringify(state.careerOverrides)
        : null,
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

  // Fire comparison_charts_viewed when the panel first becomes visible
  useEffect(() => {
    if (showComparison && !prevShowComparison.current) {
      posthog?.capture('comparison_charts_viewed', {
        country_codes: state.selectedCountries,
        chart_count: comparisonEntries.length,
      });
    }
    prevShowComparison.current = showComparison;
  }, [showComparison]); // eslint-disable-line react-hooks/exhaustive-deps

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
            {/* Share / upload icon — arrow out of box */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              width="12"
              height="12"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M7.47 1.22a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1-1.06 1.06L8.75 3.56v6.19a.75.75 0 0 1-1.5 0V3.56L5.53 5.28a.75.75 0 0 1-1.06-1.06l3-3ZM2.75 11a.75.75 0 0 1 .75.75v1.5h9v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-1.5A.75.75 0 0 1 2.75 11Z" />
            </svg>
            {copied ? 'Copied!' : 'Share'}
          </button>
          <button
            onClick={() => { setShowSources(s => !s); if (!showSources) posthog?.capture('sources_page_opened'); }}
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
      <main className="flex-1 p-4">
        {state.selectedCountries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-slate-500 text-lg mb-2">No countries selected</p>
            <p className="text-slate-600 text-sm">
              Use the controls bar above to add countries (up to 3 cards total, including mode comparisons).
            </p>
          </div>
        ) : (
          <>
            {isMobile && cardSpecs.length > 1 && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-sky-800 bg-sky-950/60 px-4 py-3 text-sm text-sky-300">
                <span className="mt-0.5 shrink-0 text-base">💻</span>
                <span>
                  Showing 1 country on mobile. Open on a <strong>laptop or desktop</strong> to compare multiple countries side by side.
                </span>
              </div>
            )}
            <CountryGrid
              cardSpecs={isMobile ? cardSpecs.slice(0, 1) : cardSpecs}
              scenarios={scenarios}
              appState={state}
              dispatch={dispatch}
            />
            {showComparison && (
              <ComparisonCharts
                entries={comparisonEntries}
                wageMode={state.wageMode}
                careerOverrides={state.careerOverrides}
                appState={state}
              />
            )}
          </>
        )}

      </main>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800 px-4 py-2 text-xs text-slate-600 shrink-0 flex justify-between items-center gap-4">
        <span>
          Sources: OECD Taxing Wages · MISSOC · Eurostat · ECB · National social insurance authorities
        </span>
        <span className="text-slate-500 flex items-center gap-2 shrink-0">
          Anonymous analytics via PostHog (EU){' ·'}
          <button
            onClick={() => setShowPrivacy(true)}
            className="underline hover:text-slate-300 transition-colors"
          >
            Privacy
          </button>
        </span>
      </footer>

      {/* Consent banner — first-visit opt-in (hidden once a choice is stored) */}
      <ConsentBanner onShowPrivacy={() => setShowPrivacy(true)} />

      {/* Privacy notice modal */}
      {showPrivacy && <PrivacyNotice onClose={() => setShowPrivacy(false)} />}
    </div>
  );
}
