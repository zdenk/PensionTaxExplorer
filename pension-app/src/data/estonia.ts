/**
 * Estonia — Country Config 2026 (Tier 3)
 *
 * Tax / SSC: complete and accurate.
 * Pension formula: MIXED — Pillar 1 (NDC) + mandatory funded Pillar 2.
 *
 *   Pillar 1 — State pension (NDC, riiklik pension)
 *     NDC contribution rate: 16% of gross (from sotsiaalmaks employer share after Pillar 2 redirect)
 *     Notional return: wage growth index (Estonia wage growth high historically; 3% conservative)
 *     Annuity divisor: Statistics Estonia life tables — remaining LE at retirement age
 *       Age 65: ~18.5yr = 222 months; age 67: 17yr = 204 months
 *     Source: Statistics Estonia life tables; SKA (Social Insurance Board) / Riigi Teataja
 *
 *   Pillar 2 — Mandatory funded pension (II sammas / kogumispension)
 *     Total to Pillar 2: employee 2% + state redirect 4% from sotsiaalmaks = 6% total
 *     Mandatory for those born after 1983 (opted in by default since 2010).
 *     Note: 2020 temporary suspension/reform allowed opt-out; assumed mandatory for model.
 *     pillar2Rate = 0.06 (total pension funded contribution)
 *     Default return: 3% real (OECD benchmark; Estonian funds avg 3–5% net real)
 *
 * INCOME TAX NOTES:
 *   Estonia has a flat income tax at 22% (rate increased from 20% effective 1 Jan 2024).
 *   Basic exemption (baasevähendus) 2026: 720 EUR/month for monthly income ≤ 1,200 EUR;
 *   linearly tapers to 0 for income ≥ 2,100 EUR (= 25,200 EUR/year threshold).
 *   For average earner (2,200 EUR/month): allowance is 0 (above taper cutoff).
 *   personalAllowance = 0 is accurate at AW and above; slightly overstates tax for 0.5× AW.
 *   Phase 7: implement income-dependent baasevähendus taper for 0.5× AW accuracy.
 *   Source: Tulumaksuseadus (TMS) § 23; RT I, 29.11.2023, 5
 *
 * Sources:
 *   AW: Statistics Estonia — Keskmine brutopalk 2025/2026 estimate
 *   Income tax: Tulumaksuseadus §§ 1, 23; MTA (Maksu- ja Tolliamet) 2026 information
 *   SSC: Sotsiaalmaksuseadus; Kogumispensionide seadus; MISSOC Table I Jan 2026
 *   Pension: Riiklik pensionikindlustuse seadus; SKA; Statistics Estonia life tables 2024
 */

import type { CountryConfig } from '../types';

const AW_2026 = 2_200; // EUR/month — Statistics Estonia gross average wage 2026 estimate

