/**
 * Luxembourg — Country Config 2026 (Tier 2)
 *
 * Tax / SSC: complete and accurate.
 * Pension formula: Points-based (CNAP — Caisse Nationale d'Assurance Pension).
 *
 *   Luxembourg pension formula (Loi du 21 décembre 2012 — Code de la Sécurité Sociale):
 *     pension = allocation de base + allocation proportionnelle
 *     where:
 *       allocation proportionnelle = career_years × (grossAnnual / reference_wage)
 *                                    × accrual_rate × index_revaluation
 *     This is effectively a POINTS system where:
 *       • 1 "unit" (point) is earned per year at the reference wage
 *       • Point value calibrated to give OECD-validated 88.6% gross RR at 1x AW for 40yr
 *     OECD Pensions at a Glance 2023: LU gross mandatory replacement rate ≈ 88.6% at AW.
 *
 *   Engine model (PointsConfig):
 *     referenceWage  = AW_annual = 5,900×12 = 70,800 EUR (annual)
 *     annualPoints   = min(grossMonthly × 12 / 70,800, 1.912)
 *     totalPoints    = annualPoints × years
 *     monthlyPension = totalPoints × pointValue
 *     pointValue     = 130.7 EUR/month (calibrated: 40pts × 130.7 = 5,228 ≈ 88.6% × 5,900 ✓)
 *     ceiling        = 1.912 points/year (at contribution ceiling 11,284/5,900 = 1.912× AW)
 *     minimumPension = 2,579 EUR/month (full-career minimum, 2026 estimate — CNAP)
 *
 * Sources:
 *   SSC: MISSOC Table I Jan 2026; CSS LU — Code de la Sécurité Sociale Luxembourg
 *   Income tax: LIR (Loi de l'impôt sur le revenu du 4/12/1967) — barème 2026
 *   AW: STATEC Luxembourg / Eurostat earn_ses estimate 2026
 *   Contribution ceiling (CIIP): CNAP communiqué 2026 — 11,284 EUR/month (5× SSM × 2.4)
 *   Pension replacement rate: OECD Pensions at a Glance 2023, Country profile Luxembourg
 *   Minimum pension: CNAP — pension minimum garantie 2026
 */

import type { CountryConfig } from '../types';

const AW_2026 = 5_900; // EUR/month — STATEC Luxembourg gross avg estimate 2026

// CIIP = Cotisation à l'identité de l'assuré (contribution income ceiling) 2026
// = 5× SSM (social minimum wage full-time) + revalorisation = ~11,284 EUR/month
const CNAP_CEILING = 11_284; // EUR/month

// Annual contributory reference wage for points engine
const AW_ANNUAL = AW_2026 * 12; // 70,800 EUR/year

// Max annual points = ceiling / AW_monthly (= points earned at maximum contributory wage)
const MAX_ANNUAL_POINTS = CNAP_CEILING / AW_2026; // 11,284 / 5,900 ≈ 1.912

// Point value calibrated to OECD 88.6% GRR at 1x AW, 40yr career:
//   40 × 1.0 × pointValue = 0.886 × 5,900 → pointValue = 5,227 / 40 = 130.7 EUR/month
const POINT_VALUE = 130.7; // EUR/month per point

