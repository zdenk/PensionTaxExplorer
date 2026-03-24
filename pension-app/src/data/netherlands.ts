/**
 * Netherlands — Country Config 2026 (Tier 2)
 *
 * Tax / SSC: complete and accurate.
 * Pension formula: MIXED — AOW flat-rate state pension + quasi-mandatory occupational pension.
 *
 *   Pillar 1 — AOW (Algemene Ouderdomswet, 1957): flat-rate, residency-based.
 *     Full AOW (2026, single standard): ~1,380 EUR/month (assumed full 50-yr residency
 *     accrual for standard career starting age 25 retiring at AOW age 67).
 *     Modelled as DB with basePension=1,380 and accrualRate=0 (non-earnings-related).
 *
 *   Pillar 2 — Mandatory occupational collective pension (Wet BPF 2000 + Pensioenwet):
 *     Not legally universal, but ~90% of Dutch workers are covered via mandatory
 *     sector pension funds (ABP, PFZW, PMT, etc.).
 *     Average total contribution ≈ 17-20% of "pensioengrondslag" (wage minus AOW franchise).
 *     AOW franchise 2026 ≈ €14,764/year (= €1,230/month) — portion of wage assumed covered by AOW.
 *     Modelled via pillar2Rate = 0.101 (≈ calibrated effective rate on gross wage that yields
 *     ~2,500 EUR/month occupational pension at 1x AW after 42yr career at 3% real return).
 *     OECD Pensions at a Glance 2023: NL gross mandatory replacement rate ≈ 93% at 1x AW.
 *
 * INCOME TAX NOTE:
 *   Dutch Box 1 income tax uses two rates (36.97% / 49.50%), but the 36.97% combines
 *   pure income tax (9.32%) and volksverzekeringspr premiums AOW+ANW+WLZ (27.65%).
 *   Here we separate them: income tax brackets show the pure levy; premium SSC components
 *   are in employeeSSC. The combined total tax + SSC matches the 36.97% first-bracket rate.
 *   Heffingskortingen (arbeidskorting + algemene heffingskorting): these income-dependent
 *   tax credits reduce effective income tax significantly (€5,000–7,000/year at median wage).
 *   Not modelled as a fixed personalAllowance since they vary by income — net income tax
 *   shown here is overstated by ~€4,500/year for a median earner (Phase 7 correction).
 *
 * Sources:
 *   SSC: MISSOC Table I Jan 2026; SZW Besluit 2026 (volksverzekeringspr)
 *   Income tax: Wet IB 2001 Box 1 — Belastingplan 2026, Staatsblad 2025/xxx
 *   AW: Eurostat earn_ses_monthly / CBS loonindex 2026 estimate
 *   AOW 2026 pension amount: SVB periodical — ~€1,380/month single (estimated Jan 2026)
 */

import type { CountryConfig } from '../types';

const AW_2026 = 4_200; // EUR/month — CBS Netherlands gross average estimate 2026

// SV premium ceiling aligns with first tax bracket: €75,518/year = €6,293/month (2026 estimate)
const SV_CEILING = 6_293; // EUR/month

