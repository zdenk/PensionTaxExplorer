/**
 * CountryCard — full per-country panel
 */

import type { CountryConfig, AppState, ScenarioResult, SelfEmploymentMode, EmployerBenefitDef } from '../types';
import type { AppAction } from '../state/appReducer';
import { MAX_CARDS, totalActiveCards } from '../state/appReducer';
import { FLAG } from '../data/countryRegistry';
import { lookupOecdRR, isExactOecdMultiple } from '../data/oecdRRLookup';
import { KPIRow, EffectiveRates, PensionRow } from './KPIRow';
import { WageBreakdownTable } from './WageBreakdownTable';
import { SSCRedistributionTable } from './SSCRedistributionTable';
import { Graph1_CareerTimeline } from './Graph1_CareerTimeline';
import { Graph2_Accumulation } from './Graph2_Accumulation';
import { WagePieChart } from './Graph2_Accumulation';
import { Graph3_ReplacementRateCurve } from './Graph3_ReplacementRateCurve';
import { WageDistributionChart } from './WageDistributionChart';
import { useState } from 'react';
import { usePostHog } from '@posthog/react';

interface Props {
  country: CountryConfig;
  result: ScenarioResult;
  /** The specific employment mode rendered by this card instance. */
  selfEmploymentModeName: string | null;
  appState: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const SYSTEM_TYPE_LABELS: Record<string, string> = {
  DB: 'Defined Benefit',
  POINTS: 'Points',
  NDC: 'Notional DC',
  MIXED: 'Mixed',
  PENSION_ACCOUNT: 'Pension Account',
};

const SYSTEM_TYPE_COLORS: Record<string, string> = {
  DB: 'bg-blue-900/60 text-blue-300 border-blue-700',
  POINTS: 'bg-purple-900/60 text-purple-300 border-purple-700',
  NDC: 'bg-teal-900/60 text-teal-300 border-teal-700',
  MIXED: 'bg-violet-900/60 text-violet-300 border-violet-700',
  PENSION_ACCOUNT: 'bg-cyan-900/60 text-cyan-300 border-cyan-700',
};

function SystemTypeBadge({ type }: { type: string }) {
  const colors = SYSTEM_TYPE_COLORS[type] ?? 'bg-slate-700 text-slate-300 border-slate-600';
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-mono ${colors}`}>
      {SYSTEM_TYPE_LABELS[type] ?? type}
    </span>
  );
}

/** Short display label used on the mode toggle buttons. */
function getModeShortLabel(mode: SelfEmploymentMode): string {
  if (mode.pausalniDan) return `PD ${mode.pausalniDan.bandLabel}`;
  return 'OSVČ';
}

export function CountryHeader({
  country,
  dispatch,
  activeModes,
  grossMonthly,
  appState,
}: {
  country: CountryConfig;
  dispatch: React.Dispatch<AppAction>;
  /** All currently active mode names for this country (from appState). */
  activeModes: (string | null)[];
  grossMonthly: number;
  appState: AppState;
}) {
  const posthog = usePostHog();
  const systemType  = country.pensionSystem.type;
  const seAvailable = country.selfEmployment?.available === true;
  const seModes     = country.selfEmployment?.modes ?? [];

  // Whether adding another mode would exceed the global card cap
  const atCap = totalActiveCards(appState) >= MAX_CARDS;

  // Band validity hint per PD mode (inline validity dot)
  const annualGross = grossMonthly * 12;
  function pdIsValid(mode: SelfEmploymentMode): boolean | null {
    if (!mode.pausalniDan) return null;
    const pd = mode.pausalniDan;
    const withinLimit = annualGross <= pd.annualIncomeLimit;
    const prevLimit = seModes.find(m => m.pausalniDan?.band === pd.band - 1)?.pausalniDan?.annualIncomeLimit ?? 0;
    return withinLimit && (pd.band === 1 || annualGross > prevLimit);
  }

  // All mode entries: null = Employee, then each selfEmp mode
  const allModes: Array<{ name: string | null; label: string; isOSVC: boolean }> = [
    { name: null, label: 'Employee', isOSVC: false },
    ...seModes.map(m => ({ name: m.name, label: getModeShortLabel(m), isOSVC: true })),
  ];

  return (
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-2xl leading-none">{FLAG[country.code] ?? '🌍'}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-slate-100">{country.name}</h2>
            <SystemTypeBadge type={systemType} />
            {country.incomplete && (
              <span className="text-xs text-amber-400 border border-amber-700/50 bg-amber-900/30 rounded px-1.5 py-0.5">
                ~ pension estimate
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {country.currency} · Data year {country.dataYear}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-2 shrink-0">
        {/* Multi-select mode toggle — each button is independently checkable */}
        {seAvailable && (
          <div className="flex flex-wrap gap-1">
            {allModes.map(({ name, label, isOSVC }, idx) => {
              const isActive = activeModes.includes(name);
              // Prevent adding when at cap and this mode is not yet active
              const disabled = !isActive && atCap;
              const seMode   = seModes.find(m => m.name === name);
              const validity = seMode ? pdIsValid(seMode) : null;
              const showDot  = isActive && validity !== null;
              const dotColor = validity ? 'bg-emerald-400' : 'bg-red-400';

              const activeClass = isOSVC
                ? 'bg-orange-700 border-orange-500 text-white'
                : 'bg-sky-700 border-sky-500 text-white';
              const inactiveClass = disabled
                ? 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600';

              const roundClass = idx === 0
                ? 'rounded-l'
                : idx === allModes.length - 1
                  ? 'rounded-r'
                  : '';

              return (
                <button
                  key={String(name)}
                  disabled={disabled}
                  onClick={() => {
                    dispatch({ type: 'SET_SELF_EMPLOYMENT_MODE', countryCode: country.code, modeName: name });
                    if (isOSVC) {
                      posthog?.capture('se_mode_toggled', {
                        country_code: country.code,
                        mode_name: String(name),
                        se_type: seMode?.pausalniDan ? 'pausalni_dan' : 'osvc',
                        action: isActive ? 'removed' : 'added',
                      });
                    }
                  }}
                  title={
                    disabled ? `Card limit (${MAX_CARDS}) reached — remove another mode first`
                    : seMode?.pausalniDan
                      ? `Paušální daň ${seMode.pausalniDan.bandLabel} — ≤ ${(seMode.pausalniDan.annualIncomeLimit / 1_000).toFixed(0)} k CZK/year${isActive ? ' • click to remove' : ' • click to add'}`
                    : isActive ? 'Click to remove this mode from comparison' : 'Click to add this mode to comparison'
                  }
                  className={`px-2 py-0.5 text-xs border transition-colors flex items-center gap-1 ${
                    roundClass
                  } ${isActive ? activeClass : inactiveClass}`}
                >
                  {/* Checkmark for active modes */}
                  {isActive && <span className="text-[9px] leading-none">✓</span>}
                  {label}
                  {showDot && <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotColor}`} />}
                </button>
              );
            })}
            {atCap && (
              <span className="text-[10px] text-amber-500 self-center pl-1" title="3-card limit reached">
                3 max
              </span>
            )}
          </div>
        )}

        <button
          onClick={() => dispatch({ type: 'REMOVE_COUNTRY', code: country.code })}
          className="text-slate-600 hover:text-slate-400 text-sm transition-colors"
          aria-label={`Remove ${country.name}`}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function IncompleteBanner({ country }: { country: CountryConfig }) {
  if (!country.incomplete) return null;
  return (
    <div className="mb-3 text-xs text-amber-400 bg-amber-900/20 border border-amber-800/40 rounded px-3 py-2">
      <strong>Data note:</strong> Tax and SSC breakdown is accurate ({country.dataYear}).
      Pension formula parameters for {country.name} are being verified — pension estimate is approximate.
    </div>
  );
}

