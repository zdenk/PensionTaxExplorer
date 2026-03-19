/**
 * KPIRow — 3 headline KPI cards per country (§5 spec)
 * PRIMARY: Total Employer Cost | Contract Gross | Net Take-Home
 */

import type { ScenarioResult } from '../types';
import { displayAmount, formatOverhead, formatPct } from '../utils/formatCurrency';

interface Props {
  result: ScenarioResult;
  currency: 'EUR' | 'local';
  countryCurrency: string;
  eurExchangeRate: number;
}

function KPICard({
  label, value, sub, isPrimary, valueColor,
}: {
  label: string;
  value: string;
  sub: string;
  isPrimary?: boolean;
  valueColor?: string;
}) {
  return (
    <div
      className={`rounded-lg px-4 py-3 flex-1 min-w-0 border ${
        isPrimary
          ? 'bg-slate-700 border-slate-500'
          : 'bg-slate-800/60 border-slate-700'
      }`}
    >
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-lg font-semibold font-mono leading-tight ${valueColor ?? 'text-slate-100'}`}>
        {value}
      </p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

export function KPIRow({ result, currency, countryCurrency, eurExchangeRate }: Props) {
  const { sscResult, taxResult } = result;
  const gross = result.resolvedWage.grossLocal;
  const netTakeHome = gross - taxResult.incomeTaxMonthly - sscResult.employeeTotal;
  const overheadPct = formatOverhead(sscResult.totalEmployerCost, gross);
  const netPct = gross > 0 ? `${((netTakeHome / gross) * 100).toFixed(1)}% of gross` : '—';

  // Detect OSVČ mode: no employer SSC pore totalEmployerCost equals gross
  const isOSVC = sscResult.employerTotal === 0 &&
    sscResult.totalEmployerCost === gross;

  const da = (n: number) => displayAmount(n, countryCurrency, currency, eurExchangeRate);

  return (
    <div className="flex gap-2">
      <KPICard
        label={isOSVC ? 'Monthly Profit' : 'Total Employer Cost'}
        value={da(sscResult.totalEmployerCost)}
        sub={isOSVC ? 'All SSC self-paid (no employer)' : `Overhead: ${overheadPct} above gross`}
        isPrimary
        valueColor="text-slate-100"
      />
      <KPICard
        label={isOSVC ? 'Profit Before SSC & Tax' : 'Contract Gross'}
        value={da(gross)}
        sub={result.resolvedWage.referenceLabel}
      />
      <KPICard
        label="Net Take-Home"
        value={da(netTakeHome)}
        sub={netPct}
        valueColor="text-green-400"
      />
    </div>
  );
}

/** Effective rate summary row used inside WageBreakdownTable footer */
export function EffectiveRates({ result }: { result: ScenarioResult }) {
  const gross = result.resolvedWage.grossLocal;
  const { taxResult, sscResult } = result;
  const totalDeductions = taxResult.incomeTaxMonthly + sscResult.employeeTotal;
  const netTakeHome = gross - totalDeductions;

  return (
    <div className="grid grid-cols-3 gap-2 text-center mt-2">
      {[
        { label: 'Effective tax rate', value: formatPct(taxResult.effectiveTaxRate), color: 'text-red-400' },
        { label: 'Marginal tax rate', value: formatPct(taxResult.marginalTaxRate), color: 'text-orange-400' },
        { label: 'Net/gross ratio', value: gross > 0 ? formatPct(netTakeHome / gross) : '—', color: 'text-green-400' },
      ].map(r => (
        <div key={r.label} className="bg-slate-900/40 rounded p-2">
          <p className={`text-sm font-mono font-semibold ${r.color}`}>{r.value}</p>
          <p className="text-xs text-slate-500">{r.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Pension breakdown row ────────────────────────────────────────────────────

interface OecdRR {
  rrPct: number;
  pensionAge: number;
  isP1Only: boolean;
  isInterpolated: boolean;
}

interface PensionRowProps {
  result: ScenarioResult;
  currency: 'EUR' | 'local';
  countryCurrency: string;
  eurExchangeRate: number;
  /** When rrSource === 'oecd': pre-computed OECD PaG value, or null if N/A */
  oecdRR?: OecdRR | null;
}

/**
 * PensionRow — shows estimated monthly pension split by pillar.
 * Single-pillar countries: one card + replacement rate.
 * Mixed countries (PL, SK): Pillar 1 | Pillar 2 DC | Total | Replacement Rate.
 * When oecdRR is provided, the replacement rate KPI switches to the OECD PaG value.
 */
export function PensionRow({ result, currency, countryCurrency, eurExchangeRate, oecdRR }: PensionRowProps) {
  const { pensionResult } = result;
  const { monthlyPension, pillar1Monthly, pillar2Monthly, replacementRate } = pensionResult;
  const hasP2 = pillar2Monthly != null && pillar2Monthly > 0;

  const da = (n: number) => displayAmount(n, countryCurrency, currency, eurExchangeRate);

  // Determine which replacement rate string to display
  const useOecd = oecdRR != null;
  const rrDisplayPct = useOecd ? oecdRR.rrPct : replacementRate * 100;
  const rrStr = `${rrDisplayPct.toFixed(1)}% of gross`;

  // Sub-label for the RR card
  const rrSub = useOecd
    ? `OECD PaG — pension age ${oecdRR.pensionAge}${oecdRR.isInterpolated ? ' (interp.)' : ''}${oecdRR.isP1Only ? ' · P1 only' : ''}`
    : 'of gross wage';

  return (
    <div className="mt-3">
      <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">Pension Estimate</h3>
      <div className="flex gap-2">
        <KPICard
          label={hasP2 ? 'Pillar 1 — State' : 'Monthly Pension'}
          value={da(pillar1Monthly)}
          sub={hasP2 ? 'NDC / Points / DB' : rrStr}
          valueColor="text-sky-400"
        />
        {hasP2 && (
          <KPICard
            label="Pillar 2 — DC"
            value={da(pillar2Monthly!)}
            sub="Funded account"
            valueColor="text-amber-400"
          />
        )}
        <KPICard
          label={hasP2 ? 'Total Pension' : 'Replacement Rate'}
          value={hasP2 ? da(monthlyPension) : `${rrDisplayPct.toFixed(1)}%`}
          sub={hasP2 ? rrStr : rrSub}
          valueColor={hasP2 ? 'text-slate-100' : useOecd ? 'text-violet-400' : 'text-teal-400'}
        />
        {hasP2 && (
          <KPICard
            label="Replacement Rate"
            value={`${rrDisplayPct.toFixed(1)}%`}
            sub={rrSub}
            valueColor={useOecd ? 'text-violet-400' : 'text-teal-400'}
          />
        )}
      </div>
      {useOecd && (
        <p className="text-xs text-violet-500 mt-1">
          ● OECD PaG — tabulated reference rate{oecdRR.isInterpolated ? ' (linearly interpolated between 0.5×/1.0×/2.0× anchor points)' : ''}.
          Model RR: {(replacementRate * 100).toFixed(1)}%.
        </p>
      )}
    </div>
  );
}