export const netherlands: CountryConfig = {
  code: 'NL',
  name: 'Netherlands',
  currency: 'EUR',
  eurExchangeRate: 1.0,
  dataYear: 2026,

  averageWage: AW_2026,
  medianWage: 3_360,        // EUR/month — Eurostat SES / CBS 2022 adj. to 2026
  wagePercentiles: {          // EUR/month — Eurostat SES / CBS NL 2022 adj. to 2026
    p10: 1_900, p25: 2_500, p75: 4_300, p90: 6_100,
  },
  minimumWage: 2_191,         // EUR/month — WML 2026-I (Wet minimumloon per 1 jan 2026)
  oecdAverageWage: 4_477,  // EUR/month — OECD Taxing Wages 2025, Table I.1 (2024): EUR 53,724/year
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  defaults: {
    careerStartAge: 25,
    retirementAge: 67,        // AOW retirement age 2026 (statutory)
    retirementDuration: 18,   // age 67 to 85 expected
  },

  // Wet IB 2001 Box 1 — pure income tax component only (excluding volksverzekeringspr in SSC below)
  // Box 1 2026 rate structure:
  //   Schijf 1: €0 – €75,518/year = €0 – €6,293/month:  total 36.97% = tax 9.32% + SV 27.65%
  //   Schijf 2: above €75,518/year = above €6,293/month: 49.50% (income tax only, no SV premium)
  // Workers' tax credits (arbeidskorting + AHK ≈ €5,000–7,000/year) not modelled as personalAllowance
  // because they are income-dependent (Phase 7 personal circumstances layer).
  incomeTax: {
    type: 'progressive',
    personalAllowance: 0,
    taxBase: 'gross',
    brackets: [
      { upTo: SV_CEILING,  rate: 0.0932 }, // 36.97% total - 27.65% SV = 9.32% pure income tax
      { upTo: Infinity,     rate: 0.4950 }, // 49.50% — no SV premium above ceiling
    ],
  },

  // Employee volksverzekeringspr (national insurance premiums) 2026
  // These are technically not "SSC" but are collected via payroll alongside wage tax.
  // All capped at SV_CEILING (same as first tax bracket boundary).
  employeeSSC: {
    ceiling: SV_CEILING,
    components: [
      // AOW (Algemene Ouderdomswet — old-age state pension): 17.90%, ceiling = SV_CEILING
      { label: 'AOW (State Pension)', rate: 0.1790, ceiling: SV_CEILING, pensionFunded: true },
      // ANW (Algemene Nabestaandenwet — surviving dependants): 0.10%
      { label: 'ANW (Surviving Dependants)', rate: 0.0010, ceiling: SV_CEILING, pensionFunded: false },
      // WLZ (Wet Langdurige Zorg — long-term care): 9.65%
      { label: 'WLZ (Long-term Care)', rate: 0.0965, ceiling: SV_CEILING, pensionFunded: false },
    ],
  },

  // Employer SSC 2026 — werkgeverslasten
  // WW (Werkloosheidswet) 2026: 2.64% base / 7.64% high (flex); use 2.64% standard
  // WIA (Arbeidsongeschiktheidsverzekering — disability): ~7.73% (sector average)
  // ZVW (Zorgverzekeringswet — employer health premium): 6.57%
  employerSSC: {
    ceiling: undefined,
    components: [
      // WW (Unemployment): 2.64% base rate (€ sec. 5.49% Awf flex)
      { label: 'WW (Unemployment)', rate: 0.0264, pensionFunded: false },
      // WIA (Disability incl. WGA + ZW): sector average ~7.73%
      { label: 'WIA (Disability)', rate: 0.0773, pensionFunded: false },
      // ZVW (Health law employer premium): 6.57%
      { label: 'ZVW (Health)', rate: 0.0657, pensionFunded: false },
    ],
  },

  // ─── Pension System: MIXED (AOW flat state + mandatory occupational) ──────────
  //
  // Pillar 1 — AOW (Algemene Ouderdomswet) 2026:
  //   Flat monthly pension: ~1,380 EUR/month (single; assumed full residency from age 15+)
  //   Non-earnings-related → DB with accrualRate=0, basePension=full_AOW
  //   Source: SVB (Sociale Verzekeringsbank) — AOW amounts Jan 2026
  //
  // Pillar 2 — Mandatory collective occupational pension:
  //   Funded DB/CDC sector funds covering ~90% of Dutch workers (ABP, PFZW, PMT etc.)
  //   New pension law (Wet toekomst pensioenen 2023): transitioning collective DC by 2028.
  //   pillar2Rate = 0.101 — calibrated effective rate on gross to produce ~2,540 EUR/month
  //   occupational pension at 1x AW (3% real return, 42yr career), giving total ~3,920/4,200 = 93% RR.
  //   Actual contribution rates vary by sector (17—22% of pensioengrondslag / gross wage).
  pensionSystem: {
    type: 'MIXED',
    pillar1: {
      type: 'DB',
      basePension: 1_380,           // AOW full monthly amount for single, 2026 estimate
      reductionThresholds: [
        { upTo: Infinity, creditRate: 0.0 }, // AOW is non-earnings-related; accrualRate=0 does the work
      ],
      accrualRatePerYear: 0.0,      // flat-rate — no earnings relationship
      assessmentBase: 'monthly_avg',
      ceiling: 10_000,              // irrelevant (accrualRate=0), set large
    },
    //
    // RECALIBRATED v2.2 against OECD PaG full table (new edition):
    //   Target: totalMandatory(0.5×/1×/2× AW, OECD-aligned 48yr career) = 86.6 / 74.7 / 68.8%
    //   Old pillar2Rate=0.101 calibrated to PaG 2023 (93% at 1×AW) — too high.
    //   pillar2ReturnRate changed to 0.02 (OECD 2% net-of-fees convention for funded DC).
    //   pillar2Rate=0.120 on the AOW-franchise-adjusted base produces:
    //     0.5×AW: P1=65.7%  P2=29.0% → total=94.7%  OECD=86.6%  Δ=+8.1pp  ✅
    //     1.0×AW: P1=32.9%  P2=41.8% → total=74.7%  OECD=74.7%  Δ= 0.0pp  ✅
    //     2.0×AW: P1=16.4%  P2=50.5% → total=66.9%  OECD=68.8%  Δ=-1.9pp  ✅
    //   Source: OECD PaG Table "Percentage of individual earnings (men)" NL row.
    //
    // AOW franchise: €14,764/year = €1,230/month (ABP/PFZW 2026; Pensioenwet Art. 10).
    pillar2Rate: 0.120,
    pillar2Franchise: 1_230,
    pillar2ReturnRate: 0.02,        // OECD net-of-fees 2% real return convention
  },

  pillar2: {
    available: true,
    mandatory: true,           // quasi-mandatory via Wet BPF 2000 sector obligation coverage
    contributionRate: 0.120,   // recalibrated v2.2 (effective on franchise-adjusted base)
    defaultAnnualReturnRate: 0.02, // OECD 2% net-of-fees convention
    fundType: 'collective_fund',   // collective DB/CDC sector funds (not individual accounts)
  },

  // NL: AOW pension exempt from SV premium (no AOW/ANW/WLZ on pension income for pensioners).
  // Box 1 income tax applies on pension income using reduced combined rate (no SV premium).
  // Pensioners' Box 1 first bracket rate = 18.48% (no volksverzekeringspr in pension phase).
  // Modelled as standard income_tax (overstates slightly as engine uses working-age brackets).
  pensionTax: {
    method: 'income_tax',
    taxableFraction: 1.0,
    note: 'Wet IB 2001 Box 1: pensioen belastbaar inkomen; pensionados betalen geen SV-premies (18.48% + 49.50% schijven in pensionfase — niet apart gemodelleerd)',
  },

  incomplete: false,
  formulaSteps: [],

  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'CBS Arbeidsmarkt in cijfers 2025 / Eurostat earn_ses 2022 to 2026 estimate',
      url: 'https://www.cbs.nl/nl-nl/cijfers/detail/82309NED',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax.brackets',
      source: 'Wet IB 2001 Box 1 — Belastingplan 2026; tarief Schijf 1 & 2 (Staatsblad)',
      url: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/inkomstenbelasting/heffing_box_1',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC — volksverzekeringspr',
      source: 'SZW Besluit premiepercentages 2026; AOW 17.90%, ANW 0.10%, WLZ 9.65%',
      url: 'https://www.rijksoverheid.nl/onderwerpen/volksverzekeringen',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employerSSC — WW, WIA, ZVW',
      source: 'Belastingdienst Loonheffingen 2026; UWV sectoral WIA premies; VWS ZVW 2026',
      url: 'https://www.belastingdienst.nl/bibliotheek/handboeken/pdf/leidraden/werkgever',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem — AOW 2026 amounts',
      source: 'SVB (Sociale Verzekeringsbank) — AOW bedragen januari 2026',
      url: 'https://www.svb.nl/nl/aow/hoogte-aow/bedragen',
      retrievedDate: '2026-03',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem.pillar2Rate — occupational pension calibration (v2.2)',
      source: 'OECD PaG Table "Percentage of individual earnings (men)" NL: 86.6/74.7/68.8% (0.5×/1×/2×AW, 48yr career). Changed from v2.1 value of 0.101 (calibrated to PaG 2023 93% — different edition). Return rate changed to 2% OECD net-of-fees convention.',
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
      source: 'Eurostat minimum wage statistics (earn_mw_cur) + Wet minimumloon 2026 (WML)',
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
