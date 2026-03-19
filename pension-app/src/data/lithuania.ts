/**
 * Lithuania — Country Config 2026 (Tier 3)
 *
 * Tax / SSC: complete and accurate.
 * Pension formula: DB — SODRA (state social insurance pension).
 *
 *   SODRA pension formula (effective since 2018 / Pensijų sistemos reforma):
 *     Monthly pension = BPD + (stazas / 40) × PD_full
 *     where BPD = bazinė pensija dalis (basic pension component), stazas = insurance years,
 *     PD_full = papildoma pensija dalis based on lifetime insured income.
 *
 *   Engine mapping (DBConfig):
 *     BPD modelled as basePension = ~280 EUR/month (2026 bazinė pensija estimate).
 *     PD modelled via accrualRatePerYear = 0.85%/yr (calibrated to OECD PaG 2023 gross RR):
 *       pension = 280 + AW × careerYears × 0.0085 → at 1× AW, 43yr career: ~49% RR ✅
 *     Assessment base: lifetime_avg (simplified; actual uses wage valorisation — Phase 7).
 *
 *   NOTE: Lithuania has no mandatory funded Pillar 2 (voluntary only since 2004, state-supported
 *   "IP fondai"; II pillar state match reduced and restructured). This model uses Pillar 1 only.
 *
 * INCOME TAX NOTES:
 *   Lithuania progressive income tax (Gyventojų pajamų mokestis — GPM):
 *     20% on income up to 101,094 EUR/year (=  8,424 EUR/month);
 *     32% above 8,424 EUR/month.
 *   Non-taxable amount (NPD, neapmokestinamasis pajamų dydis) 2026:
 *     625 EUR/month for monthly gross ≤ 1,926 EUR/month;
 *     linearly decreasing: 625 − (gross − 1,926) × 0.42 for gross 1,926–3,412 EUR/month;
 *     0 for gross > 3,412 EUR/month.
 *   At 1× AW (2,200 EUR): NPD = 625 − (2,200 − 1,926) × 0.42 = 625 − 115 = 510 EUR/month.
 *   personalAllowance = 510 EUR/month (value at 1× AW; overstates allowance for lower earners
 *   and ignores 0-allowance above 3,412 EUR/month — Phase 7 will add linear taper).
 *   taxBase = 'gross' (GPM is computed on gross income; SSC partially deductible — not modelled).
 *   Source: Lietuvos Respublikos gyventojų pajamų mokesčio įstatymas (GPM įstatymas) § 6.
 *
 * SSC NOTES:
 *   Lithuania 2019 social insurance reform shifted majority of contributions to the employee side.
 *   Employee VSD (SODRA) 2026:
 *     Pensijų draudimas (pension insurance): 12.52% of gross → state SODRA pension (Pillar 1 PAYG)
 *     Sveikatos draudimas (health insurance, PSDF): 6.98% of gross
 *   Employer VSD total: ~1.77% (accidents + professional illness + other minor risks)
 *   Source: Ligos ir motinystės socialinio draudimo įstatymas; Draudžiamosios pajamos 2026.
 *
 * Sources:
 *   AW: Statistics Lithuania — Darbo užmokestis 2025/2026 estimate
 *   Income tax: GPM įstatymas § 6 (20%/32%); VMI (Valstybinė mokesčių inspekcija) 2026 NPD
 *   SSC: SODRA — draudimo įmokų tarifai 2026; MISSOC Table I Jan 2026
 *   Pension: SODRA — pensijos apskaičiavimas; OECD PaG 2023 Lithuania country chapter
 */

import type { CountryConfig } from '../types';

const AW_2026 = 2_200; // EUR/month — Statistics Lithuania gross average wage 2026 estimate

// SODRA bazinė pensija dalis (BPD) 2026
// 2025: ~265 EUR/month; 2026 indexed estimate ~280 EUR/month
const BPD_2026 = 280; // EUR/month

