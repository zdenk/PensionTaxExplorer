/**
 * EUMap — EU choropleth map powered by Plotly.js (plotly.js-geo-dist-min bundle).
 *
 * Two traces are layered:
 *   1. Data trace  — all 22 OECD EU countries, coloured by the selected metric.
 *   2. Select trace — countries currently in the comparison, painted sky-blue on top.
 *
 * Clicking any data-country dispatches ADD_COUNTRY (respects the 3-card cap).
 * Plotly's built-in dark-themed hover label shows the metric value.
 */

import { useState, useMemo } from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
// @ts-ignore – geo-dist-min has no separate TS declarations; types come from @types/plotly.js
import Plotly from 'plotly.js-geo-dist-min';
import type { AppState } from '../types';
import type { AppAction } from '../state/appReducer';
import { ALL_COUNTRIES, COUNTRY_MAP } from '../data/countryRegistry';
import { computeScenario } from '../utils/computeScenario';
import { totalActiveCards, MAX_CARDS } from '../state/appReducer';

// Create a Plotly React component backed by the lightweight geo bundle (~1.2 MB).
const Plot = createPlotlyComponent(Plotly);

// ─── ISO-2 → ISO-3 mapping (22 OECD EU countries) ────────────────────────────

const CODE_TO_ISO3: Record<string, string> = {
  AT: 'AUT', BE: 'BEL', CZ: 'CZE', DE: 'DEU', DK: 'DNK',
  EE: 'EST', ES: 'ESP', FI: 'FIN', FR: 'FRA', GR: 'GRC',
  HU: 'HUN', IE: 'IRL', IT: 'ITA', LT: 'LTU', LU: 'LUX',
  LV: 'LVA', NL: 'NLD', PL: 'POL', PT: 'PRT', SE: 'SWE',
  SI: 'SVN', SK: 'SVK',
};

const ISO3_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(CODE_TO_ISO3).map(([k, v]) => [v, k])
);

// ─── Metric types ─────────────────────────────────────────────────────────────

type MapMetric =
  | 'net_take_home'
  | 'net_gross_ratio'
  | 'net_total_cost_ratio'
  | 'replacement_rate'
  | 'state_net_pension'
  | 'actuarial_annuity';

const METRIC_OPTIONS: { value: MapMetric; label: string }[] = [
  { value: 'net_take_home',        label: 'Net take-home' },
  { value: 'net_gross_ratio',      label: 'Net / Gross ratio' },
  { value: 'net_total_cost_ratio', label: 'Net / Total cost ratio' },
  { value: 'replacement_rate',     label: 'Replacement rate' },
  { value: 'state_net_pension',    label: 'State net pension' },
  { value: 'actuarial_annuity',    label: 'Actuarial-equiv. annuity' },
];