export function OSVCBanner({
  country,
  modeName,
  grossMonthly,
}: {
  country: CountryConfig;
  modeName: string | null | undefined;
  grossMonthly: number;
}) {
  if (!modeName) return null;

  const mode = country.selfEmployment?.modes.find(m => m.name === modeName);
  const pd   = mode?.pausalniDan;

  if (pd) {
    // ── Paušální daň banner ─────────────────────────────────────────────────
    const annualGross   = grossMonthly * 12;
    const withinLimit   = annualGross <= pd.annualIncomeLimit;
    const prevBandLimit = country.selfEmployment?.modes.find(
      m => m.pausalniDan?.band === pd.band - 1
    )?.pausalniDan?.annualIncomeLimit ?? 0;
    const aboveMin = annualGross > prevBandLimit;
    const isValid  = withinLimit && (pd.band === 1 || aboveMin);

    return (
      <div className={`mb-3 text-xs rounded px-3 py-2 leading-relaxed border ${
        isValid
          ? 'text-emerald-300 bg-emerald-900/20 border-emerald-700/40'
          : 'text-red-300 bg-red-900/20 border-red-700/40'
      }`}>
        <strong className={isValid ? 'text-emerald-200' : 'text-red-200'}>
          Paušální daň — {pd.bandLabel}
          {isValid ? ' ✓ income within band limit' : ' ✗ income outside band limit'}
        </strong>
        <br />
        Annual income limit: ≤ {pd.annualIncomeLimit.toLocaleString('cs-CZ')} CZK/year
        {pd.band > 1 && ` (above ${prevBandLimit.toLocaleString('cs-CZ')} CZK/year)`}.
        {' '}Your annualised gross: {annualGross.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} CZK.
        <br />
        SSC is paid at fixed band-minimum assessment bases. Income tax replaced by a fixed
        monthly advance of {pd.fixedMonthlyTaxAdvance.toLocaleString('cs-CZ')} CZK.
        Pension entitlement accrues on the social assessment base only.
        {!isValid && (
          <><br /><span className="font-medium">Switch to the correct band to see accurate results.</span></>
        )}
      </div>
    );
  }

  // ── Standard OSVČ banner ─────────────────────────────────────────────────
  return (
    <div className="mb-3 text-xs text-orange-300 bg-orange-900/20 border border-orange-700/40 rounded px-3 py-2 leading-relaxed">
      <strong className="text-orange-200">OSVČ mode — {modeName}</strong>
      <br />
      SSC assessment base = 50% of profit (vyměřovací základ). All contributions
      are self-paid — no employer split. Pension entitlement accrues on the social
      assessment base, not full profit. Sick leave insurance excluded (voluntary for OSVČ).
    </div>
  );
}


