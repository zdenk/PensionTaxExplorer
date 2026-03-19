/**
 * CountryCard — full per-country panel (§5 spec)
 * Phase 2: Header + KPIRow + WageBreakdownTable + SSCRedistributionTable
 * Phase 3: Graph1_CareerTimeline + Graph2_Accumulation
 */

import type { CountryConfig, AppState, ScenarioResult, SelfEmploymentMode } from '../types';
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

function CountryHeader({
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
                  onClick={() => dispatch({ type: 'SET_SELF_EMPLOYMENT_MODE', countryCode: country.code, modeName: name })}
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

function IncompleteBanner({ country }: { country: CountryConfig }) {
  if (!country.incomplete) return null;
  return (
    <div className="mb-3 text-xs text-amber-400 bg-amber-900/20 border border-amber-800/40 rounded px-3 py-2">
      <strong>Data note:</strong> Tax and SSC breakdown is accurate ({country.dataYear}).
      Pension formula parameters for {country.name} are being verified — pension estimate is approximate.
    </div>
  );
}

function OSVCBanner({
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
      />

      <EffectiveRates result={result} />

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
