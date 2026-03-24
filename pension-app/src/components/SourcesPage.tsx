/**
 * SourcesPage — Data provenance and EUROMOD parameter comparison
 *
 * Shows per-country:
 *   1. Data source references (dataSourceRefs from CountryConfig)
 *   2. EUROMOD parameter map — app current values vs EUROMOD J2.0+ param names
 */

import { useState } from 'react';
import { ALL_COUNTRIES, FLAG } from '../data/countryRegistry';
import { EUROMOD_PARAMS, fmtParamValue, type DiffStatus } from '../data/eurodiffParams';

interface Props {
  onClose: () => void;
}

// ── Section colour badges ────────────────────────────────────────────────────
const SECTION_COLOURS: Record<string, string> = {
  'Income Tax':   'bg-sky-900 text-sky-300 border-sky-700',
  'Employee SSC': 'bg-emerald-900 text-emerald-300 border-emerald-700',
  'Employer SSC': 'bg-violet-900 text-violet-300 border-violet-700',
  'SSC Ceilings': 'bg-amber-900 text-amber-300 border-amber-700',
  'Wages':        'bg-rose-900 text-rose-300 border-rose-700',
};

function sectionBadge(section: string) {
  const cls = SECTION_COLOURS[section] ?? 'bg-slate-700 text-slate-300 border-slate-600';
  return (
    <span className={`inline-block text-xs px-1.5 py-0.5 rounded border font-mono ${cls}`}>
      {section}
    </span>
  );
}

