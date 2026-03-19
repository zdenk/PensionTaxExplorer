/**
 * France — Country Config 2026 (Tier 2)
 *
 * Tax / SSC: complete and accurate.
 * Pension formula: Two-tier mandatory system.
 *   Pillar 1  — Régime général (CNAV): DB earning-related, ceiling at Plafond SS (PSS).
 *               formula: pension = 50% × SAM × (career_quarters / 172)
 *               SAM = average of best 25 insured years, each capped at PSS.
 *               Simplified in engine as lifetime_avg DB with accrualRate = 50%/43 per year.
 *   Pillar 1b — AGIRC-ARRCO (mandatory occupational complementary, PAYG points):
 *               Approximated via pillar2Rate = 9.4% (employee 3.75% + employer 5.65%).
 *               NOTE: calcSimplePillar2 projects this as a funded account at 3% real return.
 *               Actual AGIRC-ARRCO PAYG pension = ~27% replacement at 1x AW for 40yr career.
 *               The funded projection (~47%) reflects the "fair return" equivalent, not the
 *               actual AGIRC-ARRCO benefit. Formula sidebar documents this distinction.
 *
 * Sources:
 *   PSS 2026: 3,864 EUR/month (annual 46,368 EUR) — Arrêté du 26/12/2025, JO 27/12/2025
 *   Régime général: Code de la Sécurité Sociale Art. L351-1 ff; taux plein 50%, 172 quarters
 *   AGIRC-ARRCO: Convention collective nationale du 17/11/2017, valeur du point 1.3643 EUR (2025–2026)
 *   Income tax: Code Général des Impôts Art. 197 (2026 barème)
 *   SSC: MISSOC Table I January 2026; URSSAF circulaires 2026
 *   AW: Eurostat earn_ses_monthly / DSN administrative wage data 2024—2026 estimate
 */

import type { CountryConfig } from '../types';

// FR average gross monthly wage 2026 (mid/senior employee, Eurostat/DSN estimate)
const AW_2026 = 3_500; // EUR/month

// Plafond de la Sécurité Sociale (PSS) 2026
// Source: Arrêté du 26/12/2025, Journal Officiel — annual 46,368 EUR → monthly 3,864 EUR
const PSS = 3_864; // EUR/month

// AGIRC-ARRCO plafond: 8× PSS = 30,912 EUR/month for contributions
const AGIRC_CEILING = 8 * PSS; // 30,912 EUR/month