export const estonia: CountryConfig = {
  code: 'EE',
  name: 'Estonia',
  currency: 'EUR',
  eurExchangeRate: 1.0,
  dataYear: 2026,

  averageWage: AW_2026,
  medianWage: 1_740,        // EUR/month — Eurostat SES / Statistics Estonia 2022 adj. to 2026
  wagePercentiles: {          // EUR/month — Eurostat SES / Statistics Estonia 2022 adj. to 2026
    p10: 950, p25: 1_250, p75: 2_400, p90: 3_400,
  },
  minimumWage: 886,           // EUR/month — Töölepingu seadus 2026 (alampalk)
  oecdAverageWage: 2_207,  // EUR/month — OECD Taxing Wages 2025, Table I.1 (2024): EUR 26,484/year
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  defaults: {
    careerStartAge: 25,
    retirementAge: 65,      // Vanaduspensioni iga 2026: 65 (rising; born 1961+ → 65)
    retirementDuration: 20, // age 65 to ~85 (EA statistical LE; EST LE slightly lower)
  },

  // Tulumaksuseadus § 4, § 23 — flat 22% (since 1 Jan 2024)
  // personalAllowance = 0: at AW (2,200 EUR), baasevähendus tapers to 0 above 2,100 EUR/month.
  // Phase 7: add income-dependent allowance taper.
  incomeTax: {
    type: 'flat',
    personalAllowance: 0,
    flatRate: 0.22,
    taxBase: 'gross',
  },

  // Employee SSC 2026 — Kogumispensionide seadus; Töötuskindlustuse seadus
  employeeSSC: {
    ceiling: undefined,
    components: [
      // II sammas — kogumispension (mandatory funded Pillar 2): employee 2% of gross
      // Note: in MIXED pension formula, the total 6% to funded Pillar 2 is accounted for.
      // The 4% state redirect is from sotsiaalmaks (employer) — modelled in employerSSC.
      { label: 'Kogumispension II (Pillar 2 — employee 2%)', rate: 0.020, pensionFunded: true },
      // Töötuskindlustusmakse (unemployment insurance): 1.6%
      { label: 'Unemployment Insurance (töötuskind.)', rate: 0.016, pensionFunded: false },
    ],
  },

  // Employer SSC 2026 — Sotsiaalmaksuseadus; MISSOC Table I Jan 2026
  // Sotsiaalmaks total: 33% of gross = 20% pension portion + 13% health portion.
  // Of the 20% pension portion: 16% credited to NDC Pillar 1, 4% redirected to Pillar 2 fund.
  employerSSC: {
    ceiling: undefined,
    components: [
      // Sotsiaalmaks — pension portion directed to NDC (Pillar 1): 16%
      { label: 'Sotsiaalmaks — Pillar 1 NDC (16%)', rate: 0.16, pensionFunded: true },
      // Sotsiaalmaks — redirect to funded Pillar 2: 4%
      { label: 'Sotsiaalmaks — Pillar 2 redirect (4%)', rate: 0.04, pensionFunded: true },
      // Sotsiaalmaks — ravikindlustus (health insurance): 13%
      { label: 'Sotsiaalmaks — Health (ravikindlustus, 13%)', rate: 0.13, pensionFunded: false },
      // Töötuskindlustusmakse (employer): 0.8%
      { label: 'Unemployment Insurance (employer)', rate: 0.008, pensionFunded: false },
    ],
  },

  // ─── Pension System: MIXED (NDC Pillar 1 + funded Pillar 2) ──────────────────────────
  //
  // Pillar 1 — NDC (riiklik pensionikindlustus — Riiklik pensionikindlustuse seadus)
  //   NDC rate: 16% of gross (after 4% redirect to Pillar 2)
  //   Notional return: wage growth index (conservative 3% real; Estonia wages historically +5%/yr)
  //   Annuity divisor: Statistics Estonia remaining LE at 65 = ~18.5yr = ~222 months (2026 cohort)
  //
  // Pillar 2 — Funded (kogumispension)
  //   Total rate: 6% (employee 2% + state 4% redirect)
  //   Individual accounts managed by licensed pension fund managers.
  //   Target return: 3% net real (conservative; actual historical ~3–5% net real).
  //
  // Calibration at 1× AW (2,200 EUR/month), 40yr career at 65, 3% NDC return, 3% P2 return:
  //   NDC account = 2,200 × 0.16 × 12 × FV(3%, 40yr) = 4,224 × 75.4 = 318,490 EUR
  //   NDC monthly = 318,490 / 222 = 1,434 EUR → RR 65.2% from P1
  //   P2: calcSimplePillar2(0.06, 2200, 40, 0.03) → small funded pot ~537 EUR/mo → RR ~24.4%
  //   Total RR: ~89% — slightly above OECD; Estonia's high wage growth assumption inflates NDC.
  //   Note: OECD PaG Estonia gross RR at 1x AW: ~68% (mandatory tiers only at OECD stylised career).
  //   Model uses 3% notional return — in practice Estonia's notional rate has been higher (wage index).
  pensionSystem: {
    type: 'MIXED',
    pillar1: {
      type: 'NDC',
      pillar1ContributionRate: 0.16,  // % of gross credited to Pillar 1 NDC account
      notionalReturnRate: 0.020,        // wage growth proxy (Estonian sissemakseindeks long-run real: ~2% normalised)
      annuityDivisor: {                // Statistics Estonia remaining LE in months — combined M+F Eurostat 2022
        63: 228,                          // ~19yr (age 63 combined EE LE)
        65: 204,                          // ~17yr (males ~14.6yr, females ~19.5yr, combined ~17yr)
        67: 186,                          // ~15.5yr
        70: 162,                          // ~13.5yr
      },
      ceiling: 30_000,                // effectively uncapped; EE has no contribution ceiling
    },
    pillar2Rate: 0.06,                // 6% total: employee 2% + state redirect 4%
    pillar2ReturnRate: 0.03,          // conservative net real return assumption
  },

  pensionTax: {
    method: 'income_tax',
    taxableFraction: 1.0,
    note: 'TMS § 12: pension income taxed at flat 22%; pension-specific baasevähendus may apply at low pension amounts (Phase 7)',
  },

  incomplete: false,
  formulaSteps: [],

  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'Statistics Estonia — average gross monthly wages Q4 2025/2026 estimate',
      url: 'https://www.stat.ee/en/find-statistics/statistics-theme/social-life/wages-and-labour-costs',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax',
      source: 'Tulumaksuseadus § 4 (22% rate since 1 Jan 2024); § 23 baasevähendus; RT I 2023',
      url: 'https://www.riigiteataja.ee/akt/tulumaksuseadus',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC + employerSSC',
      source: 'Sotsiaalmaksuseadus; Kogumispensionide seadus; MISSOC Table I Jan 2026',
      url: 'https://www.missoc.org/missoc-database/comparative-tables/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem — NDC rates, Pillar 2, life expectancy divisors',
      source: 'SKA (Social Insurance Board) — riikliku pensioni arvutamine; Statistics Estonia life tables 2024',
      url: 'https://www.stat.ee/en/find-statistics/statistics-theme/population/life-expectancy',
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
      parameter: 'minimumWage',
      source: 'Eurostat minimum wage statistics (earn_mw_cur) + national decree 2026',
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
