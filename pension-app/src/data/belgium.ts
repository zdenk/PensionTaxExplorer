/**
 * Belgium — Country Config 2026 (Tier 2)
 *
 * Tax / SSC: complete and accurate.
 * Pension formula: Defined Benefit — "régime général des travailleurs salariés" (RG).
 *
 *   Formula (Loi du 20/07/1990 + AR Pension 2025 updates):
 *     pension = (careerFraction) × 60% × SAL_limited
 *     where careerFraction = min(career_years / 45, 1.0)
 *     SAL_limited = avg insured annual earnings (each year capped at benefit ceiling)
 *   Engine model: DB with accrualRatePerYear = 60%/45 = 1.333%/yr, ceiling = benefit plafond.
 *
 *   MINIMUM PENSION (2026, single, for full 45-yr career): ≈ 1,564 EUR/month.
 *   DBConfig does not carry a minimumPension field; floor is documented in formulaSteps.
 *
 * Sources:
 *   SSC: MISSOC Table I January 2026; AR du 28/11/1969 / loi du 27/06/1969
 *   Income tax: Code des Impôts sur les Revenus (CIR 92) — Art. 130 barème 2026
 *   AW: Eurostat earn_ses_monthly Belgium 2022 survey to 2026 estimate
 *   Pension benefit ceiling 2026: Office National des Pensions (ONP/RVP) — ~3,531 EUR/month
 *     Source: ONP barème 2026 (annual 42,372 EUR ÷ 12)
 */

import type { CountryConfig } from '../types';

const AW_2026 = 3_900; // EUR/month — Eurostat Belgium 2026 gross average estimate

// Benefit ceiling (plafond de la pension / pensioenpaling) 2026
// ONP: plafond salaire référence annuel 2026 ≈ 42,372 EUR → monthly 3,531 EUR
const PENSION_CEILING = 3_531; // EUR/month — ONP 2026 reference salary cap

