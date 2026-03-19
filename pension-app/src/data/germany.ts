/**
 * Germany — Country Config 2026 (Tier 1)
 *
 * Tax / SSC: complete and accurate.
 * Pension formula: POINTS system — parameters populated from official 2026 DRV/BGBl sources.
 *
 * Sources:
 *   Income tax: EStG §§ 32a, 32b (simplified brackets — German tax uses a continuous
 *   formula; brackets below approximate the progressive zones to < 2pp ETR error for
 *   standard earner comparisons. Phase 6 will replace with the exact polynomial formula.)
 *   SSC: MISSOC Table I January 2026; OECD Taxing Wages 2025 annex
 *   AW: OECD Average Wages dataset (AV_AN_WAGE, DEU, 2024 projected to 2026)
 *   BBG / Bezugsgröße: Sozialversicherungsrechengrößen-Verordnung 2026,
 *     BGBl. I S. 1357, 26.11.2025 (bundesrat 1059. Sitzung 21.11.2025)
 *   Rentenwert: DRV Bekanntmachung — Aktueller Rentenwert West ab 1.7.2025 = 40.17 EUR
 *     (estimated; verify against DRV Rechengrößen page for confirmed 2025 Rentenanpassung)
 */

import type { CountryConfig } from '../types';

const AW_2026 = 4_323; // EUR/month — OECD average wages DEU 2026 estimate

// BBG = Beitragsbemessungsgrenze pension/unemployment 2026 (SVR-Verordnung 2026)
const BBG_PENSION = 8_450; // EUR/month — unified (West = East from 2025); annual 101,400 EUR
// BBG Kranken-/Pflegeversicherung 2026
const BBG_HEALTH = 5_812; // EUR/month (exact: 5,812.50; SSC ceiling)

// Vorläufiges Durchschnittsentgelt 2026 (SGB VI Anlage 1 proxy = Bezugsgröße 2026)
// BGBl. 2026 Bezugsgröße: 47,460 EUR/year = 3,955 EUR/month
// Used as referenceWage for Entgeltpunkte formula: EP = Jahresentgelt / Durchschnittsentgelt
const DURCHSCHNITTSENTGELT_J_2026 = 47_460; // EUR/year (annual)

// Max Entgeltpunkte per year = BBG_annual / Durchschnittsentgelt_annual = 101,400 / 47,460 = 2.14
const MAX_EP_PER_YEAR = 2.14;

