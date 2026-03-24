/**
 * ControlsBar — top-level controls per Technical Design §4.4 and §5
 */

import { useState } from 'react';
import type { AppState, WageMode, CareerDefaults } from '../types';
import type { AppAction } from '../state/appReducer';
import { needsEurLock, totalActiveCards, MAX_CARDS } from '../state/appReducer';
import { ALL_COUNTRIES, COUNTRY_MAP, FLAG, TIER } from '../data/countryRegistry';
import { formatMoney, formatEUR } from '../utils/formatCurrency';
import { resolveGross } from '../utils/resolveWage';

interface Props {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const MULTIPLIER_PRESETS = [0.5, 1.0, 1.5, 2.0, 3.0, 4.0];

// Helper — pick effective AW for a country given the current awSource
function getEffectiveAW(country: { averageWage: number; oecdAverageWage?: number }, awSource: 'model' | 'oecd'): number {
  return awSource === 'oecd' && country.oecdAverageWage != null
    ? country.oecdAverageWage
    : country.averageWage;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function AWSourceToggle({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<AppAction> }) {
  const active  = 'bg-sky-600 border-sky-500 text-white';
  const inactive = 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600';
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-slate-500 uppercase tracking-wide">AW source</span>
      <div className="flex">
        <button
          onClick={() => dispatch({ type: 'SET_AW_SOURCE', source: 'model' })}
          title="Use model/national-statistics average wage"
          className={`px-3 py-1.5 text-sm rounded-l-md border-y border-l border-r-0 transition-colors ${
            state.awSource === 'model' ? active : inactive
          }`}
        >
          Model
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_AW_SOURCE', source: 'oecd' })}
          title="Use OECD Taxing Wages 2025 average wage (2024 data)"
          className={`px-3 py-1.5 text-sm rounded-r-md border transition-colors ${
            state.awSource === 'oecd' ? active : inactive
          }`}
        >
          OECD TW
        </button>
      </div>
    </div>
  );
}

function RRSourceToggle({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<AppAction> }) {
  const active  = 'bg-sky-600 border-sky-500 text-white';
  const inactive = 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600';
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-slate-500 uppercase tracking-wide">Replacement rate</span>
      <div className="flex">
        <button
          onClick={() => dispatch({ type: 'SET_RR_SOURCE', source: 'model' })}
          title="Show model-computed gross replacement rate"
          className={`px-3 py-1.5 text-sm rounded-l-md border-y border-l border-r-0 transition-colors ${
            state.rrSource === 'model' ? active : inactive
          }`}
        >
          Model
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_RR_SOURCE', source: 'oecd' })}
          title="Show OECD Pensions at a Glance tabulated replacement rate (interpolated at current \u00d7AW)"
          className={`px-3 py-1.5 text-sm rounded-r-md border transition-colors ${
            state.rrSource === 'oecd' ? active : inactive
          }`}
        >
          OECD PaG
        </button>
      </div>
    </div>
  );
}

function WageModeToggle({ mode, dispatch }: { mode: WageMode; dispatch: React.Dispatch<AppAction> }) {
  const activeClass = 'bg-sky-600 border-sky-500 text-white';
  const inactiveClass = 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600';
  return (
    <div className="flex">
      <button
        onClick={() => dispatch({ type: 'SET_WAGE_MODE', mode: { type: 'multiplier', value: mode.type === 'multiplier' ? mode.value : 1.0 } })}
        className={`px-3 py-1.5 text-sm rounded-l-md border-y border-l border-r-0 transition-colors ${
          mode.type === 'multiplier' ? activeClass : inactiveClass
        }`}
      >
        × of AW
      </button>
      <button
        onClick={() => dispatch({ type: 'SET_WAGE_MODE', mode: {
          type: 'fixed_gross_eur',
          value: mode.type === 'fixed_gross_eur' ? mode.value
               : mode.type === 'fixed_employer_cost_eur' ? Math.round(mode.value * 0.77)
               : Math.round(mode.value * 3000) || 3000,
        }})}
        className={`px-3 py-1.5 text-sm border transition-colors ${
          mode.type === 'fixed_gross_eur' ? activeClass : inactiveClass
        }`}
      >
        Fixed Gross
      </button>
      <button
        onClick={() => dispatch({ type: 'SET_WAGE_MODE', mode: {
          type: 'fixed_employer_cost_eur',
          value: mode.type === 'fixed_employer_cost_eur' ? mode.value
               : mode.type === 'fixed_gross_eur' ? Math.round(mode.value * 1.30)
               : Math.round(mode.value * 4000) || 5000,
        }})}
        className={`px-3 py-1.5 text-sm rounded-r-md border-y border-r border-l-0 transition-colors ${
          mode.type === 'fixed_employer_cost_eur' ? activeClass : inactiveClass
        }`}
      >
        Fixed Cost
      </button>
    </div>
  );
}

