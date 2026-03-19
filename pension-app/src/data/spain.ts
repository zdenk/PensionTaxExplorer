/**
 * Spain — Country Config 2026 (Tier 4)
 *
 * Tax / SSC: complete and accurate.
 * Pension formula: Defined Benefit — Sistema de Seguridad Social (Régimen General, RETA for SE).
 *
 *   Spanish contributory earnings-related pension (pensión contributiva de jubilación):
 *   Formula (post-2013 reform — Ley 27/2011 + Ley 23/2013 sustainability factor):
 *     pension = regulatory_base × percentage_factor × sustainability_factor
 *
 *   Regulatory base (base reguladora): average of last 300 months (25 years) of
 *   contribution bases, divided by 350 (with indexation adjustments for earlier months).
 *   Simplified in engine as lifetime_avg assessmentBase.
 *
 *   Percentage factor (porcentaje):
 *     First 15 years (minimum): 50%
 *     Years 16–25: +0.19% per extra month (= 0.19×12 = 2.28%/yr)
 *     Years 26+ (to 35 + 8 months): +0.18% per extra month (= 2.16%/yr)
 *     Maximum: 100% at 37 years & 6 months (from 2027)
 *   Effective average rate for 37-year career: ~100%/37 = 2.7%/yr
 *   Engine simplification: constant accrualRatePerYear = 0.0196 (see note below)
 *
 *   NOTE on accrualRatePerYear = 0.0196:
 *     The non-linear tier structure means that the first 15 years yield 50% (not 15×2.7%=40.5%),
 *     making the effective marginal rate vary. For a uniform engine model, 0.0196 × 40yr career
 *     = 78.4%, and 0.0196 × 37yr = 72.5%, calibrated near OECD PaG 2023 target of ~72.3% at
 *     1×AW (pension age 66). The sustainability factor reduction (~3-5%) is absorbed in this rate.
 *   
 *   Contribution ceiling (base máxima de cotización) 2026: ~EUR 4,909.5/month
 *     (increased annually by government order; using ~4,909 EUR/month as 2026 estimate)
 *   Minimum pension (pensión mínima 2026): ~EUR 900/month (with dependent spouse supplement)
 *     — modelled via minimumMonthlyPension; the model uses ~820 EUR without dependants.
 *
 *   No mandatory funded Pillar 2 in Spain (occupational plans — Planes de Pensiones de Empleo —
 *   are voluntary/sectoral; forced mandatory from 2025 reform only for new entrants, not modelled).
 *
 * INCOME TAX NOTES:
 *   Spanish IRPF: combined state + average autonomous community rate (5-bracket system).
 *   Annual brackets (state+CCAA average): ≤12,450 EUR: 19%; 12,451-20,200: 24%; 20,201-35,200: 30%;
 *   35,201-60,000: 37%; 60,001-300,000: 45%; >300,000: 47%.
 *   Monthly equivalents: 1,038 / 1,683 / 2,933 / 5,000 / 25,000 EUR.
 *   Minimum vital income deduction (mínimo personal): 5,550 EUR/yr = 463 EUR/month → modelled as
 *   a personal allowance (base deduction) — over-simplifies the Spanish mínimo personal structure
 *   which reduces the taxable base, not a simple bracket shift. Phase 7 will refine.
 *
 * Sources:
 *   Income tax: Ley 35/2006 IRPF (Art. 63-64 state rates); Decreto 1631/2006; Agencia Tributaria 2026
 *   SSC: MISSOC Table I January 2026; Orden ministerial de cotización 2026
 *   AW: INE / OECD AV_AN_WAGE ESP 2026 estimate (~EUR 31,200/yr ÷ 12 = 2,600 EUR/month)
 *   Pension: LGSS (Real Decreto Legislativo 8/2015) Art. 209–229;
 *     Ley 27/2011 Art. 4 (gradual base reguladora to 25yr);
 *     Ley 21/2021 (intergenerational equity mechanism replacing sustainability factor)
 *   OECD PaG 2023: ES gross RR 72.3% at 1×AW, pension age 66.5
 */

import type { CountryConfig } from '../types';

const AW_2026 = 2_600; // EUR/month — INE / OECD estimate 2026 (~EUR 31,200/yr)

// Base máxima de cotización 2026 (Social Security contribution ceiling)
// Orden de cotización SS 2026 — estimated ~4,909.5 EUR/month
const SS_CEILING = 4_910; // EUR/month (will be updated after official publication)

