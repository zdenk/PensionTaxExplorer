/**
 * CountryGrid — section-row layout with a floating left-side section navigator.
 *
 * Layout:
 *   • A fixed panel on the left edge of the viewport lets the user toggle
 *     individual sections on/off at any time.
 *   • Each visible section is a full-width row containing one cell per country,
 *     so the same information is always horizontally aligned.
 */

import { useState } from 'react';
import type { AppState, ScenarioResult } from '../types';
import type { AppAction } from '../state/appReducer';
import { COUNTRY_MAP } from '../data/countryRegistry';
import { lookupOecdRR, isExactOecdMultiple } from '../data/oecdRRLookup';
import { KPIRow, EffectiveRates, PensionRow } from './KPIRow';
import { WageBreakdownTable } from './WageBreakdownTable';
import { SSCRedistributionTable } from './SSCRedistributionTable';
import { Graph1_CareerTimeline } from './Graph1_CareerTimeline';
import { Graph2_Accumulation, WagePieChart } from './Graph2_Accumulation';
import { Graph3_ReplacementRateCurve } from './Graph3_ReplacementRateCurve';
import { WageDistributionChart } from './WageDistributionChart';
import {
  CountryHeader,
  IncompleteBanner,
  OSVCBanner,
  CZBenefitsPanel,
} from './CountryCard';

// ─── Section registry ─────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'income',       label: 'Income & Tax' },
  { id: 'pension',      label: 'Pension' },
  { id: 'distribution', label: 'Wage Distrib.' },
  { id: 'breakdown',    label: 'Breakdown' },
  { id: 'ssc',          label: 'SSC Split' },
  { id: 'timeline',     label: 'Timeline' },
  { id: 'accumulation', label: 'Accumulation' },
  { id: 'rr-curve',     label: 'RR Curve' },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CardSpec {
  code: string;
  modeName: string | null;
}

interface Props {
  cardSpecs: CardSpec[];
  scenarios: Record<string, ScenarioResult>;
  appState: AppState;
  dispatch: React.Dispatch<AppAction>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cardKey(code: string, modeName: string | null) {
  return modeName ? `${code}::${modeName}` : code;
}

// ─── Section navigator ────────────────────────────────────────────────────────
// Rendered as a sticky sidebar: starts at the top of the country content,
// stays fixed as the user scrolls, and can be collapsed to a thin tab.

function SectionNav({
  collapsed,
  onCollapse,
  visible,
  onNavigate,
  onHide,
}: {
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
  visible: Set<SectionId>;
  onNavigate: (id: SectionId) => void;
  onHide: (id: SectionId) => void;
}) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center w-6 bg-slate-900/95 backdrop-blur-sm border border-slate-700/70 rounded-lg py-2 shadow-2xl">
        <button
          onClick={() => onCollapse(false)}
          title="Expand section navigator"
          className="text-slate-400 hover:text-sky-300 transition-colors text-sm leading-none"
        >
          ›
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 w-32 bg-slate-900/95 backdrop-blur-sm border border-slate-700/70 rounded-lg p-1.5 shadow-2xl">

      {/* Header row — full row is the collapse trigger */}
      <button
        onClick={() => onCollapse(true)}
        title="Collapse navigator"
        className="flex items-center justify-between w-full pb-1 border-b border-slate-800 hover:bg-slate-800/50 rounded px-1 transition-colors group"
      >
        <p className="text-[9px] text-slate-500 group-hover:text-slate-300 uppercase tracking-widest transition-colors">Sections</p>
        <span className="text-base text-slate-500 group-hover:text-slate-200 leading-none transition-colors">‹</span>
      </button>