function MultiplierInput({ mode, dispatch }: { mode: WageMode; dispatch: React.Dispatch<AppAction> }) {
  const value = mode.type === 'multiplier' ? mode.value : 1.0;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <input
          type="range" min={0.25} max={5.0} step={0.25} value={value}
          onChange={e => dispatch({ type: 'SET_WAGE_MODE', mode: { type: 'multiplier', value: parseFloat(e.target.value) } })}
          className="w-40 accent-sky-500"
        />
        <span className="text-sky-400 font-mono font-semibold w-12">{value.toFixed(2)}×</span>
      </div>
      <div className="flex gap-1 flex-wrap">
        {MULTIPLIER_PRESETS.map(p => (
          <button
            key={p}
            onClick={() => dispatch({ type: 'SET_WAGE_MODE', mode: { type: 'multiplier', value: p } })}
            className={`px-2 py-0.5 text-xs rounded border transition-colors ${
              value === p
                ? 'bg-sky-600 border-sky-500 text-white'
                : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {p}×
          </button>
        ))}
      </div>
    </div>
  );
}

function FixedEurInput({ mode, dispatch }: { mode: WageMode; dispatch: React.Dispatch<AppAction> }) {
  const value = mode.type === 'fixed_gross_eur' ? mode.value : 3_000;
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400 text-sm">€</span>
      <input
        type="number" min={100} max={100_000} step={100}
        value={value}
        onChange={e => dispatch({ type: 'SET_WAGE_MODE', mode: { type: 'fixed_gross_eur', value: parseInt(e.target.value, 10) || 0 } })}
        className="w-32 bg-slate-700 border border-slate-600 text-white text-sm rounded px-2 py-1.5 focus:outline-none focus:border-sky-500"
      />
      <span className="text-slate-400 text-sm">EUR/month gross</span>
    </div>
  );
}

function FixedEmployerCostEurInput({ mode, dispatch }: { mode: WageMode; dispatch: React.Dispatch<AppAction> }) {
  const value = mode.type === 'fixed_employer_cost_eur' ? mode.value : 5_000;
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400 text-sm">€</span>
      <input
        type="number" min={100} max={200_000} step={100}
        value={value}
        onChange={e => dispatch({ type: 'SET_WAGE_MODE', mode: { type: 'fixed_employer_cost_eur', value: parseInt(e.target.value, 10) || 0 } })}
        className="w-32 bg-slate-700 border border-slate-600 text-white text-sm rounded px-2 py-1.5 focus:outline-none focus:border-sky-500"
      />
      <span className="text-slate-400 text-sm">EUR/month total cost</span>
    </div>
  );
}

function AWReferenceTable({ state }: { state: AppState }) {
  const codes = state.selectedCountries;
  if (codes.length < 2) return null;
  const isMultiplier = state.wageMode.type === 'multiplier';
  const isFixedCost = state.wageMode.type === 'fixed_employer_cost_eur';
  const awSource = state.awSource;

  return (
    <div className="mt-3">
      <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">
        Average Wage Reference
        {isMultiplier && awSource === 'oecd' && (
          <span className="ml-2 text-sky-400 normal-case">— OECD Taxing Wages 2025</span>
        )}
      </p>
      <table className="text-xs border-collapse">
        <thead>
          <tr className="text-slate-500">
            <th className="pr-3 pb-1 text-left font-normal">Country</th>
            <th className="pr-3 pb-1 text-right font-normal">
              {isMultiplier && awSource === 'oecd' ? 'OECD AW' : '1× AW'}
            </th>
            {isMultiplier && awSource === 'oecd' && (
              <th className="pr-3 pb-1 text-right font-normal text-slate-600">Model AW</th>
            )}
            <th className="pr-3 pb-1 text-right font-normal">{isFixedCost ? 'Solved gross' : 'Your wage'}</th>
            {!isMultiplier && (
              <th className="pb-1 text-right font-normal">Implied ×AW</th>
            )}
          </tr>
        </thead>
        <tbody>
          {codes.map(code => {
            const country = COUNTRY_MAP[code];
            if (!country) return null;
            const fx = country.eurExchangeRate;
            const effectiveAW = getEffectiveAW(country, awSource);
            const awEur = effectiveAW / fx;
            const resolved = resolveGross(state.wageMode, country, effectiveAW);
            const grossLocal = resolved.grossLocal;
            const impliedMultiplier = resolved.impliedMultiplier;
            const belowAW = grossLocal < effectiveAW;

            return (
              <tr key={code} className="border-t border-slate-700">
                <td className="pr-3 py-1 text-slate-200">
                  {FLAG[code]} {country.name}
                </td>
                <td className="pr-3 py-1 text-right text-slate-400">
                  {formatMoney(effectiveAW, country.currency)}
                  {country.currency !== 'EUR' && (
                    <span className="text-slate-600 ml-1">(≈{formatEUR(awEur)})</span>
                  )}
                </td>
                {isMultiplier && awSource === 'oecd' && (
                  <td className="pr-3 py-1 text-right text-slate-600">
                    {formatMoney(country.averageWage, country.currency)}
                  </td>
                )}
                <td className="pr-3 py-1 text-right text-slate-200">
                  {formatMoney(grossLocal, country.currency)}
                </td>
                {!isMultiplier && (
                  <td className="py-1 text-right">
                    <span className={belowAW ? 'text-amber-400' : 'text-slate-300'}>
                      {impliedMultiplier?.toFixed(2)}×{belowAW ? ' ⚠' : ''}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {codes.some(code => {
        const country = COUNTRY_MAP[code];
        if (!country || isMultiplier) return false;
        const eff = getEffectiveAW(country, awSource);
        return resolveGross(state.wageMode, country, eff).grossLocal < eff;
      }) && (
        <p className="text-xs text-amber-400 mt-1">⚠ = below average wage in this country</p>
      )}
    </div>
  );
}

function CurrencyToggle({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<AppAction> }) {
  const locked = needsEurLock(state.selectedCountries);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-slate-500 uppercase tracking-wide">Display currency</span>
      <div className="flex gap-1 relative group">
        {(['EUR', 'local'] as const).map(c => (
          <button
            key={c}
            disabled={locked && c === 'local'}
            onClick={() => dispatch({ type: 'SET_CURRENCY', currency: c })}
            className={`px-3 py-1.5 text-sm rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              state.currency === c
                ? 'bg-sky-600 border-sky-500 text-white'
                : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {c === 'EUR' ? 'EUR' : 'Local'}
          </button>
        ))}
        {locked && (
          <span className="absolute -bottom-5 left-0 text-xs text-slate-500 whitespace-nowrap">
            Local display unavailable in cross-currency view
          </span>
        )}
      </div>
    </div>
  );
}