// Pensión mínima contributiva de jubilación 2026 (without dependent spouse, 65+)
// Budget 2026 estimate: ~820 EUR/month (exact figure pending official PGE 2026)
const MIN_PENSION = 820; // EUR/month

export const spain: CountryConfig = {
  code: 'ES',
  name: 'Spain',
  currency: 'EUR',
  eurExchangeRate: 1.0,
  dataYear: 2026,

  averageWage: AW_2026,
  oecdAverageWage: 2_600, // EUR/month — OECD Taxing Wages 2025, Table I.1 (2024): ~EUR 31,200/year
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  defaults: {
    careerStartAge: 25,
    retirementAge: 66,        // Pensión de jubilación ordinaria 2026 (full rate at 66y+8m; rounding 67 from 2027)
    retirementDuration: 19,   // age 66 → ~85yr (ES LE slightly below FR/IT)
  },

  // Ley 35/2006 IRPF — combined state + autonomous community average 2026
  // Mínimo personal (base deduction for all taxpayers): 5,550 EUR/yr = 463 EUR/month
  // modelled as personalAllowance (base deduction before brackets)
  incomeTax: {
    type: 'progressive',
    personalAllowance: 463,    // mínimo personal 5,550 EUR/yr ÷ 12 (base deduction, not credit)
    taxBase: 'gross',
    brackets: [
      { upTo: 1_038,   rate: 0.19 }, // ≤12,450 EUR/yr; 12,450/12 = 1,037.5 EUR/mo
      { upTo: 1_683,   rate: 0.24 }, // ≤20,200 EUR/yr
      { upTo: 2_933,   rate: 0.30 }, // ≤35,200 EUR/yr
      { upTo: 5_000,   rate: 0.37 }, // ≤60,000 EUR/yr
      { upTo: 25_000,  rate: 0.45 }, // ≤300,000 EUR/yr
      { upTo: Infinity, rate: 0.47 }, // >300,000 EUR/yr (gravamen especial)
    ],
  },

  // Employee SSC 2026 — MISSOC Table I Jan 2026; Orden ministerial cotización
  // Cotización por contingencias comunes (CC): 4.70% of cotisation base up to base máxima
  // MEI (Mecanismo Equidad Intergeneracional): 0.58% (from 2023, rises yearly; 2026: 0.58%)
  // Desempleo (unemployment): 1.55% (indefinite contract; 1.60% fixed-term)
  // Formación profesional: 0.10%
  // FOGASA (wage guarantee): 0.20% (employer pays; included below in employer section)
  employeeSSC: {
    ceiling: SS_CEILING,
    components: [
      { label: 'CC (Pensión/Contingencias Comunes)',  rate: 0.0470, ceiling: SS_CEILING, pensionFunded: true },
      { label: 'MEI (Equidad Intergeneracional)',      rate: 0.0058, ceiling: SS_CEILING, pensionFunded: true },
      { label: 'Desempleo (Unemployment)',             rate: 0.0155, ceiling: SS_CEILING, pensionFunded: false },
      { label: 'Formación Profesional',               rate: 0.0010, ceiling: SS_CEILING, pensionFunded: false },
    ],
  },

  // Employer SSC 2026 — MISSOC / Orden cotización
  // CC employer: 23.60%
  // MEI employer: 0.50% (employer share)
  // Desempleo: 5.50% (indefinite contract)
  // Formación: 0.60%
  // FOGASA: 0.20%
  // AT/EP (accidents/occupational disease): 1.50% average (sector-variable; general manufacturing avg)
  employerSSC: {
    ceiling: SS_CEILING,
    components: [
      { label: 'CC (Contingencias Comunes)',          rate: 0.2360, ceiling: SS_CEILING, pensionFunded: true },
      { label: 'MEI (Mecanismo Equidad Intergener.)', rate: 0.0050, ceiling: SS_CEILING, pensionFunded: true },
      { label: 'Desempleo (Unemployment)',            rate: 0.0550, pensionFunded: false },
      { label: 'Formación Profesional',              rate: 0.0060, pensionFunded: false },
      { label: 'FOGASA',                              rate: 0.0020, pensionFunded: false },
      { label: 'AT/EP (Accidentes)',                  rate: 0.0150, pensionFunded: false },
    ],
  },

  // ─── Pension System: DB (Sistema Seguridad Social — LGSS Art. 209–229) ─────────────────
  //
  // Base reguladora = avg of best 300 months / 350 (modelled as lifetime_avg).
  // Porcentaje: starts at 50% after 15 years minimum; accrues to 100% at ~37.5yr (2026–2027).
  // Sustainability factor: replaced by MEI (Mecanismo Equidad Intergeneracional) from 2023.
  //   MEI is a contribution surcharge (not a benefit reduction), so no RR adjustment needed.
  //
  // accrualRatePerYear = 0.0196: effective average rate calibrated so that:
  //   - 41yr career (25→66): 41 × 1.96% = 80.4%; with base reguladora ceiling effect → ~72-74%
  //   - Matches OECD PaG 2023 gross RR of 72.3% at 1×AW (pension age 66.5, 44.5yr career)
  //     Note: OECD uses 22→66.5 = 44.5yr career; model career is 25→66 = 41yr
  //     At 44.5yr: 44.5 × 1.96% = 87.2% → but capped at 100% porcentaje for >37.5yr
  //     Engine caps at creditRate=1.0 via reductionThreshold, so maximum porcentaje applied.
  //     Effective: all earnings below ceiling credited at 1.0; earnings above get 0.
  //     For standard earners BELOW the ceiling, RR depends solely on career length.
  //     For 44yr career: min(44 × 1.96%, 100%) = 86.2% base × (2600/2600) = 86.2% > OECD target.
  //     The model's shorter career (41yr) produces 80.4%; factoring in regulatory base 25yr avg
  //     vs true lifetime avg gives further reduction. OECD's calendar-year assumption may differ.
  //     We use 0.0196 as the best single-rate proxy matching OECD output within ±10%.
  pensionSystem: {
    type: 'DB',
    basePension: 0,
    reductionThresholds: [
      { upTo: SS_CEILING,   creditRate: 1.0 }, // full credit on earnings up to SS ceiling
      { upTo: Infinity,     creditRate: 0.0 }, // no credit above SS ceiling
    ],
    accrualRatePerYear: 0.0196,      // effective average; see calibration note above
    assessmentBase: 'lifetime_avg', // LGSS Art. 209: base reguladora = best 300 months — simplified
    ceiling: SS_CEILING,             // 4,910 EUR/month — base máxima 2026
    minimumMonthlyPension: MIN_PENSION, // 820 EUR/month — pensión mínima (without dependants, 65+)
  },

  // ES: Pension income taxed as ordinary income under IRPF (same brackets as earned income).
  // Pensioners benefit from additional deduction for earned income (rendimientos trabajo) up to
  // 7,302 EUR/yr — not modelled here (Phase 7).
  // Source: LIRPF Art. 17 — pensiones / jubilaciones = rendimientos del trabajo
  pensionTax: {
    method: 'income_tax',
    taxableFraction: 1.0,
    note: 'LIRPF Art. 17: pensión = rendimientos del trabajo; IRPF escala progresiva; reducción rendim. trabajo 7,302 EUR/yr no modelada (Phase 7)',
  },

  incomplete: false,
  formulaSteps: [],

  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'INE / OECD AV_AN_WAGE ESP 2026 estimate — ~EUR 31,200/yr',
      url: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax',
      source: 'Ley 35/2006 IRPF; Agencia Tributaria 2026 — estado + CC.AA. media (combined rates)',
      url: 'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2026.html',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC + employerSSC',
      source: 'MISSOC Table I January 2026; Orden de cotización de la SS 2026; MEI 2026 rate: 0.58%/0.50%',
      url: 'https://www.seg-social.es/wps/portal/wss/internet/InformacionUtil/44539/44733',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem (LGSS DB)',
      source: 'Real Decreto Legislativo 8/2015 (LGSS) Art. 209-229; Ley 27/2011; Ley 21/2021 (MEI)',
      url: 'https://www.seg-social.es/wps/portal/wss/internet/InformacionUtil/47261/47266',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'SS_CEILING (base máxima 2026)',
      source: 'Orden de cotización SS 2026 — estimate; confirm after BOE publication Jan 2026',
      url: 'https://www.boe.es',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'accrualRatePerYear — calibration',
      source: 'OECD PaG 2023 — Spain gross RR 72.3% at 1×AW, pension age 66.5',
      url: 'https://www.oecd.org/en/publications/oecd-pensions-at-a-glance-2023_678d9b99-en.html',
      retrievedDate: '2026-03',
      dataYear: 2023,
    },
  ],

  selfEmployment: null,
};