// ─── CZ Employer Benefits Panel ──────────────────────────────────────────────────────

function BenefitRow({
  def,
  sel,
  onToggle,
  onAmount,
}: {
  def: EmployerBenefitDef;
  sel: { enabled: boolean; amountMonthly: number };
  onToggle: () => void;
  onAmount: (v: number) => void;
}) {
  const destLabel = def.destination === 'net_pay' ? '\u2192 net pay' : '\u2192 3rd pillar (locked)';
  const destColor = def.destination === 'net_pay' ? 'text-sky-400' : 'text-violet-400';

  return (
    <div className={`rounded-lg border px-3 py-2.5 transition-colors ${
      sel.enabled
        ? def.destination === 'net_pay'
          ? 'border-sky-700/60 bg-sky-950/30'
          : 'border-violet-700/60 bg-violet-950/30'
        : 'border-slate-700/50 bg-slate-800/40'
    }`}>
      {/* Toggle row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onToggle}
            title={sel.enabled ? 'Click to disable' : 'Click to enable'}
            className={`flex-none w-8 h-4.5 rounded-full border transition-colors px-0.5 flex items-center ${
              sel.enabled
                ? def.destination === 'net_pay'
                  ? 'bg-sky-600 border-sky-500'
                  : 'bg-violet-600 border-violet-500'
                : 'bg-slate-700 border-slate-600'
            }`}
            style={{ minWidth: '2rem', height: '1.1rem' }}
          >
            <span className={`inline-block w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
              sel.enabled ? 'translate-x-3.5' : 'translate-x-0'
            }`}
              style={{ width: '0.75rem', height: '0.75rem' }}
            />
          </button>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-200 leading-tight">{def.label}</div>
            <div className="text-xs text-slate-500 leading-tight">{def.labelLocal}</div>
          </div>
        </div>
        <span className={`text-xs flex-none ${destColor}`}>{destLabel}</span>
      </div>

      {/* Amount slider — only when enabled */}
      {sel.enabled && (
        <div className="mt-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">
              {def.legalBasis}
              {def.annualExemptCap != null && (
                <span className="text-slate-600">
                  {' '}— cap {(def.annualExemptCap / 12).toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} CZK/mo
                </span>
              )}
            </span>
            <span className={`text-sm font-mono font-semibold ${
              def.destination === 'net_pay' ? 'text-sky-300' : 'text-violet-300'
            }`}>
              {sel.amountMonthly.toLocaleString('cs-CZ')} CZK/mo
            </span>
          </div>
          <input
            type="range"
            min={def.minAmount}
            max={def.maxAmount}
            step={def.stepAmount}
            value={Math.min(sel.amountMonthly, def.maxAmount)}
            onChange={e => onAmount(Math.min(Math.max(Number(e.target.value), def.minAmount), def.maxAmount))}
            className={`w-full h-1.5 rounded-full appearance-none cursor-pointer ${
              def.destination === 'net_pay' ? 'accent-sky-400' : 'accent-violet-400'
            }`}
          />
          <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
            <span>{def.minAmount.toLocaleString('cs-CZ')} CZK</span>
            <span className={sel.amountMonthly >= def.maxAmount ? (def.destination === 'net_pay' ? 'text-sky-500' : 'text-violet-500') : ''}>
              max {def.maxAmount.toLocaleString('cs-CZ')} CZK
            </span>
          </div>
        </div>
      )}

      {/* Source note — collapsed by default */}
      {sel.enabled && (
        <details className="mt-1.5">
          <summary className="text-[10px] text-slate-600 cursor-pointer select-none hover:text-slate-500">
            Source / legal basis
          </summary>
          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
            {def.sourceNote}{' '}
            <a href={def.sourceUrl} target="_blank" rel="noreferrer"
              className="text-sky-600 hover:text-sky-400 underline">
              zakonyprolidi.cz ↗
            </a>
          </p>
        </details>
      )}
    </div>
  );
}