      {/* Countries anchor */}
      <button
        onClick={() =>
          document.getElementById('section-countries')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        title="Scroll to countries"
        className="px-2 py-1 text-[11px] rounded text-left leading-tight transition-all border bg-slate-800/60 border-slate-600/50 text-slate-300 hover:text-white hover:bg-slate-700/60"
      >
        ↑ Countries
      </button>

      <div className="h-px bg-slate-800 my-0.5" />

      {/* Section toggles */}
      {SECTIONS.map(({ id, label }) => {
        const on = visible.has(id);
        return (
          <div key={id} className="flex items-center gap-0.5">
            <button
              onClick={() => onNavigate(id)}
              title={on ? `Scroll to "${label}"` : `Show "${label}"`}
              className={`flex-1 px-2 py-1 text-[11px] rounded text-left leading-tight transition-all border ${
                on
                  ? 'bg-sky-900/50 border-sky-700/50 text-sky-300'
                  : 'bg-transparent border-transparent text-slate-600 hover:text-slate-400 hover:bg-slate-800/40'
              }`}
            >
              {label}
            </button>
            {on && (
              <button
                onClick={() => onHide(id)}
                title={`Hide "${label}"`}
                className="text-slate-400 hover:text-red-400 hover:bg-red-900/30 text-[11px] px-1 py-0.5 rounded leading-none transition-colors"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Section row ──────────────────────────────────────────────────────────────

function SectionRow({
  id,
  label,
  cols,
  children,
}: {
  id: string;
  label: string;
  cols: number;
  children: React.ReactNode;
}) {
  return (
    <div id={`section-${id}`} className="mt-8">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest whitespace-nowrap shrink-0">
          {label}
        </span>
        <div className="flex-1 h-px bg-slate-700/50" />
      </div>
      <div
        className="grid gap-4 items-start"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Cell wrapper ─────────────────────────────────────────────────────────────

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 min-w-0">
      {children}
    </div>
  );
}

// ─── CountryGrid ──────────────────────────────────────────────────────────────

export function CountryGrid({ cardSpecs, scenarios, appState, dispatch }: Props) {
  const [visible, setVisible] = useState<Set<SectionId>>(
    new Set(SECTIONS.map(s => s.id)),
  );
  const [navCollapsed, setNavCollapsed] = useState(false);
  const navigate = (id: SectionId) => {
    if (!visible.has(id)) {
      setVisible(prev => new Set([...prev, id]));
      // Defer scroll until after the section renders
      setTimeout(() => {
        document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    } else {
      document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const hide = (id: SectionId) =>
    setVisible(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const show = (id: SectionId) => visible.has(id);

  const cols = cardSpecs.length;
  const currency = appState.currency;

  // Pre-compute per-card derived values
  const cards = cardSpecs.map(({ code, modeName }) => {
    const country = COUNTRY_MAP[code]!;
    const result = scenarios[cardKey(code, modeName)]!;
    const activeModes: (string | null)[] = appState.selfEmploymentModes[code] ?? [null];
    const retirementAge =
      appState.careerOverrides.retirementAge ?? country.defaults.retirementAge;
    const oecdRR = (() => {
      if (appState.rrSource !== 'oecd') return null;
      if (appState.wageMode.type !== 'multiplier') return null;
      const m = appState.wageMode.value;
      const lookup = lookupOecdRR(code, m);
      if (!lookup) return null;
      return { ...lookup, isInterpolated: !isExactOecdMultiple(m) };
    })();
    return { code, modeName, country, result, activeModes, retirementAge, oecdRR };
  });

  return (
    <div className="flex gap-4">

      {/* ── Section navigator ───────────────────────────────────────────────
          The wrapper stretches to the full height of the content column
          (flex default align-items: stretch). The inner div is sticky so it
          follows the user while scrolling but stops at the wrapper's bottom,
          which coincides with the end of the CountryGrid — it cannot drift
          into the Cross-country Comparison section below.                  */}
      <div
        className="hidden md:block shrink-0 self-stretch"
        style={{ width: navCollapsed ? '1.75rem' : '8rem' }}
      >
        <div style={{ position: 'sticky', top: '1rem' }}>
          <SectionNav
            collapsed={navCollapsed}
            onCollapse={setNavCollapsed}
            visible={visible}
            onNavigate={navigate}
            onHide={hide}
          />
        </div>
      </div>

      {/* Grid content */}
      <div className="flex-1 min-w-0">

        {/* ── Country headers ──────────────────────────────────────────── */}
        <div
          id="section-countries"
          className="grid gap-4 items-start"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {cards.map(({ code, modeName, country, result, activeModes }) => (
            <Cell key={cardKey(code, modeName)}>
              <CountryHeader
                country={country}
                dispatch={dispatch}
                activeModes={activeModes}
                grossMonthly={result.resolvedWage.grossLocal}
                appState={appState}
              />
              <IncompleteBanner country={country} />
              <OSVCBanner
                country={country}
                modeName={modeName}
                grossMonthly={result.resolvedWage.grossLocal}
              />
              {country.code === 'CZ' && modeName === null && (
                <CZBenefitsPanel
                  country={country}
                  result={result}
                  appState={appState}
                  dispatch={dispatch}
                />
              )}
            </Cell>
          ))}
        </div>

        {/* ── Income & Tax ─────────────────────────────────────────────── */}
        {show('income') && (
          <SectionRow id="income" label="Income & Tax" cols={cols}>
            {cards.map(({ code, modeName, result }) => (
              <Cell key={cardKey(code, modeName)}>
                <KPIRow
                  result={result}
                  currency={currency}
                  countryCurrency={COUNTRY_MAP[code]!.currency}
                  eurExchangeRate={COUNTRY_MAP[code]!.eurExchangeRate}
                  czBenefitResult={result.czBenefitResult}
                />
                <EffectiveRates result={result} czBenefitResult={result.czBenefitResult} />
              </Cell>
            ))}
          </SectionRow>
        )}

        {/* ── Pension Estimate ─────────────────────────────────────────── */}
        {show('pension') && (
          <SectionRow id="pension" label="Pension Estimate" cols={cols}>
            {cards.map(({ code, modeName, result, oecdRR }) => (
              <Cell key={cardKey(code, modeName)}>
                <PensionRow
                  result={result}
                  currency={currency}
                  countryCurrency={COUNTRY_MAP[code]!.currency}
                  eurExchangeRate={COUNTRY_MAP[code]!.eurExchangeRate}
                  oecdRR={oecdRR}
                />
              </Cell>
            ))}
          </SectionRow>
        )}

        {/* ── Wage Distribution ────────────────────────────────────────── */}
        {show('distribution') && (
          <SectionRow id="distribution" label="Wage Distribution" cols={cols}>
            {cards.map(({ code, modeName, result }) => (
              <Cell key={cardKey(code, modeName)}>
                <WageDistributionChart
                  country={COUNTRY_MAP[code]!}
                  selectedWageLocal={result.resolvedWage.grossLocal}
                  currency={currency}
                  eurExchangeRate={COUNTRY_MAP[code]!.eurExchangeRate}
                />
              </Cell>
            ))}
          </SectionRow>
        )}

        {/* ── Wage Breakdown ───────────────────────────────────────────── */}
        {show('breakdown') && (
          <SectionRow id="breakdown" label="Wage Breakdown" cols={cols}>
            {cards.map(({ code, modeName, result }) => (
              <Cell key={cardKey(code, modeName)}>
                <WageBreakdownTable
                  result={result}
                  currency={currency}
                  countryCurrency={COUNTRY_MAP[code]!.currency}
                  eurExchangeRate={COUNTRY_MAP[code]!.eurExchangeRate}
                />
                <WagePieChart
                  result={result}
                  currency={currency}
                  countryCurrency={COUNTRY_MAP[code]!.currency}
                  eurExchangeRate={COUNTRY_MAP[code]!.eurExchangeRate}
                />
              </Cell>
            ))}
          </SectionRow>
        )}

        {/* ── SSC Redistribution ───────────────────────────────────────── */}
        {show('ssc') && (
          <SectionRow id="ssc" label="SSC Redistribution" cols={cols}>
            {cards.map(({ code, modeName, result }) => (
              <Cell key={cardKey(code, modeName)}>
                <SSCRedistributionTable
                  result={result}
                  country={COUNTRY_MAP[code]!}
                  currency={currency}
                />
              </Cell>
            ))}
          </SectionRow>
        )}

        {/* ── Career Timeline ──────────────────────────────────────────── */}
        {show('timeline') && (
          <SectionRow id="timeline" label="Career Timeline" cols={cols}>
            {cards.map(({ code, modeName, result, retirementAge }) => (
              <Cell key={cardKey(code, modeName)}>
                <Graph1_CareerTimeline
                  result={result}
                  currency={currency}
                  countryCurrency={COUNTRY_MAP[code]!.currency}
                  eurExchangeRate={COUNTRY_MAP[code]!.eurExchangeRate}
                  retirementAge={retirementAge}
                  country={COUNTRY_MAP[code]!}
                />
              </Cell>
            ))}
          </SectionRow>
        )}

        {/* ── Pension Accumulation ─────────────────────────────────────── */}
        {show('accumulation') && (
          <SectionRow id="accumulation" label="Pension Accumulation" cols={cols}>
            {cards.map(({ code, modeName, result, retirementAge }) => (
              <Cell key={cardKey(code, modeName)}>
                <Graph2_Accumulation
                  result={result}
                  currency={currency}
                  countryCurrency={COUNTRY_MAP[code]!.currency}
                  eurExchangeRate={COUNTRY_MAP[code]!.eurExchangeRate}
                  retirementAge={retirementAge}
                />
              </Cell>
            ))}
          </SectionRow>
        )}

        {/* ── Replacement Rate Curve ───────────────────────────────────── */}
        {show('rr-curve') && (
          <SectionRow id="rr-curve" label="Replacement Rate Curve" cols={cols}>
            {cards.map(({ code, modeName, result }) => (
              <Cell key={cardKey(code, modeName)}>
                <Graph3_ReplacementRateCurve
                  country={COUNTRY_MAP[code]!}
                  result={result}
                  careerOverrides={appState.careerOverrides}
                  wageMode={appState.wageMode}
                />
              </Cell>
            ))}
          </SectionRow>
        )}

      </div>
    </div>
  );
}