function fmtMetric(metric: MapMetric, v: number): string {
  if (!isFinite(v)) return '—';
  if (metric === 'net_gross_ratio' || metric === 'replacement_rate' || metric === 'net_total_cost_ratio')
    return `${(v * 100).toFixed(1)} %`;
  return `€\u202f${Math.round(v).toLocaleString('en-US')} / mo`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

export function EUMap({ state, dispatch }: Props) {
  const [metric,    setMetric]    = useState<MapMetric>('net_gross_ratio');
  const [collapsed, setCollapsed] = useState(false);

  // ── Compute all-country scenarios ─────────────────────────────────────────
  const allScenarios = useMemo(() => {
    const out: Record<string, ReturnType<typeof computeScenario>> = {};
    for (const c of ALL_COUNTRIES) {
      try {
        out[c.code] = computeScenario(
          c, state.wageMode, state.careerOverrides,
          state.awSource, null, undefined, state.fairReturnRate,
        );
      } catch { /* skip */ }
    }
    return out;
  }, [state.wageMode, state.careerOverrides, state.awSource, state.fairReturnRate]);

  // ── Extract metric value per country ──────────────────────────────────────
  const values = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const code of Object.keys(CODE_TO_ISO3)) {
      const r = allScenarios[code];
      if (!r) continue;
      const { grossLocal, grossEUR } = r.resolvedWage;
      const eur = grossLocal > 0 ? grossEUR / grossLocal : 1;
      const net = grossLocal - r.taxResult.incomeTaxMonthly - r.sscResult.employeeTotal;
      let v: number;
      switch (metric) {
        case 'net_take_home':        v = net * eur; break;
        case 'net_gross_ratio':       v = grossLocal > 0 ? net / grossLocal : 0; break;
        case 'net_total_cost_ratio':  v = r.sscResult.totalEmployerCost > 0 ? net / r.sscResult.totalEmployerCost : 0; break;
        case 'replacement_rate':      v = r.pensionResult.replacementRate; break;
        case 'state_net_pension': {
          const p = r.pensionResult.netMonthlyPension ?? r.pensionResult.monthlyPension;
          v = p * eur; break;
        }
        case 'actuarial_annuity': v = r.fairReturn.monthlyAnnuity * eur; break;
        default: continue;
      }
      if (isFinite(v)) map[code] = v;
    }
    return map;
  }, [allScenarios, metric]);

  const selected = new Set(state.selectedCountries);
  const canAdd   = totalActiveCards(state) < MAX_CARDS;

  // ── Build Plotly traces ────────────────────────────────────────────────────
  const { traces, plotLayout } = useMemo(() => {
    const nonSelected = Object.keys(CODE_TO_ISO3).filter(c => !selected.has(c) && values[c] !== undefined);
    const selCodes    = state.selectedCountries.filter(c => CODE_TO_ISO3[c]);

    // Metric extremes (non-selected countries only, so the scale compresses to data)
    const vals  = nonSelected.map(c => values[c]);
    const vMin  = vals.length ? Math.min(...vals) : 0;
    const vMax  = vals.length ? Math.max(...vals) : 1;

    const metricLabel = METRIC_OPTIONS.find(o => o.value === metric)?.label ?? '';
    const isPct = metric === 'net_gross_ratio' || metric === 'replacement_rate' || metric === 'net_total_cost_ratio';

    // Trace 1: metric choropleth for non-selected countries
    const dataTrace: any = {
      type: 'choropleth',
      locationmode: 'ISO-3',
      locations: nonSelected.map(c => CODE_TO_ISO3[c]),
      z:         nonSelected.map(c => values[c]),
      zmin: vMin,
      zmax: vMax,
      text:       nonSelected.map(c => COUNTRY_MAP[c]?.name ?? c),
      customdata: nonSelected.map(c => fmtMetric(metric, values[c])),
      hovertemplate:
        '<b>%{text}</b><br>' +
        metricLabel + ': <b>%{customdata}</b>' +
        (canAdd ? '<br><i style="color:#94a3b8">Click to add</i>' : '') +
        '<extra></extra>',
      colorscale: [
        [0,   'hsl(0,65%,40%)'],
        [0.5, 'hsl(55,65%,40%)'],
        [1,   'hsl(120,65%,40%)'],
      ],
      showscale: true,
      colorbar: {
        thickness: 12,
        len: 0.6,
        x: 1.01,
        tickfont: { color: '#94a3b8', size: 10 },
        title: {
          text: isPct ? '%' : '€/mo',
          font: { color: '#94a3b8', size: 10 },
          side: 'right',
        },
        tickformat: isPct ? '.0%' : ',.0f',
      },
      marker: { line: { color: '#0f172a', width: 0.5 } },
    };

    // Trace 2: selected countries — solid sky-500 overlay
    const selTrace: any = selCodes.length > 0 ? {
      type: 'choropleth',
      locationmode: 'ISO-3',
      locations:  selCodes.map(c => CODE_TO_ISO3[c]),
      z:          selCodes.map(() => 0),
      zmin: 0, zmax: 1,
      colorscale: [[0, '#0ea5e9'], [1, '#0ea5e9']],
      showscale:  false,
      text:       selCodes.map(c => COUNTRY_MAP[c]?.name ?? c),
      customdata: selCodes.map(c =>
        values[c] !== undefined ? fmtMetric(metric, values[c]) : '—'
      ),
      hovertemplate:
        '<b>%{text}</b><br>' +
        metricLabel + ': <b>%{customdata}</b>' +
        '<br><i style="color:#7dd3fc">Selected ✓</i>' +
        '<br><i style="color:#94a3b8">Click to remove</i>' +
        '<extra></extra>',
      marker: { line: { color: '#7dd3fc', width: 2 } },
    } : null;

    const layout: any = {
      paper_bgcolor: 'transparent',
      plot_bgcolor:  'transparent',
      margin: { l: 0, r: 40, t: 0, b: 0 },
      showlegend: false,
      geo: {
        scope: 'europe',
        projection: { type: 'mercator' },
        lonaxis:    { range: [-12, 42] },
        lataxis:    { range: [34, 72] },
        bgcolor:         '#0f172a',
        landcolor:       '#1e293b',
        subunitcolor:    '#0f172a',
        countrycolor:    '#334155',
        showland:        true,
        showcoastlines:  false,
        showframe:       false,
        showsubunits:    false,
        showcountries:   true,
        resolution:      50,
      },
      hoverlabel: {
        bgcolor:    '#1e293b',
        bordercolor:'#475569',
        font: { color: '#e2e8f0', size: 12, family: 'system-ui, sans-serif' },
      },
      dragmode: false,
    };

    return { traces: selTrace ? [dataTrace, selTrace] : [dataTrace], plotLayout: layout };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, metric, state.selectedCountries, canAdd]);

  // ── Click handler ─────────────────────────────────────────────────────────
  function handleClick(event: any) {
    const loc3 = event?.points?.[0]?.location as string | undefined;
    if (!loc3) return;
    const code = ISO3_TO_CODE[loc3];
    if (!code) return;
    if (selected.has(code)) {
      dispatch({ type: 'REMOVE_COUNTRY', code });
    } else if (canAdd) {
      dispatch({ type: 'ADD_COUNTRY', code });
    }
  }

  return (
    <div className="bg-slate-900 border-b border-slate-700">
      {/* Header */}
      <div className="px-4 py-2 flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="text-xs text-slate-500 uppercase tracking-wide hover:text-slate-300 transition-colors flex items-center gap-1 shrink-0"
          aria-expanded={!collapsed}
        >
          <span className="text-[10px]">{collapsed ? '▶' : '▼'}</span>
          EU Map
        </button>

        {!collapsed && (
          <>
            <select
              value={metric}
              onChange={e => setMetric(e.target.value as MapMetric)}
              className="text-xs bg-slate-700 border border-slate-600 text-slate-200 rounded px-2 py-1 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              {METRIC_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <span className="text-xs text-slate-600">Click to add · click again to remove</span>

            {!canAdd && (
              <span className="text-xs text-amber-400">
                Max {MAX_CARDS} cards — remove a country first
              </span>
            )}
          </>
        )}
      </div>

      {/* Map */}
      {!collapsed && (
        <div className="px-2 pb-2">
          <Plot
            data={traces}
            layout={plotLayout}
            config={{
              displayModeBar: false,
              scrollZoom: false,
              staticPlot: false,
            }}
            style={{ width: '100%', height: 360 }}
            onClick={handleClick}
            useResizeHandler
          />
        </div>
      )}
    </div>
  );
}