export function SourcesPage({ onClose }: Props) {
  const [selectedCode, setSelectedCode] = useState(ALL_COUNTRIES[0].code);

  const country = ALL_COUNTRIES.find(c => c.code === selectedCode)!;
  const params   = EUROMOD_PARAMS[selectedCode] ?? [];

  // Group params by section for display
  const sections = Array.from(new Set(params.map(p => p.section)));

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="shrink-0 bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 leading-tight">
            Data Sources &amp; EUROMOD Comparison
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            App values for 2026 &middot; EUROMOD J2.0+ policy parameters (policy year 2025) &middot; Last checked 2026-03-23
          </p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 text-xs text-slate-400 hover:text-slate-100 border border-slate-600 hover:border-slate-400 px-3 py-1.5 rounded transition-colors"
        >
          ← Back to explorer
        </button>
      </div>

      {/* ── Country tab bar ──────────────────────────────────────── */}
      <div className="shrink-0 bg-slate-800/60 border-b border-slate-700 overflow-x-auto">
        <div className="flex px-2 pt-1 gap-0.5">
          {ALL_COUNTRIES.map(c => {
            const active = c.code === selectedCode;
            const changedCount = (EUROMOD_PARAMS[c.code] ?? []).filter(p => p.status === 'changed').length;
            return (
              <button
                key={c.code}
                onClick={() => setSelectedCode(c.code)}
                title={c.name}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-t transition-colors border-b-2 ${
                  active
                    ? 'bg-slate-900 text-slate-100 border-sky-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 border-transparent'
                }`}
              >
                <span>{FLAG[c.code]}</span>
                <span className="hidden sm:inline">{c.name}</span>
                <span className="sm:hidden">{c.code}</span>
                {changedCount > 0 && (
                  <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-red-600 text-white text-[9px] font-bold leading-none">
                    {changedCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4 space-y-6">

        {/* ── 1. Data source references ────────────────────────── */}
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Data Sources — {country.name} ({country.dataYear})
          </h3>

          {country.dataSourceRefs.length === 0 ? (
            <p className="text-xs text-slate-600 italic">No source references recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-700">
                    <th className="text-left font-normal pb-2 pr-4 w-48">Parameter</th>
                    <th className="text-left font-normal pb-2 pr-4">Source</th>
                    <th className="text-left font-normal pb-2 pr-4 w-24">Data year</th>
                    <th className="text-left font-normal pb-2 w-32">Retrieved</th>
                    <th className="text-left font-normal pb-2">URL</th>
                  </tr>
                </thead>
                <tbody>
                  {country.dataSourceRefs.map((ref, i) => (
                    <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/40">
                      <td className="py-2 pr-4 text-slate-300 font-mono align-top">{ref.parameter}</td>
                      <td className="py-2 pr-4 text-slate-200 align-top">{ref.source}</td>
                      <td className="py-2 pr-4 text-slate-400 align-top">{ref.dataYear}</td>
                      <td className="py-2 pr-4 text-slate-500 align-top">{ref.retrievedDate}</td>
                      <td className="py-2 align-top">
                        {ref.url ? (
                          <a
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-500 hover:text-sky-300 underline underline-offset-2 break-all"
                          >
                            {ref.url}
                          </a>
                        ) : (
                          <span className="text-slate-600 italic">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── 2. EUROMOD parameter comparison ─────────────────── */}
        <section>
          <div className="flex items-baseline gap-3 mb-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              EUROMOD Parameter Map — {country.name}
            </h3>
            <span className="text-xs text-slate-600">
              Source: EUROMOD J2.0+ policy parameters Excel · policy year 2025
            </span>
          </div>

          {params.length === 0 ? (
            <div className="bg-slate-800/50 rounded-lg p-4 text-xs text-slate-500 italic">
              No EUROMOD parameter mapping defined for {country.name} yet.
              To add one, create an entry in{' '}
              <code className="text-slate-400">scripts/euromod/parameterMap.ts</code>
              {' '}and mirror it in{' '}
              <code className="text-slate-400">src/data/eurodiffParams.ts</code>.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 mb-1">
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[9px]">Legend:</span>
                <span><StatusBadge status="match" /> Match</span>
                <span><StatusBadge status="changed" /> Action required</span>
                <span><StatusBadge status="year_gap" /> Year gap (expected)</span>
                <span><StatusBadge status="not_in_euromod" /> Not in EUROMOD Excel</span>
              </div>
              {sections.map(section => {
                const entries = params.filter(p => p.section === section);
                return (
                  <div key={section}>
                    <div className="mb-2">{sectionBadge(section)}</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="text-slate-500 border-b border-slate-700">
                            <th className="text-left font-normal pb-1.5 pr-2 w-6">St</th>
                            <th className="text-left font-normal pb-1.5 pr-4 w-56">Parameter label</th>
                            <th className="text-left font-normal pb-1.5 pr-4 w-40">EUROMOD param</th>
                            <th className="text-right font-normal pb-1.5 pr-4 w-28">App value (2026)</th>
                            <th className="text-left font-normal pb-1.5">Notes / known diff vs EUROMOD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map((entry, i) => {
                            const appValue = (() => {
                              try { return entry.appResolver(country); }
                              catch { return NaN; }
                            })();
                            const hasNote = Boolean(entry.note);
                            const rowHighlight = entry.status === 'changed'
                              ? 'bg-red-950/20'
                              : entry.status === 'year_gap'
                              ? 'bg-amber-950/10'
                              : hasNote
                              ? 'bg-amber-950/10'
                              : '';
                            return (
                              <tr
                                key={i}
                                className={`border-b border-slate-800/70 hover:bg-slate-800/30 ${rowHighlight}`}
                              >
                                <td className="py-1.5 pr-2 align-top">
                                  <StatusBadge status={entry.status} />
                                </td>
                                <td className="py-1.5 pr-4 text-slate-200 align-top">{entry.label}</td>
                                <td className="py-1.5 pr-4 font-mono text-slate-400 align-top whitespace-nowrap">
                                  {entry.emParam}
                                </td>
                                <td className="py-1.5 pr-4 text-right font-mono align-top whitespace-nowrap">
                                  {isNaN(appValue) ? (
                                    <span className="text-slate-600">—</span>
                                  ) : (
                                    <span className="text-emerald-400">
                                      {fmtParamValue(appValue, entry.displayUnit)}
                                    </span>
                                  )}
                                </td>
                                <td className="py-1.5 text-slate-500 align-top leading-relaxed">
                                  {entry.note ? (
                                    <span className={
                                      entry.status === 'changed'
                                        ? 'text-red-400/90'
                                        : entry.status === 'not_in_euromod'
                                        ? 'text-slate-500'
                                        : 'text-amber-400/80'
                                    }>{entry.note}</span>
                                  ) : (
                                    <span className="text-slate-700">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 3. Pension system summary ────────────────────────── */}
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Pension System — {country.name}
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <DataPill label="System type" value={country.pensionSystem.type} />
            <DataPill label="Currency" value={country.currency} />
            <DataPill label="Data year" value={String(country.dataYear)} />
            <DataPill label="Retirement age" value={`${country.defaults.retirementAge} yrs`} />
            {country.averageWage && (
              <DataPill
                label="Average wage"
                value={`${country.averageWage.toLocaleString()} ${country.currency}/mo`}
              />
            )}
            {country.minimumWage && (
              <DataPill
                label="Minimum wage"
                value={`${country.minimumWage.toLocaleString()} ${country.currency}/mo`}
              />
            )}
            {country.pensionTax && (
              <DataPill
                label="Pension tax method"
                value={country.pensionTax.method === 'income_tax' ? 'Ordinary income' : 'Exempt'}
              />
            )}
            {country.incomplete && (
              <DataPill label="Status" value="Incomplete parameters ⚠" highlight />
            )}
          </div>
          {country.pensionTax?.note && (
            <p className="mt-2 text-xs text-slate-500 italic">{country.pensionTax.note}</p>
          )}
        </section>

        {/* Bottom padding */}
        <div className="h-8" />
      </div>
    </div>
  );
}

// ── Status badge ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: DiffStatus }) {
  if (!status || status === 'match') {
    return <span className="text-emerald-500 text-xs" title="Matches EUROMOD">&#10003;</span>;
  }
  if (status === 'changed') {
    return (
      <span
        className="inline-block text-[9px] font-bold px-1 py-0 rounded bg-red-700/60 text-red-200 border border-red-600 leading-4"
        title="Action required — app value differs from EUROMOD"
      >
        !
      </span>
    );
  }
  if (status === 'year_gap') {
    return (
      <span
        className="inline-block text-[9px] font-bold px-1 py-0 rounded bg-amber-800/50 text-amber-300 border border-amber-700 leading-4"
        title="Year gap — verify on next EUROMOD release"
      >
        &#8987;
      </span>
    );
  }
  // not_in_euromod
  return (
    <span
      className="inline-block text-[9px] font-bold px-1 py-0 rounded bg-slate-700/40 text-slate-500 border border-slate-600 leading-4"
      title="Not present in EUROMOD Excel"
    >
      n/a
    </span>
  );
}

// ── Tiny helper ──────────────────────────────────────────────────────────────
function DataPill({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2">
      <div className="text-xs text-slate-500 mb-0.5">{label}</div>
      <div className={`text-sm font-mono ${highlight ? 'text-amber-400' : 'text-slate-200'}`}>
        {value}
      </div>
    </div>
  );
}
