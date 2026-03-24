/**
 * Sweden — Country Config 2026 (Tier 3)
 *
 * Tax / SSC: complete and accurate.
 * Pension formula: MIXED — Inkomstpension (NDC, Pillar 1) + Premiepension (funded Pillar 2)
 *
 *   Pillar 1 — Inkomstpension (NDC)
 *     Contribution: 16% of pensionable income up to ceiling (8.07 × IBB)
 *     Notional return: indexed to wage growth (proxy 2.5%/yr real)
 *     Annuity divisor: delningstal (G-value) from Pensionsmyndigheten Orange Report tables
 *     IBB 2026: 83,000 SEK/year → ceiling 8.07×IBB/12 = ~55,820 SEK/month
 *     Source: Pensionsmyndigheten — Orangerapporten / Orange Report annual appendix tables
 *
 *   Pillar 2 — Premiepension (funded, individual choice of PPM fund)
 *     Contribution: 2.5% of pensionable income (same ceiling as Pillar 1)
 *     Default return: 3% real (OECD benchmark; historical average ~5%+)
 *     Source: Pensionsmyndigheten; SFS 1998:674 (Lag om premiepension)
 *
 * INCOME TAX NOTES:
 *   Swedish income tax = municipal (avg 32.37% based on SKV 2026 mean) + state (20% over upper threshold).
 *   Upper threshold (statlig inkomstskatt på förvärvsinkomster) 2026: 598,500 SEK/year = 49,875 SEK/month.
 *   Jobbskatteavdrag (job tax deduction): non-refundable credit reducing final municipal tax due.
 *   For income ~624,000 SEK/year: jobbskatteavdrag ≈ 36,000 SEK/year = 3,000 SEK/month (credit).
 *   Modelled via personalAllowance=3_000 with allowanceIsCredit=true (credit against tax bill).
 *   NOTE: jobbskatteavdrag offsets the employee's 7% allmän pensionsavgift in practice — net
 *   pension cost to the worker is near zero at average wage; the full 18.5% is effectively
 *   borne by the employer through arbetsgivaravgifter.
 *
 * SSC NOTES:
 *   Arbetsgivaravgifter (employer payroll tax) 2026 total: 31.42%
 *   - Ålderspensionsavgift: 10.21% (sent to pension system; funds NDC + premiepension portion)
 *   - Efterlevandepensionsavgift: 0.60% (survivor pension)
 *   - Sjukförsäkringsavgift: 3.55% (health/sick pay)
 *   - Föräldraförsäkringsavgift: 2.60% (parental insurance)
 *   - Arbetsmarknadsavgift: 2.64% (labour market / unemployment)
 *   - Arbetsskadeavgift: 0.20% (work accident)
 *   - Allmän löneavgift: 11.62% (general payroll levy)
 *   Source: Skatteverket, SKV 401, Jan 2026 edition; MISSOC Table I Jan 2026
 *
 *   Employee allmän pensionsavgift: 7% of gross up to pension ceiling.
 *   This is offset by the jobbskatteavdrag — the net economic cost to the employee approaches zero.
 *   Source: SFS 1994:1744 Lag om allmän pensionsavgift
 *
 * Sources:
 *   AW: SCB/OECD Average Wages — Sweden 2024 avg gross ~617,000 SEK/yr; 2026 estimate ~624,000 SEK/yr ÷ 12
 *   EUR/SEK: ECB monthly reference rate Jan 2026 ≈ 11.12 SEK/EUR
 *   Income tax brackets: Skatteverket SKV 401 / SKV 04-00-01, 2026 tabeller
 *   SSC: Skatteverket arbetsgivaravgifter 2026; MISSOC CMS Table I Jan 2026
 *   Pension: Pensionsmyndigheten Orangerapporten; SFS 1998:674; SFS 1998:675
 *   IBB 2026: 83,000 SEK/year — Pensionsmyndigheten annual index announcement
 */

import type { CountryConfig } from '../types';

// Swedish parameters 2026
const AW_2026    = 52_000; // SEK/month gross — SCB/OECD estimate
const EUR_SEK    = 11.12;  // ECB Jan 2026 reference rate