export function CZBenefitsPanel({
  country,
  result,
  appState,
  dispatch,
}: {
  country: CountryConfig;
  result: ScenarioResult;
  appState: AppState;
  dispatch: React.Dispatch<AppAction>;
}) {
  const benefitsDef = country.employerBenefits;
  if (!benefitsDef?.available) return null;

  const sels = appState.czBenefits;
  const br = result.czBenefitResult;
  const [open, setOpen] = useState(true);

  const activeCount = benefitsDef.benefits.filter(d => sels[d.id].enabled).length;
  const totalCount  = benefitsDef.benefits.length;

  return (
    <div className="mt-4">
      {/* ── Collapsible header ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 text-left group"
      >
        <span className="text-slate-500 text-[10px] select-none">{open ? '▼' : '▶'}</span>
        <h3 className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-2 flex-1">
          Employer Benefits
          <span className="text-slate-600 normal-case">
            — Zaměstnanecké benefity §§6(9) ZDP
          </span>
        </h3>
        {!open && activeCount > 0 && (
          <span className="ml-auto text-[10px] bg-sky-800/60 text-sky-300 px-2 py-0.5 rounded-full">
            {activeCount}/{totalCount} active
          </span>
        )}
        {!open && activeCount === 0 && (
          <span className="ml-auto text-[10px] text-slate-600">all off</span>
        )}
      </button>

      {open && (
      <>
      <div className="text-[10px] text-slate-600 mb-2 mt-1">
        Tax- and SSC-exempt compensation components. Toggle to include in scenario.
      </div>

      <div className="flex flex-col gap-2">
        {benefitsDef.benefits.map(def => (
          <BenefitRow
            key={def.id}
            def={def}
            sel={sels[def.id]}
            onToggle={() =>
              dispatch({
                type: 'SET_CZ_BENEFIT',
                id: def.id,
                enabled: !sels[def.id].enabled,
              })
            }
            onAmount={v =>
              dispatch({
                type: 'SET_CZ_BENEFIT',
                id: def.id,
                amount: v,
              })
            }
          />
        ))}
      </div>

      {/* DPS / 3rd-pillar projection callout */}
      {br && br.pensionContribMonthly > 0 && (
        <div className="mt-2 rounded-lg border border-violet-700/40 bg-violet-950/20 px-3 py-2.5 text-xs">
          <div className="text-violet-300 font-semibold mb-1">
            DPS projection — §6(9)(l) ZDP
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-400">
            <span>Monthly contribution</span>
            <span className="text-right font-mono text-violet-200">
              {br.pensionContribMonthly.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} CZK
            </span>
            <span>Real return (Pillar-2 rate)</span>
            <span className="text-right font-mono text-violet-200">
              {(br.dpsReturnRate * 100).toFixed(1)}%
            </span>
            <span>Pot at retirement</span>
            <span className="text-right font-mono text-violet-200">
              {Math.round(br.dpsPotAtRetirement).toLocaleString('cs-CZ')} CZK
            </span>
            <span>Monthly DPS annuity</span>
            <span className="text-right font-mono text-violet-300 font-semibold">
              {Math.round(br.dpsMonthlyPension).toLocaleString('cs-CZ')} CZK
            </span>
          </div>
          <p className="text-[10px] text-slate-600 mt-1.5">
            Accumulated in real terms at {(br.dpsReturnRate * 100).toFixed(1)}% p.a. net-of-fees (constant prices).
            Annuitised over retirement duration. Contributions locked until retirement.
            Source: zákon č. 427/2011 Sb.
          </p>
        </div>
      )}

      {/* Net benefit summary */}
      {br && br.totalNetAdd > 0 && (
        <div className="mt-2 rounded-lg border border-sky-700/40 bg-sky-950/20 px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-sky-300 font-semibold">
              Net-pay equivalent (tax-free)
            </span>
            <span className="font-mono text-sky-200 font-semibold">
              +{br.totalNetAdd.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} CZK/mo
            </span>
          </div>
          <p className="text-[10px] text-slate-600 mt-0.5">
            Fringe benefits + meal allowance flow directly into take-home with no income
            tax or SSC deductions on either side.
          </p>
        </div>
      )}
      </>
      )}
    </div>
  );
}

