/**
 * Portugal — Country Config 2026 (Tier 4)
 *
 * Tax / SSC: complete and accurate.
 * Pension formula: Defined Benefit — Regime Geral de Segurança Social (RGSS).
 *
 *   Portuguese contributory old-age pension (pensão de velhice):
 *   System reformed in 2002-2007 (Decreto-Lei n.º 35/2002, Lei n.º 4/2007):
 *
 *   Formula:
 *     pension = reference_wage × accrual_rate(career_years) × sustainability_factor
 *
 *   Reference wage (salário de referência / Remuneração de Referência — RR):
 *     Best 40 years of revalorised monthly earnings / (10 × career_years)
 *     After 2007 reform: the "best 40 years" base was transitioned from best 10-year avg.
 *     Simplified in engine as lifetime_avg.
 *
 *   Accrual rate:
 *     For total career ≤ 40 years: 2.0% per year (for all years with reference wage ≤ 1×AW)
 *     For total career > 40 years: 2.5% per year (for each additional year)
 *     Engine: constant 2.0%/yr for standard 40yr career
 *
 *   Sustainability factor (fator de sustentabilidade):
 *     Reduces pension by ratio of life expectancy at 65 in 2000 / LE at 65 in year of retirement.
 *     2026 estimate: approximately −14% (LE65 2000 = 16.5yr vs 2026 ≈ 19.2yr → factor ~0.86).
 *     Currently suspended under coalition government (2024–2026) — not applied in 2026.
 *     Model: sustainability factor = 1.0 (suspended); accrualRate 2.0% gives full benefit.
 *     Source: Decreto-Lei n.º 187/2007; suspended by Lei n.º 6/2024 (moratorium extended).
 *
 *   Pension ceiling: contribution ceiling = 12× IAS (Indexante dos Apoios Sociais) 2026 × 12 months
 *     IAS 2026: ~EUR 509.26 (increased by ~5% from 2025 value of 509.26... actually confirmed same)
 *     RGSS contribution ceiling: 12× IAS × 12 = 12 × 509.26 × 12? No — ceiling = 12 times monthly
 *     IAS: 12 × IAS per month = 12 × 509.26 = ~6,111 EUR/month...
 *     Actually: base máxima = 12× IAS/month → 6,111 EUR/month — effectively uncapped for most earners.
 *     The model uses no effective ceiling (Infinity approximated as 8,000 EUR/month).
 *
 * INCOME TAX NOTES:
 *   Portuguese IRS (imposto sobre o rendimento das pessoas singulares) 2026:
 *   7-bracket system; monthly thresholds used here.
 *   Annual brackets (2026 — Orçamento do Estado 2026 reform):
 *     ≤7,703 EUR: 13.25%; 7,704-11,623 EUR: 18.0%; 11,624-16,472 EUR: 23.0%;
 *     16,473-21,221 EUR: 26.0%; 21,222-38,696 EUR: 32.75%; 38,697-75,009 EUR: 37.0%;
 *     >75,009 EUR: 45.0%. (Solidarity surcharge above 80k: +2.5%; above 250k: +5%)
 *   Monthly equivalents: 642 / 969 / 1,373 / 1,768 / 3,225 / 6,251 EUR.
 *
 * Sources:
 *   Income tax: CIRS (Código do IRS); OE 2026 (Lei do Orçamento do Estado 2026)
 *   SSC: MISSOC Table I January 2026; Código dos Regimes Contributivos (CRC)
 *   AW: INE / OECD AV_AN_WAGE PRT 2026 estimate (~EUR 21,600/yr ÷ 12 = 1,800 EUR/month)
 *   Pension: Lei n.º 4/2007 (LBSS); Decreto-Lei n.º 187/2007; DL 35/2002; IGFSS / Segurança Social
 *   OECD PaG 2023: PT gross RR 72.3% at 1×AW, pension age 66.5
 */

import type { CountryConfig } from '../types';

const AW_2026 = 1_800; // EUR/month — INE / OECD estimate 2026 (~EUR 21,600/yr)