function CareerOverridePanel({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<AppAction> }) {
  const [open, setOpen] = useState(false);
  const ov = state.careerOverrides;

  const firstCountry = COUNTRY_MAP[state.selectedCountries[0]];
  const defRetirement = firstCountry?.defaults.retirementAge ?? 65;
  const defDuration = firstCountry?.defaults.retirementDuration ?? 20;

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
      >
        <span>{open ? '▼' : '▶'}</span>
        Career Assumptions
        {Object.keys(ov).length > 0 && (
          <span className="ml-1 bg-sky-600 text-white text-xs px-1.5 py-0.5 rounded-full">
            {Object.keys(ov).length} override{Object.keys(ov).length > 1 ? 's' : ''}
          </span>
        )}
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-3 gap-4 bg-slate-900/50 rounded-lg p-3">
          {(
            [
              { key: 'careerStartAge' as const, label: 'Career start', min: 16, max: 40, def: 25 },
              { key: 'retirementAge' as const, label: 'Retirement age', min: 55, max: 75, def: defRetirement },
              { key: 'retirementDuration' as const, label: 'Duration (yrs)', min: 5, max: 40, def: defDuration },
            ] as { key: keyof CareerDefaults; label: string; min: number; max: number; def: number }[]
          ).map(({ key, label, min, max, def }) => {
            const val = ov[key] ?? def;
            return (
              <div key={key} className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">{label}</span>
                  <span className="text-xs text-sky-400 font-mono">{val}</span>
                </div>
                <input
                  type="range" min={min} max={max} step={1} value={val}
                  onChange={e => dispatch({ type: 'SET_CAREER_OVERRIDE', key, value: parseInt(e.target.value, 10) })}
                  className="w-full accent-sky-500"
                />
              </div>
            );
          })}

          {/* ── Return rate slider ── */}
          <div className="col-span-3 border-t border-slate-700/60 pt-3 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">
                Actuarial-equivalent return rate
                <span className="ml-1.5 text-slate-600 font-normal">(1–3 % real net-of-fees)</span>
              </span>
              <span className="text-xs text-violet-400 font-mono">
                {(state.fairReturnRate * 100).toFixed(1)}%
              </span>
            </div>
            <input
              type="range" min={0.01} max={0.03} step={0.005} value={state.fairReturnRate}
              onChange={e => dispatch({ type: 'SET_FAIR_RETURN_RATE', rate: parseFloat(e.target.value) })}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-[10px] text-slate-600">
              <span>1.0% — pessimistic / bond-heavy</span>
              <span>1.5%</span>
              <span>2.0% — OECD base</span>
              <span>2.5%</span>
              <span>3.0% — equity-heavy</span>
            </div>
          </div>

          <div className="col-span-3 flex justify-end">
            <button
              onClick={() => {
                dispatch({ type: 'RESET_CAREER_OVERRIDES' });
                dispatch({ type: 'SET_FAIR_RETURN_RATE', rate: 0.030 });
              }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline"
            >
              Reset to defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CountrySelector({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<AppAction> }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const selected = new Set(state.selectedCountries);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-500 uppercase tracking-wide shrink-0">Countries:</span>

      {/* Active country chips */}
      {state.selectedCountries.map(code => {
        const country = COUNTRY_MAP[code];
        if (!country) return null;
        return (
          <span
            key={code}
            className="inline-flex items-center gap-1.5 bg-slate-700 text-slate-100 text-sm px-2.5 py-1 rounded-full border border-slate-600"
          >
            {FLAG[code]} {country.name}
            {country.incomplete && (
              <span className="text-xs text-amber-400 font-mono">~</span>
            )}
            <button
              onClick={() => dispatch({ type: 'REMOVE_COUNTRY', code })}
              className="text-slate-400 hover:text-red-400 ml-0.5 text-xs leading-none transition-colors"
              aria-label={`Remove ${country.name}`}
            >
              ✕
            </button>
          </span>
        );
      })}

      {/* Add button — shown when total card slots (countries × modes) is below cap */}
      {totalActiveCards(state) < MAX_CARDS && (
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="inline-flex items-center gap-1 text-sm text-sky-400 border border-dashed border-sky-700 hover:border-sky-500 rounded-full px-2.5 py-1 transition-colors"
          >
            + Add country
          </button>
          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-64 max-h-72 overflow-y-auto">
              {ALL_COUNTRIES.map(country => {
                const isSelected = selected.has(country.code);
                return (
                  <button
                    key={country.code}
                    disabled={isSelected}
                    onClick={() => {
                      dispatch({ type: 'ADD_COUNTRY', code: country.code });
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors
                      ${isSelected
                        ? 'text-slate-600 cursor-default'
                        : 'text-slate-200 hover:bg-slate-700'
                      }`}
                  >
                    <span>
                      {FLAG[country.code]} {country.name}
                      {country.incomplete && (
                        <span className="ml-1 text-xs text-amber-500">~</span>
                      )}
                    </span>
                    <span className="text-xs text-slate-500">{TIER[country.code]}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ControlsBar ─────────────────────────────────────────────────────────────

export function ControlsBar({ state, dispatch }: Props) {
  return (
    <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 space-y-3">
      {/* Row 1: Wage controls */}
      <div className="flex flex-wrap items-start gap-6">
        {/* Mode toggle */}
        <div className="space-y-1.5">
          <span className="text-xs text-slate-500 uppercase tracking-wide block">Wage mode</span>
          <WageModeToggle mode={state.wageMode} dispatch={dispatch} />
        </div>

        {/* Wage input + AW source (multiplier only) */}
        <div className="space-y-1.5">
          <span className="text-xs text-slate-500 uppercase tracking-wide block">
            {state.wageMode.type === 'multiplier' ? 'Multiplier'
              : state.wageMode.type === 'fixed_gross_eur' ? 'Gross salary'
              : 'Total employer cost'}
          </span>
          {state.wageMode.type === 'multiplier' && <MultiplierInput mode={state.wageMode} dispatch={dispatch} />}
          {state.wageMode.type === 'fixed_gross_eur' && <FixedEurInput mode={state.wageMode} dispatch={dispatch} />}
          {state.wageMode.type === 'fixed_employer_cost_eur' && <FixedEmployerCostEurInput mode={state.wageMode} dispatch={dispatch} />}
        </div>

        {/* AW source + RR source toggles — only shown in × of AW mode */}
        {state.wageMode.type === 'multiplier' && (
          <>
            <AWSourceToggle state={state} dispatch={dispatch} />
            <RRSourceToggle state={state} dispatch={dispatch} />
          </>
        )}

        {/* Currency toggle */}
        <div className="ml-auto pb-4">
          <CurrencyToggle state={state} dispatch={dispatch} />
        </div>
      </div>

      {/* Row 2: Country selector */}
      <CountrySelector state={state} dispatch={dispatch} />

      {/* Row 3: AW reference table */}
      <AWReferenceTable state={state} />

      {/* Row 4: Career overrides */}
      <CareerOverridePanel state={state} dispatch={dispatch} />
    </div>
  );
}