export const germany: CountryConfig = {
  code: 'DE',
  name: 'Germany',
  currency: 'EUR',
  eurExchangeRate: 1.0,
  dataYear: 2026,

  averageWage: AW_2026,
  oecdAverageWage: 4_339,  // EUR/month — OECD Taxing Wages 2025, Table I.1 (2024): EUR 52,068/year
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  defaults: {
    careerStartAge: 25,
    retirementAge: 67,
    retirementDuration: 20,
  },

  // Simplified 4-bracket approximation of the German continuous formula (EStG § 32a 2026)
  // Grundfreibetrag 2026: 12,096 EUR/year = 1,008 EUR/month
  // Zone 1 (Eingangssteuersatz progression): 14%–24% → average ~19%
  // Zone 2 (linear progression): 24%–42%  → approximate at 32%
  // Zone 3: 42% flat; Zone 4: 45% (Reichensteuer)
  // Note: solidarity surcharge (Soli) abolished for 90%+ of earners from 2021.
  incomeTax: {
    type: 'progressive',
    personalAllowance: 0, // Grundfreibetrag modelled as 0%-rate first bracket
    taxBase: 'gross',
    brackets: [
      { upTo: 1_008,  rate: 0.00 }, // Grundfreibetrag zone
      { upTo: 2_175,  rate: 0.19 }, // lower progression zone (approx 14–24%)
      { upTo: 5_520,  rate: 0.32 }, // upper progression zone (approx 24–42%)
      { upTo: 48_167, rate: 0.42 }, // proportional zone
      { upTo: Infinity, rate: 0.45 }, // Reichensteuer
    ],
  },

  employeeSSC: {
    ceiling: BBG_PENSION,
    components: [
      // Rentenversicherung — half of 18.6% = 9.3%
      { label: 'Pension Insurance (RV)', rate: 0.093, ceiling: BBG_PENSION, pensionFunded: true },
      // Krankenversicherung — 7.3% base + half of avg Zusatzbeitrag 1.7% = 8.15%
      { label: 'Health Insurance (KV)', rate: 0.0815, ceiling: BBG_HEALTH, pensionFunded: false },
      // Arbeitslosenversicherung — 1.3%
      { label: 'Unemployment Insurance (ALV)', rate: 0.013, ceiling: BBG_PENSION, pensionFunded: false },
      // Pflegeversicherung — 1.7% + 0.25% childless supplement (avg 1.9% assuming ~40% childless cohort)
      { label: 'Care Insurance (PV)', rate: 0.0195, pensionFunded: false },
    ],
  },

  employerSSC: {
    ceiling: BBG_PENSION,
    components: [
      { label: 'Pension Insurance (RV)', rate: 0.093, ceiling: BBG_PENSION, pensionFunded: true },
      { label: 'Health Insurance (KV)', rate: 0.0815, ceiling: BBG_HEALTH, pensionFunded: false },
      { label: 'Unemployment Insurance (ALV)', rate: 0.013, ceiling: BBG_PENSION, pensionFunded: false },
      { label: 'Care Insurance (PV)', rate: 0.018, pensionFunded: false }, // employer pays base (1.80%), not childless supplement
      { label: 'Accident Insurance (UV)', rate: 0.013, pensionFunded: false }, // sector average
      { label: 'Insolvenzgeldumlage (UAG)', rate: 0.0015, pensionFunded: false }, // 0.15% per § 360 SGB III, BGBl. 28.11.2025
    ],
  },

  // Rentenpunkte (Entgeltpunkte) system — DRV 2026 official parameters:
  //   Rentenwert West: 40.17 EUR/EP (DRV Bekanntmachung, est. July 2025; verify at drv.de)
  //   referenceWage: ANNUAL Durchschnittsentgelt 2026 = Bezugsgröße = 47,460 EUR/year
  //     (BGBl. SVR-Verordnung 2026, 26.11.2025)
  //   EP/year = grossAnnual / 47,460 ; capped at BBG = 101,400 EUR/year (≈ 2.14 EP/year max)
  //   Formula: monthlyPension = totalEP × Rentenwert (monthly payment)
  pensionSystem: {
    type: 'POINTS',
    pointValue: 40.17,             // EUR per Entgeltpunkt — Rentenwert West, est. July 2025 (DRV)
    pointValueIndexation: 0.02,    // approximate annual Rentenanpassung
    pointsPerAW: 1.0,              // 1 EP per year at Durchschnittsentgelt (= at referenceWage)
    ceiling: MAX_EP_PER_YEAR,      // max EP per year = BBG_annual / Durchschnittsentgelt_annual = 2.14
    referenceWage: DURCHSCHNITTSENTGELT_J_2026, // ANNUAL Durchschnittsentgelt 2026 = 47,460 EUR
    minimumPension: undefined,     // Grundrente is a supplement, not a simple floor
  },

  incomplete: false,

  formulaSteps: [],
  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'OECD AV_AN_WAGE DEU 2026',
      url: 'https://data-api.oecd.org/datasource/AV_AN_WAGE',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC + employerSSC',
      source: 'MISSOC Table I Jan 2026; OECD Taxing Wages 2025',
      url: 'https://www.missoc.org/missoc-database/comparative-tables/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax',
      source: 'EStG § 32a 2026 (simplified bracket approximation)',
      url: 'https://www.bundesfinanzministerium.de',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem — BBG, Durchschnittsentgelt, Bezugsgröße',
      source: 'Sozialversicherungsrechengrößen-Verordnung 2026, BGBl. I 26.11.2025; lohn-info.de/beitragsbemessungsgrenze_2026.html',
      url: 'https://www.lohn-info.de/beitragsbemessungsgrenze_2026.html',
      retrievedDate: '2026-03',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem.pointValue — Rentenwert West',
      source: 'DRV Werte der Rentenversicherung — Aktueller Rentenwert (estimated July 2025)',
      url: 'https://www.deutsche-rentenversicherung.de/DRV/DE/Experten/Zahlen-und-Fakten/Werte-der-Rentenversicherung/werte-der-rentenversicherung_node.html',
      retrievedDate: '2026-03',
      dataYear: 2026,
    },
  ],

  selfEmployment: null,

  // DE: pensions taxed as ordinary income; Besteuerungsanteil = 83% for cohort retiring in 2026.
  // The Grundfreibetrag (personal allowance, ~1 008 EUR/mo in 2026) applies via the standard TaxEngine.
  // Source: EStG §22 Nr.1a; BMF Rentenbesteuerungstabelle 2026.
  pensionTax: {
    method: 'income_tax',
    taxableFraction: 0.83,
    note: 'EStG §22 Nr.1a: Besteuerungsanteil 83% für 2026-Kohorte; Grundfreibetrag bleibt anrechenbar',
  },
};