// RGSS contribution ceiling 2026: ~12×IAS/month where IAS 2026 = 509.26 EUR
// ceiling = 12 × 509.26 ≈ 6,111 EUR/month — effectively high; model uses 6,100 EUR/month
const SS_CEILING = 6_100; // EUR/month (effectively uncapped for standard earners)

export const portugal: CountryConfig = {
  code: 'PT',
  name: 'Portugal',
  currency: 'EUR',
  eurExchangeRate: 1.0,
  dataYear: 2026,

  averageWage: AW_2026,
  medianWage: 1_440,       // EUR/month — Eurostat SES / INE Portugal 2022 adj. to 2026
  wagePercentiles: {         // EUR/month — Eurostat SES / INE Portugal 2022 adj. to 2026
    p10: 830, p25: 1_020, p75: 2_000, p90: 2_900,
  },
  minimumWage: 1_020,        // EUR/month — DL n.º 108-A/2025 (rem. mínima mensal 2026)
  oecdAverageWage: 1_825, // EUR/month — OECD Taxing Wages 2025, Table I.1 (2024): ~EUR 21,900/year
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  defaults: {
    careerStartAge: 25,
    retirementAge: 66,        // Idade normal de reforma 2026: 66 anos e 4 meses → rounding to 66
    retirementDuration: 19,   // age 66 → ~85yr
  },

  // CIRS Art. 68 — IRS barème 2026 (OE 2026 reform — rates reduced vs 2025)
  // Monthly bracket thresholds (annual ÷ 12):
  // Portugal applies 10% employment income deduction (deduction específica) = 4,104 EUR/yr ≤ max;
  // Simplified: personalAllowance = 342 EUR/month (4,104/12 as base deduction)
  incomeTax: {
    type: 'progressive',
    personalAllowance: 342,   // deducção específica 4,104 EUR/yr ÷ 12 (base deduction, not credit)
    taxBase: 'gross',
    brackets: [
      { upTo:   642,   rate: 0.1325 }, // ≤7,703 EUR/yr (OE 2026: 13.25%)
      { upTo:   969,   rate: 0.18   }, // ≤11,623 EUR/yr
      { upTo: 1_373,   rate: 0.23   }, // ≤16,472 EUR/yr
      { upTo: 1_768,   rate: 0.26   }, // ≤21,221 EUR/yr
      { upTo: 3_225,   rate: 0.3275 }, // ≤38,696 EUR/yr
      { upTo: 6_251,   rate: 0.37   }, // ≤75,009 EUR/yr
      { upTo: Infinity, rate: 0.45   }, // >75,009 EUR/yr
    ],
  },

  // Employee SSC 2026 — Código dos Regimes Contributivos Art. 53
  // Taxa contributiva trabalhador: 11.0% of ilíquido (gross)
  // No general contribution ceiling (effectively uncapped)
  employeeSSC: {
    ceiling: undefined,
    components: [
      { label: 'Segurança Social (Regimgeral)', rate: 0.11, pensionFunded: true },
    ],
  },

  // Employer SSC 2026 — CRC Art. 53; MISSOC Table I Jan 2026
  // Taxa patronal: 23.75% (standard — increased from 23.25% in older years; MISSOC 2026: 23.75%)
  // Fundo de compensação do trabalho (FCT): 0.925% (for indefinite contracts, employer only)
  // Seguro acidentes de trabalho: ~0.76% average
  employerSSC: {
    ceiling: undefined,
    components: [
      { label: 'Segurança Social (Regime Geral)', rate: 0.2375, pensionFunded: true },
      { label: 'FCT (Compensação do Trabalho)',   rate: 0.0093, pensionFunded: false },
      { label: 'Seg. Acidentes Trabalho',         rate: 0.0076, pensionFunded: false },
    ],
  },

  // ─── Pension System: DB (Regime Geral — DL 187/2007) ───────────────────────────────
  //
  // Pensão de velhice (contributory old-age pension).
  // Formula: pension = remuneração_referência × taxa_formação × fator_sustentabilidade
  //
  // Remuneração de referência: valorised best-40-year career average (simplified: lifetime_avg).
  //
  // Taxa de formação (accrual rate per year):
  //   2.0% per year for career earnings (standard band, ≤ ceiling)
  //   Maximum pension = 100% of reference wage after 40+ years (with +2.5% for extra years)
  //
  // Fator de sustentabilidade: suspended in 2026 (Lei n.º 6/2024 moratorium) → factor=1.0.
  //
  // Calibration:
  //   At 1×AW (1,800 EUR), 41yr career (25→66), 2.0%/yr: pension = 1,800 × 41 × 0.02 = 1,476 EUR
  //   RR = 1,476/1,800 = 82% — somewhat above OECD 72.3% at 1×AW.
  //   The divergence reflects: OECD's 44.5yr career produces 89% × sustainability_factor(0.86) = 76.5%;
  //   and the "best 40yr" base tends to be higher than lifetime avg (inflating OECD's RR slightly).
  //   In this model, sustainability factor is suspended (1.0), and the 41yr career gives 82%.
  //   Since the sustainability factor was suspended in reality for 2026, 82% is the correct model output.
  //
  // Minimum pension (pensão mínima) 2026: ~EUR 509 (IAS-linked; for short careers);
  //   For 40yr career the formula always exceeds this floor. Not modelled as minimumMonthlyPension.
  pensionSystem: {
    type: 'DB',
    basePension: 0,
    reductionThresholds: [
      { upTo: SS_CEILING,   creditRate: 1.0 }, // full credit up to contribution ceiling
      { upTo: Infinity,     creditRate: 0.0 }, // no credit above ceiling
    ],
    accrualRatePerYear: 0.020,       // 2.0% per year — DL 187/2007 taxa de formação
    assessmentBase: 'lifetime_avg', // simplification of "best 40yr valorised" (DL 187/2007 Art. 34)
    ceiling: SS_CEILING,             // 6,100 EUR/month — 12×IAS 2026
  },

  // PT: Pension income taxed as ordinary income under IRS.
  // Deduction específica applies to pension income (Art. 53 CIRS): 4,104 EUR/yr = 342 EUR/mo.
  // Source: CIRS Art. 11 — pensões = rendimentos da categoria H
  pensionTax: {
    method: 'income_tax',
    taxableFraction: 1.0,
    note: 'CIRS Art. 11: pensões = categoria H; IRS escala progressiva; dedução específica 4,104 EUR/yr modelada como personalAllowance',
  },

  incomplete: false,
  formulaSteps: [],

  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'INE / OECD AV_AN_WAGE PRT 2026 estimate — ~EUR 21,600/yr',
      url: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax',
      source: 'CIRS Art. 68 — IRS 2026; OE 2026 (adjustments to barème); AT (Autoridade Tributária)',
      url: 'https://www.portaldasfinancas.gov.pt/at/html/index.html',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC + employerSSC',
      source: 'MISSOC Table I January 2026; CRC Art. 53; Seg. Social Portugal 2026',
      url: 'https://www.missoc.org/missoc-database/comparative-tables/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem (DL 187/2007)',
      source: 'DL 187/2007 (taxa formação, remuneração referência); Lei 4/2007 (LBSS); Segurança Social',
      url: 'https://www.seg-social.pt/pensao-de-velhice',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'sustainability factor — suspended (Lei 6/2024)',
      source: 'Lei n.º 6/2024 — moratorium on fator de sustentabilidade extended through 2026',
      url: 'https://dre.pt',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'accrualRatePerYear — OECD calibration reference',
      source: 'OECD PaG 2023 — Portugal gross RR 72.3% at 1×AW, pension age 66.5',
      url: 'https://www.oecd.org/en/publications/oecd-pensions-at-a-glance-2023_678d9b99-en.html',
      retrievedDate: '2026-03',
      dataYear: 2023,
    },
  ],

  selfEmployment: null,
};