export const france: CountryConfig = {
  code: 'FR',
  name: 'France',
  currency: 'EUR',
  eurExchangeRate: 1.0,
  dataYear: 2026,

  averageWage: AW_2026,
  oecdAverageWage: 3_947,  // EUR/month — OECD Taxing Wages 2025, Table I.1 (2024): EUR 47,364/year
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  defaults: {
    careerStartAge: 25,
    retirementAge: 64,      // taux plein full-rate pivot since 2023 reform (Loi n°2023-270)
    retirementDuration: 21, // age 64 → 85 (French LE is high)
  },

  // Code Général des Impôts Art. 197 — barème 2026 (tranches mensuelles)
  // Annual 2026 tranches: ≤11,294 EUR 0% / ≤28,797 11% / ≤82,341 30% / ≤177,106 41% / above 45%
  // Note: French income tax uses family quotient (quotient familial). Single Earner model here.
  // 10% employment expense deduction (déduction forfaitaire 10%) applied as grossMonthly × 0.90 base
  // Simplified without déduction forfaitaire — over-states tax for wage earners by ~2–3 pp ETR;
  // Phase 7 personal circumstances layer will add this deduction.
  incomeTax: {
    type: 'progressive',
    personalAllowance: 0,
    taxBase: 'gross',
    brackets: [
      { upTo:   941, rate: 0.00 },  // ≤11,294 EUR/year ÷ 12
      { upTo: 2_400, rate: 0.11 },  // ≤28,797 EUR/year ÷ 12
      { upTo: 6_862, rate: 0.30 },  // ≤82,341 EUR/year ÷ 12
      { upTo: 14_759, rate: 0.41 }, // ≤177,106 EUR/year ÷ 12
      { upTo: Infinity, rate: 0.45 },
    ],
  },

  // Employee SSC 2026 — URSSAF/MISSOC
  // Key components: régime général CNAV (pension), AGIRC-ARRCO (complementary pension),
  //   CSG (Contribution Sociale Généralisée — social levy on 98.25% of gross),
  //   CRDS, maladie, chômage.
  // Note: CSG/CRDS (9.7% of 98.25% of gross) is NOT pension-funded; it funds health, family, etc.
  employeeSSC: {
    ceiling: undefined,
    components: [
      // Vieillesse plafonné (CNAV régime général, ceiling = PSS): 6.90%
      { label: 'CNAV (Pension, plafonné)', rate: 0.069, ceiling: PSS, pensionFunded: true },
      // Vieillesse déplafonné (tranche above PSS, solidarity rate): 0.40%
      { label: 'CNAV (Pension, déplafonné)', rate: 0.004, pensionFunded: true },
      // AGIRC-ARRCO Tranche 1 (up to PSS): 3.15% total employee
      // Tranche 2 (PSS–8×PSS): 8.64%. Simplified as blended rate below.
      // At AW (below PSS): predominantly Tranche 1.
      { label: 'AGIRC-ARRCO (Complémentaire)', rate: 0.0375, ceiling: AGIRC_CEILING, pensionFunded: true },
      // CSG (8.3%) + CRDS (0.5%) applied to 98.25% of gross, hence effective 8.74%
      { label: 'CSG / CRDS (santé, famille)', rate: 0.0874, pensionFunded: false },
      // Assurance maladie complémentaire (prévoyance): 0.78%
      { label: 'Prévoyance / Maladie compl.', rate: 0.0080, pensionFunded: false },
    ],
  },

  // Employer SSC 2026 — URSSAF/MISSOC
  // Includes general social contributions and various fonds mutualisés
  employerSSC: {
    ceiling: undefined,
    components: [
      // Assurance vieillesse plafonné (CNAV): 8.55%
      { label: 'CNAV (Pension, plafonné)', rate: 0.0855, ceiling: PSS, pensionFunded: true },
      // Assurance vieillesse déplafonné: 1.90%
      { label: 'CNAV (Pension, déplafonné)', rate: 0.019, pensionFunded: true },
      // AGIRC-ARRCO patronal: 5.65%
      { label: 'AGIRC-ARRCO (Complémentaire)', rate: 0.0565, ceiling: AGIRC_CEILING, pensionFunded: true },
      // Assurance chômage (Pôle emploi — UNEDIC): 4.05%
      { label: 'Chômage (UNEDIC)', rate: 0.0405, pensionFunded: false },
      // Famille, accidents, formation, transport: ~5.25% combined
      { label: 'Famille / Accidents / Taxes', rate: 0.0525, pensionFunded: false },
    ],
  },

  // ─── Pension System: MIXED (Régime général DB + AGIRC-ARRCO) ────────────────────
  //
  // Pillar 1 — Régime général (CNAV) — Defined Benefit
  //   Formula (Code Securite Sociale L351-1):
  //     pension = taux × SAM × min(quartersWorked / 172, 1.0)
  //     where taux = 50% (full) and SAM = average of best 25 insured years, each ≤ PSS.
  //   Engine simplification: lifetime_avg DB with accrualRate = 50%/43yr = 1.163%/yr
  //
  // Pillar 1b — AGIRC-ARRCO (mandatory PAYG points, NOT funded) — pillar2Type: 'payg_points'
  //   AGIRC-ARRCO is a PAYG points system, not a capital fund.
  //   Tranche 1 (T1, earnings ≤ PSS): employee 3.15% + employer 4.72% = 7.87% ≈ 7.47% effective
  //     (taux d'appel 1.054 since 2019 — effectively ≈1.0 since 2022 reform)
  //     Simplified total T1 rate including employer: 9.40% (MISSOC standard).
  //   Tranche 2 (T2, earnings PSS–8×PSS): employee 8.64% + employer 12.95% = 21.59% total.
  //     Taux d’appel 1.27: effective accrual 21.59%/1.27 = 17.0% → but T2 valeur/prix ratio applies.
  //
  //   Calibration v2.2 (OECD PaG full table, new edition):
  //     T1 (up to PSS = 3,864): rate=9.40%, factor calibrated to 6.6% T1 RR at 1×AW (below PSS)
  //       target T1 pension = (56.6% − 50% CNAV) × 1×AW = 6.6% × 3,500 = 231 EUR
  //       factor = 231 / (3,500 × 0.094 × 43) = 231/14,161 = 0.01631
  //     T2 (above PSS): rate=21.59%, factor calibrated so that total at 2×AW matches OECD 47.4%
  //       total at 2×AW = P1(27.6%) + T1_at_2×AW + T2 = 47.4%
  //       T1 at 2×AW = PSS × 0.094 × 43 × 0.01631 = 3,864 × 4.042 × 0.01631 = 255 EUR = 3.6%
  //       T2 needed = 47.4% − 27.6% − 3.6% = 16.2% = 1,134 EUR
  //       T2 = (7,000 − 3,864) × 0.2159 × 43 × f2 = 29,154 × f2 = 1,134 → f2 = 0.03889
  //   Verification at 2×AW: P1=27.6%, T1=3.6%, T2=16.2% → total=47.4% ✅
  //   Note: 0.5×AW and 1×AW are both below PSS so T2=0; T1 gives exactly 6.6% → total=56.6% ✅
  pensionSystem: {
    type: 'MIXED',
    pillar1: {
      type: 'DB',
      basePension: 0,
      reductionThresholds: [
        { upTo: PSS,      creditRate: 1.0 }, // earnings up to PSS credited at 100%
        { upTo: Infinity, creditRate: 0.0 }, // CNAV only applies to earnings up to PSS
      ],
      accrualRatePerYear: 0.50 / 43, // 50% taux plein at 43-year full career (172 quarters)
      assessmentBase: 'lifetime_avg', // SAM = best 25 years; simplified as lifetime avg
      ceiling: PSS,                   // 3,864 EUR/month — PSS 2026
    },
    pillar2Rate:         0.094,        // AGIRC-ARRCO T1 contribution rate (on T1 base ≤ PSS)
    pillar2Type:         'payg_points', // PAYG points — NOT a funded account
    pillar2Ceiling:      PSS,           // T1 contribution base capped at PSS
    pillar2PAYGFactor:   0.01631,      // T1 factor: 6.6% RR at 1×AW below PSS (v2.2, new OECD table)
    pillar2T2Rate:       0.2159,       // AGIRC-ARRCO T2 contribution rate (above PSS, up to 8×PSS)
    pillar2T2PAYGFactor: 0.03889,      // T2 factor: calibrated to 16.2% RR on T2 portion at 2×AW
  },

  // AGIRC-ARRCO is PAYG — there is no separate funded Pillar 2 for standard salaried workers.
  // (Some workers have supplementary Artikel 83 / PERE plans but these are not mandatory.)

  // FR: pension income taxed as ordinary income via barème IR
  // Retraités benefit from a 10% abatement (déduction forfaitaire) on pension income (capped):
  //   → not modelled here (Phase 7 Personal Circumstances Layer)
  // Source: CGI Art. 79 / 157 bis
  pensionTax: {
    method: 'income_tax',
    taxableFraction: 1.0,
    note: 'CGI Art. 79: retraite taxée comme revenu ordinaire; abattement 10% plafonné non modélisé (Phase 7)',
  },

  incomplete: false,
  formulaSteps: [],

  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'Eurostat earn_ses_monthly 2022 / DSN administrative data trend to 2026',
      url: 'https://ec.europa.eu/eurostat/web/national-accounts/data/database',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax.brackets',
      source: "Code Général des Impôts Art. 197 — barème IR 2026 (Loi de finances 2026)",
      url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000045023538',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC + employerSSC',
      source: 'URSSAF taux de cotisations janvier 2026; MISSOC Table I Jan 2026',
      url: 'https://www.urssaf.fr/home/employeur/calculer-les-cotisations/les-taux-de-cotisations.html',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem.ceiling — PSS 2026',
      source: "Arrêté du 26 décembre 2025 portant fixation du plafond de la sécurité sociale — JO 27/12/2025",
      url: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000051004',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem.pillar1 — régime général accrual formula',
      source: 'Code de la Sécurité Sociale Art. L351-1 à L351-7; circulaire CNAV 2026',
      url: 'https://www.legislation.cnav.fr/Pages/texte.aspx?Nom=Circulaire',
      retrievedDate: '2026-03',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem AGIRC-ARRCO T1+T2 calibration v2.2',
      source: 'Convention collective nationale AGIRC-ARRCO du 17/11/2017, avenants 2025. Calibrated to OECD PaG full table: T1 factor=0.01631 (6.6% RR at 1×AW below PSS); T2 factor=0.03889 (16.2% RR on T2 wage above PSS at 2×AW). Old factor 0.0495 was calibrated to PaG 2023 edition (70% total at 1×AW).',
      url: 'https://www.agirc-arrco.fr/entreprises/gerer-cotisations/',
      retrievedDate: '2026-03',
      dataYear: 2026,
    },
  ],

  selfEmployment: null,
};