// Inkomstbasbelopp (IBB) 2026: 83,000 SEK/year → monthly: 83,000/12 = 6,917 SEK
// Pension ceiling: 8.07 × IBB = 8.07 × 83,000 = 669,810 SEK/year = 55,818 SEK/month
const IBB_2026       = 83_000; // SEK/year
const PENSION_CEILING = Math.round(8.07 * IBB_2026 / 12); // 55_818 SEK/month

// State income tax (statlig inkomstskatt) threshold 2026
// ~598,500 SEK/year → 49,875 SEK/month
const STATE_TAX_THRESHOLD = 49_875; // SEK/month

export const sweden: CountryConfig = {
  code: 'SE',
  name: 'Sweden',
  currency: 'SEK',
  eurExchangeRate: EUR_SEK,
  dataYear: 2026,

  averageWage: AW_2026,
  medianWage: 43_160,         // SEK/month — SCB / Eurostat SES 2022 adj. to 2026
  wagePercentiles: {            // SEK/month — SCB / Eurostat SES 2022 adj. to 2026
    p10: 26_000, p25: 32_000, p75: 53_500, p90: 72_000,
  },
  minimumWage: 16_000,          // SEK/month — effective collective floor (IF Metall / Kommunal 2026)
  oecdAverageWage: 43_434,  // SEK/month — OECD Taxing Wages 2025, Table I.1 (2024): SEK 521,208/year
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  defaults: {
    careerStartAge: 25,
    retirementAge: 65,      // Standard pensionsålder; flexibly from 63; 67 "rikttålder" post-2026
    retirementDuration: 22, // age 65 to ~87 (Swedish LE is one of Europe's highest)
  },

  // Skatteverket — 2026 income tax (SKV 401 / tabeller)
  // Combined municipal (avg 32.37%) + state (20% above 598,500 SEK/yr)
  // Jobbskatteavdrag: modelled as personalAllowance=3_000 SEK/month with allowanceIsCredit=true.
  // Note: municipal rate varies 29.19–35.15% by municipality; 32.37% is the population-weighted mean.
  incomeTax: {
    type: 'progressive',
    personalAllowance: 3_000, // jobbskatteavdrag (job tax credit) ≈ 3,000 SEK/mo at mean income
    allowanceIsCredit: true,  // credit against final tax, not a base deduction
    taxBase: 'gross',
    brackets: [
      { upTo: STATE_TAX_THRESHOLD, rate: 0.3237 }, // municipal only (state rate = 0% below threshold)
      { upTo: Infinity,            rate: 0.5237 }, // municipal 32.37% + state 20% = 52.37%
    ],
  },

  // Employee SSC 2026 — Skatteverket / SFS 1994:1744
  employeeSSC: {
    ceiling: undefined,
    components: [
      // Allmän pensionsavgift: 7% of gross up to pension ceiling.
      // Note: this is fully offset by jobbskatteavdrag in most wage bands — net cost ≈ 0.
      { label: 'Allmän Pensionsavgift (NDC)', rate: 0.07, ceiling: PENSION_CEILING, pensionFunded: true },
    ],
  },

  // Employer SSC 2026 — Arbetsgivaravgifter (Skatteverket SKV 401)
  // Total: 31.42% for employees under 66 years old.
  employerSSC: {
    ceiling: undefined,
    components: [
      { label: 'Ålderspensionsavgift (pension)',   rate: 0.1021, ceiling: PENSION_CEILING, pensionFunded: true },
      { label: 'Efterlevandepensionsavgift (survivor)', rate: 0.0060, pensionFunded: true },
      { label: 'Sjukförsäkringsavgift (health)',   rate: 0.0355, pensionFunded: false },
      { label: 'Föräldraförsäkringsavgift (parental)', rate: 0.0260, pensionFunded: false },
      { label: 'Arbetsmarknadsavgift (unemployment)', rate: 0.0264, pensionFunded: false },
      { label: 'Arbetsskadeavgift (work injury)',   rate: 0.0020, pensionFunded: false },
      { label: 'Allmän löneavgift (general levy)',  rate: 0.1162, pensionFunded: false },
    ],
  },

  // ─── Pension System: MIXED (Inkomstpension NDC + Premiepension funded) ─────────────
  //
  // Pillar 1 — Inkomstpension (NDC, SFS 1998:674)
  //   Total NDC pool: 16% of pensionable income up to 8.07 × IBB
  //   Funded by: worker 7% (via pensionsavgift, offsetting arbetsgivaravgifter) +
  //              employer ålderspensionsavgift 10.21% → combined ~17.21%, 16% credited to NDC
  //   Annuity divisor (delningstal/G-value): Pensionsmyndigheten Orange Report tables per cohort.
  //   Values below represent estimated divisors (in months) for a typical cohort retiring 2060:
  //     age 63 → 228 mo (19yr), age 65 → 210 mo (17.5yr), age 67 → 192 mo (16yr)
  //   Notional return: pegged to wage bill growth index; long-run real assumption 2.5%/yr.
  //
  // Pillar 2 — Premiepension (funded, SFS 1998:675)
  //   2.5% of pensionable income invested in PPM fund chosen by worker.
  //   Projected here at 3% real return (conservative; historical: ~5–7%).
  pensionSystem: {
    type: 'MIXED',
    pillar1: {
      type: 'NDC',
      pillar1ContributionRate: 0.16,   // % of pensionable income credited to inkomstpension account
      notionalReturnRate: 0.020,        // wage growth index (inkomstindex real avg 2000–2023 ~1.8%; 2.0% conservative forward estimate)
      annuityDivisor: {                 // delningstal in months (Orange Report cohort tables)
        63: 228,
        65: 210,
        67: 192,
        70: 168,
      },
      ceiling: PENSION_CEILING,         // 8.07 × IBB/12 = 55,818 SEK/month
    },
    pillar2Rate: 0.025,                 // premiepension: 2.5% of pensionable income (funded PPM)
    pillar2ReturnRate: 0.03,            // conservative 3% real; historical avg ≈ 5%
  },

  pensionTax: {
    method: 'income_tax',
    taxableFraction: 1.0,
    note: 'SFS 1999:1229 IL: inkomstpension taxed as employment income; jobbskatteavdrag does not apply to pension income — pensioners face slightly higher ETR than workers',
  },

  incomplete: false,
  formulaSteps: [],

  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'SCB Lönestrukturstatistik 2024; OECD Average Wages Sweden 2024 trend to 2026',
      url: 'https://www.scb.se/hitta-statistik/statistik-efter-amne/arbetsmarknad/loner-och-arbetskostnader/lonestrukturstatistik-hela-ekonomin/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'eurExchangeRate',
      source: 'ECB SDMX-REST EXR M.SEK.EUR.SP00.A — monthly avg Jan 2026',
      url: 'https://data-api.ecb.europa.eu/service/data/EXR/M.SEK.EUR.SP00.A?format=csvdata&lastNObservations=1',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax.brackets',
      source: 'Skatteverket SKV 401 — Skattesatser 2026; SKV inkomstgränser och skattesatser',
      url: 'https://www.skatteverket.se/privat/skatter/arbeteochinkomst/skattesatser/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax.personalAllowance (jobbskatteavdrag)',
      source: 'Skatteverket SKV 350 — Jobbskatteavdrag 2026 tabell; Inkomstskattelagen 67 kap',
      url: 'https://www.skatteverket.se/privat/skatter/arbeteochinkomst/avdrag/jobbskatteavdrag.4.html',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC + employerSSC',
      source: 'Skatteverket SKV 401 — Arbetsgivaravgifter och egenavgifter 2026; MISSOC Table I Jan 2026',
      url: 'https://www.skatteverket.se/foretag/arbetsgivare/arbetsgivaravgifter.4.html',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem — IBB 2026, NDC rates, delningstal',
      source: 'Pensionsmyndigheten Orangerapporten 2025; SFS 1998:674; SFS 1994:1744',
      url: 'https://www.pensionsmyndigheten.se/en/about-us/publications/the-orange-report',
      retrievedDate: '2026-01',
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
      parameter: 'minimumWage (effective sectoral floor)',
      source: 'MISSOC Comparative Tables 2026 + dominant sector collective agreement (SE: no national statutory minimum)',
      url: 'https://www.missoc.org/missoc-database/comparative-tables/',
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
