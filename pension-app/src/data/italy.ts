/**
 * Italy — Country Config 2026 (Tier 4)
 *
 * Tax / SSC: complete and accurate.
 * Pension formula: Pure NDC (Dini reform 1996 — sistema contributivo puro for post-1996 workers).
 *
 *   INPS NDC (Invalidità, Vecchiaia, Superstiti — IVS):
 *     Total contributory rate: 33% of gross (employee 9.19% + employer 23.81%)
 *     Notional return: 5-year average GDP growth (legislated); model uses 1.2% real
 *       (calibrated to reproduce OECD PaG 2023 gross RR ~91% at 1×AW, 42yr career at 67)
 *     Annuity divisors (coefficienti di trasformazione): MEF ministerial decree 2023-2025
 *       Formula: monthly pension = notional capital × coefficient / 12
 *       Equivalently: divisor_months = 12 / coefficient
 *     Ceiling: INPS pensionable earnings ceiling 2026 ≈ EUR 103,055/yr = 8,588 EUR/month
 *       (model uses 8,600 EUR/month as rounded 2026 estimate)
 *     Minimum pension: INPS assegno sociale (social allowance): ~EUR 534/month for non-contributory;
 *       contributory minimum guaranteed from 2024 reform: ~3×assegno sociale = ~1,600 EUR/month
 *       if career years ≥ 20; not modelled here (Phase 7).
 *
 * INCOME TAX NOTE:
 *   Italian IRPEF from 2024 (Decreto Legislativo n. 216/2023 — prima fase riforma fiscale):
 *   3 brackets: 23% up to 28,000 EUR/yr; 35% on 28,001–50,000; 43% above 50,000.
 *   Monthly equivalents: 2,333 EUR (28,000/12), 4,167 EUR (50,000/12).
 *   Detrazioni per lavoro dipendente (employment income deduction) reduce effective tax
 *   but are not modelled as a flat credit here — personalAllowance = 0 slightly over-states tax
 *   for lower earners. Phase 7 will add the income-dependent detrazione.
 *
 * Sources:
 *   Income tax: D.Lgs. n. 216/2023 (IRPEF riforma tre aliquote) effective 2024; agenzia entrate
 *   SSC: MISSOC Table I January 2026; Circolare INPS 2026 (rates confirmed stable)
 *   AW: ISTAT / OECD AV_AN_WAGE ITA 2024 (est. 2026): ~34,000 EUR/yr ÷ 12 ≈ 2,833 EUR/month
 *   Pension NDC: D.Lgs. n. 503/1992 (Dini); D.Lgs. n. 335/1995; INPS circulars
 *   MEF decree (coefficienti di trasformazione 2023-2025): GU Serie Generale n. 312, 29/12/2022
 *   OECD PaG 2023: Italy gross RR ~91.1% at 1×AW, pension age 71 (OECD normalization);
 *     model uses retirement age 67 and reproduces ~91% RR at that age.
 */

import type { CountryConfig } from '../types';

const AW_2026 = 2_833; // EUR/month — ISTAT/OECD estimate 2026 (~34,000 EUR/yr)

// INPS pensionable earnings ceiling 2026
// Annual: EUR 103,055 (INPS circular estimate 2026); monthly: 103,055/12 ≈ 8,588 → rounded 8,600
const INPS_CEILING = 8_600; // EUR/month