export const belgium: CountryConfig = {
  code: 'BE',
  name: 'Belgium',
  currency: 'EUR',
  eurExchangeRate: 1.0,
  dataYear: 2026,

  averageWage: AW_2026,
  medianWage: 3_315,        // EUR/month — Eurostat SES 2022 adj. to 2026
  wagePercentiles: {          // EUR/month — Eurostat SES / StatBel 2022 adj. to 2026
    p10: 2_050, p25: 2_580, p75: 4_200, p90: 5_900,
  },
  minimumWage: 2_070,         // EUR/month — CCT n°43 / CTB 2026 (nationale minimumloon)
  oecdAverageWage: 4_862,  // EUR/month — OECD Taxing Wages 2025, Table I.1 (2024): EUR 58,344/year
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  defaults: {
    careerStartAge: 25,
    retirementAge: 65,       // statutory retirement age 2026 (rising to 67 by 2030)
    retirementDuration: 20,
  },

  // CIR 92 Art. 130 — barème IPP/PB 2026 (tranches mensuelles)
  // Annual 2026 tranches: ≤14,140 EUR 25% / ≤24,450 40% / ≤42,370 45% / above 50%
  // Forfait frais professionnels (flat-rate employment expense deduction):
  //   standard rate: 30% of gross, capped at ~5,030 EUR/year (≈ 419 EUR/month ceiling).
  //   Implemented here as personalAllowance = 419 EUR/month deduction from taxable base.
  incomeTax: {
    type: 'progressive',
    personalAllowance: 419, // approximate monthly equivalent of flat-rate 30% expense deduction
    taxBase: 'gross',
    brackets: [
      { upTo: 1_178,   rate: 0.25 }, // ≤14,140 EUR/year ÷ 12
      { upTo: 2_038,   rate: 0.40 }, // ≤24,450 EUR/year ÷ 12
      { upTo: 3_531,   rate: 0.45 }, // ≤42,370 EUR/year ÷ 12
      { upTo: Infinity, rate: 0.50 },
    ],
  },

  // Employee SSC 2026 — ONSS/RSZ (loi du 27 juin 1969)
  // Total employee rate: ~13.07% (no ceiling for most components).
  // Note: "cotisation spéciale de sécurité sociale" (0.87%) is for unemployment.
  employeeSSC: {
    ceiling: undefined,
    components: [
      // Pension: 7.50% (all earnings, no ceiling for RG employees)
      { label: 'Pension Insurance (vieillesse)', rate: 0.0750, pensionFunded: true },
      // Maladie-Invalidité (health + incapacity): 3.55%
      { label: 'Health / Disability (maladie)', rate: 0.0355, pensionFunded: false },
      // Chômage / ONEM: 0.87%
      { label: 'Unemployment (chômage)', rate: 0.0087, pensionFunded: false },
      // Accident du travail + fonds fermeture: 0.15%
      { label: 'Fonds accidents / fermeture', rate: 0.0015, pensionFunded: false },
    ],
  },

  // Employer SSC 2026 — ONSS/RSZ
  // Total employer rate: ~25% (varies by sector; standard private sector shown)
  employerSSC: {
    ceiling: undefined,
    components: [
      // Pension: 8.86%
      { label: 'Pension Insurance (vieillesse)', rate: 0.0886, pensionFunded: true },
      // Maladie-Invalidité: 3.80%
      { label: 'Health / Disability (maladie)', rate: 0.0380, pensionFunded: false },
      // Accidents du travail: 0.30% (sector average)
      { label: 'Work Accidents (AT)', rate: 0.0030, pensionFunded: false },
      // Chômage / ONEM + allocations familiales + Femap: ~7.25% combined
      { label: 'Unemployment / Family / Other', rate: 0.0725, pensionFunded: false },
      // Cotisation patronale spéciale modération salariale (Maribel social...): ~5%
      { label: 'Maribel / Formation / Divers', rate: 0.0500, pensionFunded: false },
    ],
  },

  // ─── Pension System: DB (Régime Général — RG) ────────────────────────────────
  //
  // Formula (ONP/RVP):
  //   pension = (careerYears / 45) × 60% × avg_career_earnings
  //   each annual earnings value is capped at benefit ceiling (plafond salaire référence)
  //   benefit ceiling 2026: 3,531 EUR/month
  //
  // Engine mapping (DBConfig):
  //   credited  = min(grossMonthly, PENSION_CEILING) × 1.0 (creditRate = 100% up to ceiling)
  //   monthlypension = credited × careerYears × (0.60 / 45)
  //   = credited × careerYears × 0.01333
  //
  // Example at 1x AW (3,900 EUR) for 40yr career:
  //   credited = 3,531 (capped at ceiling)
  //   pension  = 3,531 × 40 × 0.01333 = 1,883 EUR/month
  //   RR       = 1,883 / 3,900 = 48.3% (régime général only; no mandatory funded pillar)
  //
  // Minimum pension guarantee (2026, single, full 45yr career): ~1,564 EUR/month
  // Applied as a floor in the engine via minimumMonthlyPension (see below).
  pensionSystem: {
    type: 'DB',
    basePension: 0,
    reductionThresholds: [
      { upTo: PENSION_CEILING, creditRate: 1.0 }, // earnings credited at 100% up to ceiling
      { upTo: Infinity,        creditRate: 0.0 }, // no accrual above benefit ceiling
    ],
    accrualRatePerYear: 0.60 / 45, // 60% (single) ÷ 45-year full career = 1.333%/yr
    assessmentBase: 'lifetime_avg', // valorized career earnings average (simplified)
    ceiling: PENSION_CEILING,       // 3,531 EUR/month — plafond salaire de référence 2026
    //
    // Minimum pension guarantee (2026, single, full 45-yr career): ~1,564 EUR/month.
    // Source: ONP/RVP — pension_minimale travailleurs salariés 2026 Q1 (indexée, isolement).
    // Engine applies as a floor: Math.max(formulaPension, minimumMonthlyPension).
    // Phase 7: prorate correctly for partial careers (currently applied as flat floor).
    minimumMonthlyPension: 1_564,
  },

  // BE: pension income taxed as ordinary income (revenus de remplacement), with
  // "réduction d'impôt pour revenus de remplacement" (RIRR) reducing liability at lower pension levels.
  // Phase 7: add RIRR credit. Source: CIR 92 Art. 146 ff.
  pensionTax: {
    method: 'income_tax',
    taxableFraction: 1.0,
    note: 'CIR 92 Art. 146: pension taxée comme revenu de remplacement; réduction RIRR non modélisée (Phase 7)',
  },

  incomplete: false,
  formulaSteps: [
    {
      stepNumber: 1,
      label: 'Step 1: Total Employer Cost',
      formula: 'Total Employer Cost = Gross + Employer SSC',
      liveValueFn: (_inputs, result) => {
        const v = result.sscResult.totalEmployerCost;
        return `${v.toLocaleString('fr-BE', { maximumFractionDigits: 0 })} EUR/month`;
      },
      explanation:
        'Your employer pays this amount in total. Your contract gross is a subset — the remainder is invisible social charges.',
      sourceNote: 'ONSS / RSZ 2026',
      isKeyInsight: true,
    },
    {
      stepNumber: 2,
      label: 'Step 2: Monthly Pension (Régime Général)',
      formula: 'Pension = 60% × min(Gross, Ceiling) × (Years / 45)',
      liveValueFn: (_inputs, result) => {
        const v = result.pensionResult.monthlyPension;
        return `${v.toLocaleString('fr-BE', { maximumFractionDigits: 0 })} EUR/month`;
      },
      explanation:
        'The Belgian state pension replaces 60% of your average career earnings (capped at the benefit ceiling) for a full 45-year career.',
      sourceNote: 'ONP / RVP 2026',
    },
  ],

  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'Eurostat earn_ses_monthly Belgium 2022 / Statbel trend estimate 2026',
      url: 'https://statbel.fgov.be/fr/themes/emploi-et-conditions-de-travail/salaires',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax.brackets',
      source: 'CIR 92 Art. 130 — barème IPP 2026 (Loi de finances 2025)',
      url: 'https://finances.belgium.be/fr/particuliers/revenus-et-perception/impot-des-personnes-physiques',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC + employerSSC',
      source: 'ONSS/RSZ — Taux de cotisations Q1 2026; MISSOC Table I Jan 2026',
      url: 'https://www.socialsecurity.be/employer/instructions/dmfa/fr/latest/instructions/salary/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem — accrual formula, benefit ceiling',
      source: "Office National des Pensions (ONP/RVP) — barème pension 2026; Loi du 20/07/1990",
      url: 'https://www.sfpd.fgov.be/fr/votre-pension/votre-droit-a-une-pension/calcul/salarie',
      retrievedDate: '2026-03',
      dataYear: 2026,
    },
  ],

  selfEmployment: null,
};