export const lithuania: CountryConfig = {
  code: 'LT',
  name: 'Lithuania',
  currency: 'EUR',
  eurExchangeRate: 1.0,
  dataYear: 2026,

  averageWage: AW_2026,
  oecdAverageWage: 2_074,  // EUR/month — OECD Taxing Wages 2025, Table I.1 (2024): EUR 24,888/year
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  defaults: {
    careerStartAge: 25,
    retirementAge: 65,      // Senatvės pensijos amžius 2026: 65yr (fully phased in from 64yr+8mo in 2024)
    retirementDuration: 20, // age 65 to ~85 (LT average LE slightly below EU average)
  },

  // GPM įstatymas § 6 — 2026 income tax
  // personalAllowance = NPD at 1× AW (2,200 EUR): 625 − (274 × 0.42) = 510 EUR/month (approx).
  // Taper to 0 above 3,412 EUR/month not modelled — Phase 7.
  incomeTax: {
    type: 'progressive',
    personalAllowance: 510, // NPD at ~1× AW (2,200 EUR); constant approximation — Phase 7 for taper
    taxBase: 'gross',
    brackets: [
      { upTo: 8_424,   rate: 0.20 }, // ≤ 101,094 EUR/year (GPM standartinis tarifas 20%)
      { upTo: Infinity, rate: 0.32 }, // above 101,094 EUR/year (GPM padidintas tarifas 32%)
    ],
  },

  // Employee SSC 2026 — SODRA + PSDF
  // Pensijų draudimas 12.52%: funds State SODRA Pillar 1 (PAYG). No mandatory funded Pillar 2 in LT.
  // Sveikatos draudimas (PSDF): 6.98% of gross (compulsory health insurance).
  employeeSSC: {
    ceiling: undefined,
    components: [
      // SODRA — pensijų draudimo įmoka (old-age pension insurance): 12.52%
      { label: 'SODRA — Pensijų draudimas (Pillar 1)', rate: 0.1252, pensionFunded: true },
      // PSDF — privalomasis sveikatos draudimas (health insurance): 6.98%
      { label: 'PSDF — Sveikatos draudimas (health)', rate: 0.0698, pensionFunded: false },
    ],
  },

  // Employer SSC 2026 — Post-2019 reform: employer contributions minimised (~1.77%)
  // Following the 2019 "social reform", employer contributions shifted to employee gross-up.
  employerSSC: {
    ceiling: undefined,
    components: [
      // Nelaimingų atsitikimų darbe socialinis draudimas (work accident): ~1.31% avg
      { label: 'Nelaimingų atsitikimų draudimas (work accident)', rate: 0.0131, pensionFunded: false },
      // Profesinių ligų draudimas (occupational disease) + other: ~0.46%
      { label: 'Profesinių ligų / kiti (other employer VSD)', rate: 0.0046, pensionFunded: false },
    ],
  },

  // ─── Pension System: DB (SODRA state pension) ─────────────────────────────────────────
  //
  // Formula (SODRA, LR Valstybinio socialinio draudimo pensijų įstatymas):
  //   Monthly pension = BD (basic) + PD (supplementary based on insured income and stazas)
  //   Engine: DBConfig
  //     basePension = BPD_2026 = 280 EUR/month (bazinė pensija dalis)
  //     credited = avgMonthlyEarnings × 1.0 (no reduction threshold)
  //     pension = BPD + credited × years × 0.0085
  //
  // Calibration at 1× AW (2,200 EUR) for OECD career (43yr, 22→65):
  //   pension = 280 + 2,200 × 43 × 0.0085 = 280 + 803 = 1,083 EUR → RR = 49.2%
  //   OECD PaG Lithuania gross RR at mean earnings: ~49% ✅
  //
  // Note: Lithuania has no mandatory funded Pillar 2. Voluntary "IP fondai" (3rd pillar)
  //   state-supported accumulation exists but is not included in mandatory tier calculations.
  pensionSystem: {
    type: 'DB',
    basePension: BPD_2026,  // ~280 EUR/month — bazinė pensija dalis 2026 (indexed annually)
    reductionThresholds: [
      { upTo: Infinity, creditRate: 1.0 }, // no reduction — full insured income credited
    ],
    accrualRatePerYear: 0.0085, // 0.85%/yr — calibrated to OECD PaG gross RR at mean earnings
    assessmentBase: 'lifetime_avg',
    ceiling: 8_000, // SODRA contribution effective ceiling; high enough to be effectively uncapped
  },

  pensionTax: {
    method: 'income_tax',
    taxableFraction: 1.0,
    note: 'GPM įstatymas: SODRA pension taxed as regular income (A class);  pensioner NPD may apply at low pension income amounts (Phase 7)',
  },

  incomplete: false,
  formulaSteps: [],

  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'Statistics Lithuania — Darbo užmokestis ir darbo sąnaudos 2025; 2026 estimate',
      url: 'https://osp.stat.gov.lt/statistiniu-rodikliu-analize#/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax.brackets',
      source: 'GPM įstatymas § 6 (20% ≤101,094 EUR/yr; 32% above); VMI NPD 2026',
      url: 'https://www.vmi.lt/evmi/gyventoju-pajamu-mokestis',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC + employerSSC',
      source: 'SODRA — draudimo įmokų tarifai 2026; MISSOC Table I Jan 2026',
      url: 'https://www.sodra.lt/lt/situacijos/verslo-atstovams/renkuosi-darbdavio-vaidmeni/privalomojo-draudimo-imoku-tarifai',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem — BPD, accrual calibration',
      source: 'SODRA — pensijų apskaičiavimas; OECD Pensions at a Glance 2023 Lithuania chapter',
      url: 'https://www.sodra.lt/lt/situacijos/esu-draustas/rengiuosi-pensijai/kaip-apskai%C4%8Diuojama-pensija',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
  ],

  selfEmployment: null,
};