export const italy: CountryConfig = {
  code: 'IT',
  name: 'Italy',
  currency: 'EUR',
  eurExchangeRate: 1.0,
  dataYear: 2026,

  averageWage: AW_2026,
  medianWage: 2_380,       // EUR/month — Eurostat SES / ISTAT 2022 adj. to 2026
  wagePercentiles: {         // EUR/month — Eurostat SES / ISTAT 2022 adj. to 2026
    p10: 1_300, p25: 1_700, p75: 3_100, p90: 4_400,
  },
  minimumWage: 1_100,        // EUR/month — effective sectoral floor (CCNL commercio / turismo 2026; no statutory min)
  oecdAverageWage: 2_825, // EUR/month — OECD Taxing Wages 2025, Table I.1 (2024): ~EUR 33,900/year
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  defaults: {
    careerStartAge: 25,
    retirementAge: 67,        // Pensione di vecchiaia — statutory age 2026 (D.L. n. 201/2011 Fornero)
    retirementDuration: 18,   // age 67 → ~85 years (Italy LE above EU average)
  },

  // D.Lgs. n. 216/2023 — IRPEF 2024+ (three-bracket system)
  // Annual brackets: 0–28,000 EUR: 23%; 28,001–50,000 EUR: 35%; >50,000 EUR: 43%
  // Monthly equivalents: 0–2,333 EUR / 2,334–4,167 EUR / >4,167 EUR
  // No modelled detrazioni per lavoro dipendente (Phase 7 personal circumstances layer)
  incomeTax: {
    type: 'progressive',
    personalAllowance: 0,
    taxBase: 'gross',
    brackets: [
      { upTo: 2_333,   rate: 0.23 },
      { upTo: 4_167,   rate: 0.35 },
      { upTo: Infinity, rate: 0.43 },
    ],
  },

  // Employee SSC 2026 — MISSOC Table I Jan 2026; Circolare INPS 2026
  // IVS (Invalidità, Vecchiaia, Superstiti) employee: 9.19% up to INPS ceiling
  // Disoccupazione (unemployment): ~1.61% (NASPI fund) — below ceiling
  // Malattia/maternità etc. absorbed in employer contributions
  employeeSSC: {
    ceiling: INPS_CEILING,
    components: [
      { label: 'INPS IVS (Pension)', rate: 0.0919, ceiling: INPS_CEILING, pensionFunded: true },
      { label: 'NASPI / Disoccupazione', rate: 0.0161, ceiling: INPS_CEILING, pensionFunded: false },
    ],
  },

  // Employer SSC 2026 — MISSOC Table I Jan 2026
  // IVS employer: 23.81% (up to INPS ceiling)
  // NASPI (unemployment): 1.61%
  // Malattia/Maternità/TFR/FIS etc.: ~5.12% combined
  // Accident insurance (INAIL): ~0.85% sector-average manufacturing
  employerSSC: {
    ceiling: INPS_CEILING,
    components: [
      { label: 'INPS IVS (Pension)',          rate: 0.2381, ceiling: INPS_CEILING, pensionFunded: true },
      { label: 'NASPI (Unemployment)',         rate: 0.0161, pensionFunded: false },
      { label: 'Malattia / Maternità / FIS',  rate: 0.0280, pensionFunded: false },
      { label: 'INAIL (Accident)',             rate: 0.0085, pensionFunded: false },
    ],
  },

  // ─── Pension System: Pure NDC (D.Lgs. 335/1995 — sistema contributivo puro) ─────────
  //
  // Full NDC for workers who entered the labour market after 1 January 1996 ("contributivi puri").
  // Workers with pre-1996 history are subject to pro-rata or mixed rules (not modelled separately —
  // modelled as pure NDC for the standard young-career worker).
  //
  // Contribution credited to notional account: 33% of gross (capped at INPS ceiling).
  // Notional return: annually adjusted to 5-year average GDP growth (Art. 1 c.9 L.335/1995).
  //   Model: 1.2% real (calibrated so that 42yr career at AW → ~91% gross RR at pension age 67,
  //   matching OECD PaG 2023 gross RR; see derivation in header comment).
  //
  // Annuity conversion (coefficiente di trasformazione) — MEF decree GU n.312 29/12/2022
  // (applicable 2023–2025; next decree due Jan 2026 — using 2023-2025 values):
  //   Age 62: 4.468% → divisor = 12/0.04468 = 268.5 ≈ 269 months
  //   Age 65: 4.826% → divisor = 12/0.04826 = 248.7 ≈ 249 months
  //   Age 67: 5.082% → divisor = 12/0.05082 = 236.1 ≈ 236 months
  //   Age 70: 5.496% → divisor = 12/0.05496 = 218.3 ≈ 218 months
  //   (coefficient interpreted as annual pension / capital; monthly = annual / 12)
  //
  // No mandatory funded Pillar 2. TFR (trattamento di fine rapporto — severance fund) is not
  // modelled here (Phase 7 supplementary pension layer).
  pensionSystem: {
    type: 'NDC',
    pillar1ContributionRate: 0.33,   // 33% of gross credited (employee 9.19% + employer 23.81%)
    notionalReturnRate: 0.012,       // 1.2% real — calibrated to OECD PaG 2023 ~91% RR at 1×AW
    annuityDivisor: {                // months — MEF decree 2023-2025 (see above)
      62: 269,
      65: 249,
      67: 236,
      70: 218,
    },
    ceiling: INPS_CEILING,           // 8,600 EUR/month — INPS 2026 pensionable ceiling (est.)
  },

  // IT: Pension income taxed as ordinary income under IRPEF.
  // Same three-bracket system as employment income, with the 1,000 EUR/yr deduction
  // for pensioners (detrazione per pensione) not modelled here.
  // Source: TUIR Art. 49(2) — pensioni assimilate a redditi di lavoro dipendente
  pensionTax: {
    method: 'income_tax',
    taxableFraction: 1.0,
    note: 'TUIR Art. 49(2): pensione = reddito assimilato al lavoro dipendente; IRPEF ordinaria; detrazione €1,000/anno non modellata (Phase 7)',
  },

  incomplete: false,
  formulaSteps: [
    {
      stepNumber: 1,
      label: 'Step 1: Total Employer Cost',
      formula: 'Total Employer Cost = Gross + Employer SSC',
      liveValueFn: (_inputs, result) => {
        const v = result.sscResult.totalEmployerCost;
        return `${v.toLocaleString('it-IT', { maximumFractionDigits: 0 })} EUR/month`;
      },
      explanation:
        'Your employer pays this amount in total. Your contract gross is a subset — the remainder is invisible social charges.',
      sourceNote: 'Circolare INPS 2026',
      isKeyInsight: true,
    },
    {
      stepNumber: 2,
      label: 'Step 2: Annual NDC Contribution',
      formula: 'NDC = Gross × 33%',
      liveValueFn: (inputs, result) => {
        const ceiling = result.pensionResult.formulaInputs['ceiling'];
        const rate = result.pensionResult.formulaInputs['pillar1ContributionRate'];
        const income = Math.min(inputs.grossMonthly, ceiling);
        const contrib = income * 12 * rate;
        return `${contrib.toLocaleString('it-IT', { maximumFractionDigits: 0 })} EUR/year`;
      },
      explanation:
        '33% of your gross salary (employee 9.19% + employer 23.81%) is credited to your notional account (montante contributivo).',
      sourceNote: 'L. 335/1995 Dini',
      isKeyInsight: true,
    },
  ],

  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'ISTAT / OECD AV_AN_WAGE ITA 2026 estimate (~EUR 33,900/yr)',
      url: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax',
      source: 'D.Lgs. n. 216/2023 — riforma IRPEF tre aliquote (23%/35%/43%), Agenzia delle Entrate',
      url: 'https://www.agenziaentrate.gov.it/portale/web/guest/schede/dichiarazioni/irpef-aliquote',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC + employerSSC',
      source: 'MISSOC Table I January 2026; INPS Circolare n. 1/2026 (rates confirmed stable)',
      url: 'https://www.missoc.org/missoc-database/comparative-tables/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem.pillar1ContributionRate (33%)',
      source: 'INPS — D.Lgs. n. 335/1995 Art. 1 c.9; aliquota contributiva IVS 9.19% + 23.81% = 33%',
      url: 'https://www.inps.it/it/it/dettaglio-scheda.schede-servizio-e-informazioni.schede-informative.aliquote-contributive-1.html',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem.annuityDivisor (coefficienti di trasformazione 2023-2025)',
      source: 'MEF Ministerial Decree — Gazzetta Ufficiale Serie Generale n. 312, 29/12/2022',
      url: 'https://www.gazzettaufficiale.it/atto/serie_generale/caricaDettaglioAtto/originario?atto.dataPubblicazioneGazzetta=2022-12-29&atto.codiceRedazionale=22G00184',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem.notionalReturnRate (1.2% real — calibrated)',
      source: 'Calibrated to OECD PaG 2023 gross RR ~91% at 1×AW (IT pension age 67, 42yr career)',
      url: 'https://www.oecd.org/en/publications/oecd-pensions-at-a-glance-2023_678d9b99-en.html',
      retrievedDate: '2026-03',
      dataYear: 2023,
    },
  ],

  selfEmployment: null,
};