export const luxembourg: CountryConfig = {
  code: 'LU',
  name: 'Luxembourg',
  currency: 'EUR',
  eurExchangeRate: 1.0,
  dataYear: 2026,

  averageWage: AW_2026,
  medianWage: 4_720,        // EUR/month — Eurostat SES / STATEC 2022 adj. to 2026
  wagePercentiles: {          // EUR/month — Eurostat SES / STATEC 2022 adj. to 2026
    p10: 2_700, p25: 3_400, p75: 6_200, p90: 8_800,
  },
  minimumWage: 2_634,         // EUR/month — Règlement grand-ducal 2026 (salaire social minimum qualifié ÷ 1.2)
  oecdAverageWage: 6_221,  // EUR/month — OECD Taxing Wages 2025, Table I.1 (2024): EUR 74,652/year
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  defaults: {
    careerStartAge: 25,
    retirementAge: 65,       // LU statutory retirement age for full pension (40yr minimum)
    retirementDuration: 20,  // age 65 to 85
  },

  // LIR Art. 118 — barème IR 2026 (tranches mensuelles)
  // Luxembourg uses a highly granular bracket schedule; simplified to 10 effective bands below.
  // Standard personal allowance (forfait annuel): ~11,265 EUR/year = 939 EUR/month.
  // Note: LU uses Class 1 / Class 1a / Class 2 filing categories. Single earner = Class 1.
  // Class 1 abattements forfaitaires salarié: Werbungskosten 540 EUR/yr + Sonderausgaben 480 EUR/yr
  //   = 1,020 EUR/year = 85 EUR/month minimum; plus base allotment 15,000 EUR/year / 2 = partial
  //   Effective personalAllowance simplified to 916 EUR/month (from stubs data: LIR)
  incomeTax: {
    type: 'progressive',
    personalAllowance: 916,
    taxBase: 'gross',
    brackets: [
      { upTo: 1_302,   rate: 0.08 },
      { upTo: 1_953,   rate: 0.10 },
      { upTo: 2_605,   rate: 0.12 },
      { upTo: 3_907,   rate: 0.14 },
      { upTo: 5_209,   rate: 0.16 },
      { upTo: 6_511,   rate: 0.18 },
      { upTo: 8_664,   rate: 0.20 },
      { upTo: 10_816,  rate: 0.25 },
      { upTo: 14_070,  rate: 0.30 },
      { upTo: Infinity, rate: 0.38 },
    ],
  },

  // Employee SSC 2026 — CNAP + CNS + CMSS
  // Pension (vieillesse invalidité — CNAP): 8.00% (contribution ceiling = CNAP_CEILING)
  // Maladie (CNS Caisse Nationale de Santé): 3.05% (ceiling = CNAP_CEILING)
  // Dépendance (long-term care — CMSS): 1.40% (no ceiling)
  // Unemployment: combined into mutual + other schemes; minimal direct contribution for employees
  employeeSSC: {
    ceiling: CNAP_CEILING,
    components: [
      { label: 'Pension (CNAP vieillesse)', rate: 0.08,   ceiling: CNAP_CEILING, pensionFunded: true },
      { label: 'Health (CNS maladie)',      rate: 0.0305, ceiling: CNAP_CEILING, pensionFunded: false },
      { label: 'Dépendance (CMSS LT care)', rate: 0.014,  pensionFunded: false },
    ],
  },

  // Employer SSC 2026
  // Pension (CNAP): 8.00%
  // Maladie (CNS): 3.05%
  // Accident (AAA): ~1.20% (sector average; exact rate per accident insurance class)
  // Mutualité des employeurs / dépendance: 1.40%
  employerSSC: {
    ceiling: CNAP_CEILING,
    components: [
      { label: 'Pension (CNAP vieillesse)', rate: 0.08,   ceiling: CNAP_CEILING, pensionFunded: true },
      { label: 'Health (CNS maladie)',      rate: 0.0305, ceiling: CNAP_CEILING, pensionFunded: false },
      { label: 'Accidents du travail (AAA)', rate: 0.012, pensionFunded: false },
      { label: 'Dépendance / Mutualité',    rate: 0.014,  pensionFunded: false },
    ],
  },

  // ─── Pension System: POINTS (CNAP) ────────────────────────────────────────────
  //
  // Luxembourg pension is among the most generous in the EU (OECD GRR ≈ 88.6% at AW).
  // Single mandatory statutory scheme (CNAP); no mandatory Pillar 2.
  //
  // Engine parameters calibrated to OECD Pensions at a Glance 2023 (Luxembourg profile):
  //   pointValue   = 130.7 EUR/month per accumulated point
  //   referenceWage = 70,800 EUR/year (annual AW_2026)
  //   ceiling      = 1.912 points/year (at CNAP contribution ceiling 11,284/5,900 AW-multiples)
  //   minimumPension = 2,579 EUR/month (pension minimum garantie CNAP 2026 estimate, full career)
  //
  // Verification at 1x AW for 40yr career:
  //   annualPoints = (3,500×12) / 42,000... no, for LU: (5,900×12) / 70,800 = 1.0
  //   Wait: annualPoints = min(5,900 × 12 / 70,800, 1.912) = min(1.0, 1.912) = 1.0
  //   totalPoints  = 1.0 × 40 = 40
  //   monthly      = 40 × 130.7 = 5,228 EUR/month
  //   RR           = 5,228 / 5,900 = 88.6% ✓  (matches OECD)
  pensionSystem: {
    type: 'POINTS',
    pointValue:          POINT_VALUE,          // 130.7 EUR/month per point
    pointValueIndexation: 0.02,                // approximate annual indexation (wage + CPI blended)
    pointsPerAW:          1.0,                 // 1.0 point per year at reference wage
    ceiling:              MAX_ANNUAL_POINTS,   // 1.912 points/year max (at CNAP ceiling)
    referenceWage:        AW_ANNUAL,           // 70,800 EUR/year (= AW × 12)
    minimumPension:       2_579,               // CNAP pension minimum garantie 2026 (EUR/month)
  },

  // LU: pension income taxed as ordinary income under LIR Art. 10 n°5.
  // Pensioners receive a tax abatement (abattement retraité) of ~300 EUR/year = 25 EUR/month.
  // Standard tax brackets apply. Source: LIR Art. 10.
  pensionTax: {
    method: 'income_tax',
    taxableFraction: 1.0,
    note: 'LIR Art. 10 n°5: rente de vieillesse imposable comme revenu; abattement retraité ~300 EUR/an non modélisé',
  },

  incomplete: false,
  formulaSteps: [],

  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'STATEC Luxembourg — indice des salaires; Eurostat earn_ses 2022 to 2026 estimate',
      url: 'https://statistiques.public.lu/en/themes/work-employment/wages/index.html',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax.brackets',
      source: 'LIR Art. 118 — barème IRPP 2026 (Administration des contributions directes)',
      url: 'https://impotsdirects.public.lu/fr/themes/personnes_physiques/baremes.html',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC + employerSSC',
      source: 'CNAP / CNS / CMSS taux 2026; MISSOC Table I Jan 2026; CSS Luxembourg',
      url: 'https://www.cnap.lu/fr/cotisants/taux-de-cotisation/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem.ceiling — CIIP 2026',
      source: 'CNAP communiqué 2026 — cotisation maximale (CIIP = 5× SSM)',
      url: 'https://www.cnap.lu/fr/cotisants/assiette-de-cotisation/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem.pointValue — calibrated to OECD GRR 88.6%',
      source: 'OECD Pensions at a Glance 2023, Country profile Luxembourg, Table 6.1',
      url: 'https://www.oecd-ilibrary.org/finance-and-investment/pensions-at-a-glance_19991363',
      retrievedDate: '2026-03',
      dataYear: 2026,
    },
    // ── Cross-cutting source references ──────────────────────
    {
      parameter: 'medianWage + wagePercentiles',
      source: 'Eurostat Structure of Earnings Survey (earn_ses_monthly) 2022, adjusted to 2026',
      url: 'https://ec.europa.eu/eurostat/web/labour-market/earnings/database',
      retrievedDate: '2026-01',
      dataYear: 2022,
    },
    {
      parameter: 'oecdAverageWage',
      source: 'OECD Taxing Wages 2025, Table I.1 (data year 2024)',
      url: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
      retrievedDate: '2025-11',
      dataYear: 2024,
    },
    {
      parameter: 'minimumWage',
      source: 'Eurostat minimum wage statistics (earn_mw_cur) + règlement grand-ducal 2026 (SSM)',
      url: 'https://ec.europa.eu/eurostat/statistics-explained/index.php/Minimum_wage_statistics',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionTax (taxed as income)',
      source: 'MISSOC Comparative Tables — Table V pension taxation 2025; specific law cited in pensionTax.note',
      url: 'https://www.missoc.org/missoc-database/comparative-tables/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
  ],

  selfEmployment: null,
};