export function CountryCard({ country, result, selfEmploymentModeName, appState, dispatch }: Props) {
  const currency = appState.currency;
  const retirementAge =
    appState.careerOverrides.retirementAge ?? country.defaults.retirementAge;

  // All currently active modes for this country (drives the multi-select toggle state)
  const activeModes: (string | null)[] = appState.selfEmploymentModes[country.code] ?? [null];

  // Compute OECD PaG replacement rate when rrSource === 'oecd' and mode is multiplier
  const oecdRR = (() => {
    if (appState.rrSource !== 'oecd') return null;
    if (appState.wageMode.type !== 'multiplier') return null;
    const m = appState.wageMode.value;
    const lookup = lookupOecdRR(country.code, m);
    if (!lookup) return null;
    return { ...lookup, isInterpolated: !isExactOecdMultiple(m) };
  })();

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col min-w-0">
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
        modeName={selfEmploymentModeName}
        grossMonthly={result.resolvedWage.grossLocal}
      />

      {/* ── Employer Benefits panel — only for standard employee mode ── */}
      {country.code === 'CZ' && selfEmploymentModeName === null && (
        <CZBenefitsPanel
          country={country}
          result={result}
          appState={appState}
          dispatch={dispatch}
        />
      )}

      <WageDistributionChart
        country={country}
        selectedWageLocal={result.resolvedWage.grossLocal}
        currency={currency}
        eurExchangeRate={country.eurExchangeRate}
      />

      <KPIRow
        result={result}
        currency={currency}
        countryCurrency={country.currency}
        eurExchangeRate={country.eurExchangeRate}
        czBenefitResult={result.czBenefitResult}
      />

      <EffectiveRates result={result} czBenefitResult={result.czBenefitResult} />

      <PensionRow
        result={result}
        currency={currency}
        countryCurrency={country.currency}
        eurExchangeRate={country.eurExchangeRate}
        oecdRR={oecdRR}
      />

      <WageBreakdownTable
        result={result}
        currency={currency}
        countryCurrency={country.currency}
        eurExchangeRate={country.eurExchangeRate}
      />

      <WagePieChart
        result={result}
        currency={currency}
        countryCurrency={country.currency}
        eurExchangeRate={country.eurExchangeRate}
      />

      <SSCRedistributionTable
        result={result}
        country={country}
        currency={currency}
      />

      <Graph1_CareerTimeline
        result={result}
        currency={currency}
        countryCurrency={country.currency}
        eurExchangeRate={country.eurExchangeRate}
        retirementAge={retirementAge}
        country={country}
      />

      <Graph2_Accumulation
        result={result}
        currency={currency}
        countryCurrency={country.currency}
        eurExchangeRate={country.eurExchangeRate}
        retirementAge={retirementAge}
      />

      <Graph3_ReplacementRateCurve
        country={country}
        result={result}
        careerOverrides={appState.careerOverrides}
        wageMode={appState.wageMode}
      />
    </div>
  );
}
