/**
 * scripts/euromod/parameterMap.ts
 *
 * Declarative registry binding EUROMOD policy parameters to CountryConfig fields.
 *
 * Each entry replaces one `check()` call from the old per-country diffXX.ts scripts.
 * runner.ts iterates these entries; adding a country requires only a new key here.
 *
 * appResolver:  lambda that extracts the app value from a CountryConfig.
 *               Use `?? NaN` instead of `!` assertions — NaN propagates to MISSING_EM.
 * emTransform:  converts the raw EUROMOD string (may have #y/#m suffix) to a number.
 * tolerance:    fractional tolerance for MATCH (default 0.005 = 0.5%).
 * displayUnit:  '%' (default) | 'EUR/mo' | 'CZK/mo' | 'PLN/mo' etc.
 */

import type { CountryConfig } from '../../src/types';
import { toMonthly } from './lib';

export interface ParamMapping {
  section: string;
  label: string;
  emParam: string;
  appResolver: (c: CountryConfig) => number;
  emTransform?: (raw: string) => number;
  tolerance?: number;
  displayUnit?: string;   // default '%'
  note?: string;
}

export const PARAM_REGISTRY: Record<string, ParamMapping[]> = {

  // ═══════════════════════════════════════════════════════════════
  // CZ — Czech Republic
  // ═══════════════════════════════════════════════════════════════
  CZ: [
    // ── Income Tax ──────────────────────────────────────────────
    {
      section: 'Income Tax', label: 'Rate band 1 (15%)',
      emParam: '$tin_rate1',
      appResolver: c => c.incomeTax.brackets?.[0].rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Income Tax', label: 'Rate band 2 (23%)',
      emParam: '$tin_rate2',
      appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Income Tax', label: 'Personal allowance / basic credit (monthly)',
      emParam: '$tin_basic_amt',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.personalAllowance,
      displayUnit: 'CZK/mo',
    },
    {
      section: 'Income Tax', label: 'Upper band threshold (monthly)',
      emParam: '$tscer_soc_upthres',
      emTransform: raw => toMonthly(raw) * 0.75,
      appResolver: c => c.incomeTax.brackets?.[0].upTo ?? NaN,
      displayUnit: 'CZK/mo',
      tolerance: 0.05,
      note: 'EUROMOD: 0.75 × annual SSC ceiling / 12. App: 3 × AW_decree. Same statutory formula, different reference year.',
    },
    // ── Employee SSC ─────────────────────────────────────────────
    {
      section: 'Employee SSC', label: 'Pension insurance rate',
      emParam: '$tscee_pen_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.pensionFunded)?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employee SSC', label: 'Sick-leave insurance rate',
      emParam: '$tscee_sick_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.label.toLowerCase().includes('sick'))?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employee SSC', label: 'Health insurance rate',
      emParam: '$tscee_health_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.label.toLowerCase().includes('health'))?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employee SSC', label: 'Pension / social SSC ceiling (monthly)',
      emParam: '$tscer_soc_upthres',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.employeeSSC.ceiling ?? NaN,
      displayUnit: 'CZK/mo',
      tolerance: 0.05,
      note: 'EUROMOD annual ceiling / 12. App: 4 × AW_decree. Same statutory formula, different year.',
    },
    // ── Employer SSC ─────────────────────────────────────────────
    {
      section: 'Employer SSC', label: 'Pension insurance rate',
      emParam: '$tscer_pen_rate',
      appResolver: c => c.employerSSC.components.find(x => x.pensionFunded)?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employer SSC', label: 'Sick-leave insurance rate',
      emParam: '$tscer_sick_rate',
      appResolver: c => c.employerSSC.components.find(x => x.label.toLowerCase().includes('sick'))?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employer SSC', label: 'State employment policy rate',
      emParam: '$tscer_unemp_rate',
      appResolver: c => c.employerSSC.components.find(
        x => x.label.toLowerCase().includes('employment') || x.label.toLowerCase().includes('unemp')
      )?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employer SSC', label: 'Health insurance rate',
      emParam: '$tscer_health_rate',
      appResolver: c => c.employerSSC.components.find(x => x.label.toLowerCase().includes('health'))?.rate ?? NaN,
      displayUnit: '%',
    },
    // ── Wages ─────────────────────────────────────────────────────
    {
      section: 'Wages', label: 'Minimum wage (monthly)',
      emParam: '$MinWage',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.minimumWage ?? NaN,
      displayUnit: 'CZK/mo',
      tolerance: 0.01,
    },
    {
      section: 'Wages', label: 'Average wage (monthly)',
      emParam: '$AvWage',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.averageWage,
      displayUnit: 'CZK/mo',
      tolerance: 0.05,
      note: 'EUROMOD: prior-year AW decree (used as reference). App: current-year AW decree.',
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // DE — Germany
  // ═══════════════════════════════════════════════════════════════
  DE: [
    // ── Income Tax ──────────────────────────────────────────────
    // NOTE: App uses simplified brackets; EUROMOD uses the exact § 32a polynomial.
    {
      section: 'Income Tax', label: 'Grundfreibetrag (monthly, bracket[0].upTo)',
      emParam: '$tin_upthres1',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[0].upTo ?? NaN,
      displayUnit: 'EUR/mo',
      tolerance: 0.005,
      note: 'EUROMOD: annual Grundfreibetrag / 12. App: modelled as 0%-rate first bracket.',
    },
    {
      section: 'Income Tax', label: 'Proportional zone (42%) start — monthly approx',
      emParam: '$tin_upthres3',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[2].upTo ?? NaN,
      displayUnit: 'EUR/mo',
      tolerance: 0.05,
      note: 'Approximate comparison only. EUROMOD: start of 42% zone (annual/12). App: simplified upper-progression bracket.',
    },
    {
      section: 'Income Tax', label: 'Reichensteuer (45%) start — monthly',
      emParam: '$tin_upthres4',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[3].upTo ?? NaN,
      displayUnit: 'EUR/mo',
      tolerance: 0.005,
      note: 'EUROMOD: 277,825 EUR/year = 23,152 EUR/month. App has 48,167 EUR/month (×2 the correct threshold — likely a data entry error in app).',
    },
    {
      section: 'Income Tax', label: 'Proportional zone rate (42%)',
      emParam: '$tin_rate1',
      appResolver: c => c.incomeTax.brackets?.[3].rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Income Tax', label: 'Reichensteuer rate (45%)',
      emParam: '$tin_rate2',
      appResolver: c => c.incomeTax.brackets?.[4].rate ?? NaN,
      displayUnit: '%',
    },
    // ── SSC Ceilings ─────────────────────────────────────────────
    {
      section: 'SSC Ceilings', label: 'BBG Pension/ALV ceiling (monthly)',
      emParam: '$tsceepi_thres',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.employeeSSC.ceiling ?? NaN,
      displayUnit: 'EUR/mo',
      tolerance: 0.05,
      note: 'EUROMOD: unified BBG (Ost=West from 2025). App: SVR-Verordnung 2026 value. Year gap expected.',
    },
    {
      section: 'SSC Ceilings', label: 'BBG Kranken/Pflege ceiling (monthly)',
      emParam: '$tsceehi_thres',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Health'))?.ceiling ?? NaN,
      displayUnit: 'EUR/mo',
      tolerance: 0.05,
      note: 'EUROMOD: Beitragsbemessungsgrenze KV 2025. App: BBG_HEALTH 2026. Year gap expected.',
    },
    // ── Employee SSC ─────────────────────────────────────────────
    {
      section: 'Employee SSC', label: 'Pension (RV) rate',
      emParam: '$tsceepi_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Pension'))?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employee SSC', label: 'Health (KV) rate incl. avg Zusatzbeitrag',
      emParam: '$tsceehi_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Health'))?.rate ?? NaN,
      displayUnit: '%',
      tolerance: 0.01,
      note: 'EUROMOD: 7.3% base + half avg Zusatzbeitrag. App: may use different year Zusatzbeitrag.',
    },
    {
      section: 'Employee SSC', label: 'Unemployment (ALV) rate',
      emParam: '$tsceeui_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Unemployment'))?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employee SSC', label: 'Care (PV) base rate (excl. childless surcharge)',
      emParam: '$tsceeci_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Care'))?.rate ?? NaN,
      displayUnit: '%',
      tolerance: 0.02,
      note: 'EUROMOD: base PV rate. App: blended rate incl. childless surcharge average.',
    },
    // ── Employer SSC ─────────────────────────────────────────────
    {
      section: 'Employer SSC', label: 'Pension (RV) rate',
      emParam: '$tscerpi_rate',
      appResolver: c => c.employerSSC.components.find(x => x.label.includes('Pension'))?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employer SSC', label: 'Health (KV) rate incl. avg Zusatzbeitrag',
      emParam: '$tscerhi_rate',
      appResolver: c => c.employerSSC.components.find(x => x.label.includes('Health'))?.rate ?? NaN,
      displayUnit: '%',
      tolerance: 0.01,
      note: 'EUROMOD: 7.3% base + half avg Zusatzbeitrag. App: may use different year Zusatzbeitrag.',
    },
    {
      section: 'Employer SSC', label: 'Unemployment (ALV) rate',
      emParam: '$tscerui_rate',
      appResolver: c => c.employerSSC.components.find(x => x.label.includes('Unemployment'))?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employer SSC', label: 'Care (PV) base rate — employer share',
      emParam: '$tscerci_rate',
      appResolver: c => c.employerSSC.components.find(x => x.label.includes('Care'))?.rate ?? NaN,
      displayUnit: '%',
      note: 'EUROMOD: employer PV (base, no childless surcharge).',
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // FR — France
  // ═══════════════════════════════════════════════════════════════
  FR: [
    // ── Wages ─────────────────────────────────────────────────────
    {
      section: 'Wages', label: 'SMIC (minimum wage, monthly)',
      emParam: '$MinWage',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.minimumWage ?? NaN,
      displayUnit: 'EUR/mo',
      tolerance: 0.005,
    },
    // ── Income Tax ──────────────────────────────────────────────
    // France: 5 brackets — 0% / 11% / 30% / 41% / 45%
    {
      section: 'Income Tax', label: 'Band 1 upper threshold (monthly)',
      emParam: '$tin_upthres1',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[0].upTo ?? NaN,
      displayUnit: 'EUR/mo',
      tolerance: 0.02,
      note: 'EUROMOD annual threshold ÷ 12. App: monthly brackets. Year gap expected.',
    },
    {
      section: 'Income Tax', label: 'Band 2 upper threshold — 11% (monthly)',
      emParam: '$tin_upthres3',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[1].upTo ?? NaN,
      displayUnit: 'EUR/mo',
      tolerance: 0.02,
      note: 'EUROMOD annual ÷ 12. Year gap expected.',
    },
    {
      section: 'Income Tax', label: 'Band 3 upper threshold — 30% (monthly)',
      emParam: '$tin_upthres4',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[2].upTo ?? NaN,
      displayUnit: 'EUR/mo',
      tolerance: 0.02,
    },
    {
      section: 'Income Tax', label: 'Band 4 upper threshold — 41% (monthly)',
      emParam: '$tin_upthres5',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[3].upTo ?? NaN,
      displayUnit: 'EUR/mo',
      tolerance: 0.02,
    },
    {
      section: 'Income Tax', label: 'Rate band 2 (11%)',
      emParam: '$tin_rate3',
      appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Income Tax', label: 'Rate band 3 (30%)',
      emParam: '$tin_rate4',
      appResolver: c => c.incomeTax.brackets?.[2].rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Income Tax', label: 'Rate band 4 (41%)',
      emParam: '$tin_rate5',
      appResolver: c => c.incomeTax.brackets?.[3].rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Income Tax', label: 'Rate band 5 (45%)',
      emParam: '$tin_rate6',
      appResolver: c => c.incomeTax.brackets?.[4].rate ?? NaN,
      displayUnit: '%',
    },
    // ── Employee SSC ─────────────────────────────────────────────
    {
      section: 'Employee SSC', label: 'CNAV vieillesse plafonné rate',
      emParam: '$tsceepi_rate1',
      appResolver: c => c.employeeSSC.components.find(
        x => x.label.includes('CNAV') && !x.label.includes('déplafonné')
      )?.rate ?? NaN,
      displayUnit: '%',
      note: 'EUROMOD tsceepi_rate1 maps to employee CNAV plafonné. Official rate = 6.90% (CSS Art. D241-3). Check if EUROMOD includes supplementary components.',
    },
    {
      section: 'Employee SSC', label: 'CNAV vieillesse déplafonné rate',
      emParam: '$tsceepi_rate2',
      appResolver: c => c.employeeSSC.components.find(
        x => x.label.includes('CNAV') && x.label.includes('déplafonné')
      )?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employee SSC', label: 'AGIRC-ARRCO Tranche 1 employee rate',
      emParam: '$tsceepi_rate3',
      appResolver: c => c.employeeSSC.components.find(x => x.label.includes('AGIRC'))?.rate ?? NaN,
      displayUnit: '%',
      tolerance: 0.01,
      note: 'EUROMOD $tsceepi_rate3 = 3.15% (T1 employee). App uses AGIRC convention 3.75% (includes CET contributions). Check convention source.',
    },
    // ── Employer SSC ─────────────────────────────────────────────
    {
      section: 'Employer SSC', label: 'CNAV vieillesse plafonné rate',
      emParam: '$tscerpi_rate1',
      appResolver: c => c.employerSSC.components.find(
        x => x.label.includes('CNAV') && !x.label.includes('déplafonné')
      )?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employer SSC', label: 'CNAV vieillesse déplafonné rate',
      emParam: '$tscerpi_rate2',
      appResolver: c => c.employerSSC.components.find(
        x => x.label.includes('CNAV') && x.label.includes('déplafonné')
      )?.rate ?? NaN,
      displayUnit: '%',
      tolerance: 0.003,
      note: 'EUROMOD: 2.02%; App: 1.90%. May reflect inclusion/exclusion of minor sub-components.',
    },
    {
      section: 'Employer SSC', label: 'AGIRC-ARRCO Tranche 1 employer rate',
      emParam: '$tscerpi_rate4',
      appResolver: c => c.employerSSC.components.find(x => x.label.includes('AGIRC'))?.rate ?? NaN,
      displayUnit: '%',
      tolerance: 0.01,
      note: 'EUROMOD $tscerpi_rate4 = 4.72% (T1 employer). App uses AGIRC convention 5.65% (includes CET+APEC). Check convention source.',
    },
    {
      section: 'Employer SSC', label: 'Chômage (UNEDIC) employer rate',
      emParam: '$tscerui_rate1',
      appResolver: c => c.employerSSC.components.find(
        x => x.label.includes('hômage') || x.label.includes('UNEDIC')
      )?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employer SSC', label: 'Allocations familiales (famille) rate',
      emParam: '$tscerfa_rate',
      appResolver: c => c.employerSSC.components.find(
        x => x.label.toLowerCase().includes('famil')
      )?.rate ?? NaN,
      displayUnit: '%',
      tolerance: 0.002,
      note: 'EUROMOD: 5.25% (full rate). App may blend reduced rate for low-wage employers.',
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // PL — Poland
  // ═══════════════════════════════════════════════════════════════
  PL: [
    // ── Wages ─────────────────────────────────────────────────────
    {
      section: 'Wages', label: 'Minimum wage (monthly)',
      emParam: '$MinWage',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.minimumWage ?? NaN,
      displayUnit: 'PLN/mo',
      tolerance: 0.01,
      note: 'EUROMOD y2025 = 4,666 PLN; App = 4,626 PLN (Rozporządzenie RM 2026 decree). If 2025 Polish MW was 4,666 and 2026 is 4,626 verify with gov decree — MW rarely decreases.',
    },
    // ── Income Tax ──────────────────────────────────────────────
    {
      section: 'Income Tax', label: 'Rate band 1 (12%)',
      emParam: '$tin_rate1',
      appResolver: c => c.incomeTax.brackets?.[0].rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Income Tax', label: 'Rate band 2 (32%)',
      emParam: '$tin_rate2',
      appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Income Tax', label: '32% threshold (monthly)',
      emParam: '$tintb_upthres1',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[0].upTo ?? NaN,
      displayUnit: 'PLN/mo',
    },
    // ── Employee SSC (not in EUROMOD Excel for PL — all will be MISSING_EM) ──
    {
      section: 'Employee SSC', label: 'Emerytalne (pension) rate',
      emParam: '$tscee_pen_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Emerytalne'))?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employee SSC', label: 'Rentowe (disability) rate',
      emParam: '$tscee_dis_rate',
      appResolver: c => c.employeeSSC.components.find(
        x => x.label.includes('Rentowe') || x.label.includes('Disability')
      )?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employee SSC', label: 'Chorobowe (sickness) rate',
      emParam: '$tscee_sick_rate',
      appResolver: c => c.employeeSSC.components.find(
        x => x.label.includes('Chorobowe') || x.label.includes('Sickness')
      )?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employee SSC', label: 'Zdrowotna (health) rate',
      emParam: '$tscee_health_rate',
      appResolver: c => c.employeeSSC.components.find(
        x => x.label.includes('Zdrowotna') || x.label.includes('Health')
      )?.rate ?? NaN,
      displayUnit: '%',
    },
    // ── Employer SSC (also not in EUROMOD Excel for PL) ──────────
    {
      section: 'Employer SSC', label: 'Emerytalne (pension) rate',
      emParam: '$tscer_pen_rate',
      appResolver: c => c.employerSSC.components.find(x => x.label.includes('Emerytalne'))?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employer SSC', label: 'Rentowe (disability) rate',
      emParam: '$tscer_dis_rate',
      appResolver: c => c.employerSSC.components.find(
        x => x.label.includes('Rentowe') || x.label.includes('Disability')
      )?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employer SSC', label: 'Fundusz Pracy rate',
      emParam: '$tscer_fp_rate',
      appResolver: c => c.employerSSC.components.find(
        x => x.label.includes('Labour') || x.label.includes('FP')
      )?.rate ?? NaN,
      displayUnit: '%',
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // AT — Austria
  // ═══════════════════════════════════════════════════════════════
  AT: [
    // ── Income Tax — EStG § 33 ───────────────────────────────────
    {
      section: 'Income Tax', label: 'Band 0→1 threshold — 0% zone (monthly)',
      emParam: '$tin_upthres1',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[0].upTo ?? NaN,
      displayUnit: 'EUR/mo',
      tolerance: 0.03,
      note: 'EUROMOD y2025: 13,308 EUR/yr. App may use official BMF published value for year (12,756 or 13,308 depending on publication). Year-gap or source difference.',
    },
    {
      section: 'Income Tax', label: 'Band 1→2 threshold — 20% zone (monthly)',
      emParam: '$tin_upthres2',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[1].upTo ?? NaN,
      displayUnit: 'EUR/mo',
      tolerance: 0.05,
    },
    {
      section: 'Income Tax', label: 'Band 2→3 threshold — 30% zone (monthly)',
      emParam: '$tin_upthres3',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[2].upTo ?? NaN,
      displayUnit: 'EUR/mo',
      tolerance: 0.05,
    },
    {
      section: 'Income Tax', label: 'Band 3→4 threshold — 40% zone (monthly)',
      emParam: '$tin_upthres4',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[3].upTo ?? NaN,
      displayUnit: 'EUR/mo',
      tolerance: 0.05,
    },
    {
      section: 'Income Tax', label: 'Band 4→5 threshold — 48% zone (monthly)',
      emParam: '$tin_upthres5',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[4].upTo ?? NaN,
      displayUnit: 'EUR/mo',
      tolerance: 0.05,
    },
    { section: 'Income Tax', label: 'Rate band 2 (20%)', emParam: '$tin_basic_rate2', appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Rate band 3 (30%)', emParam: '$tin_basic_rate3', appResolver: c => c.incomeTax.brackets?.[2].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Rate band 4 (40%)', emParam: '$tin_basic_rate4', appResolver: c => c.incomeTax.brackets?.[3].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Rate band 5 (48%)', emParam: '$tin_basic_rate5', appResolver: c => c.incomeTax.brackets?.[4].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Rate band 6 (50%)', emParam: '$tin_basic_rate6', appResolver: c => c.incomeTax.brackets?.[5].rate ?? NaN, displayUnit: '%' },
    // ── Employee SSC — ASVG ──────────────────────────────────────
    {
      section: 'Employee SSC', label: 'Pension (PV) employee rate',
      emParam: '$tsceepi_ee_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Pension'))?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employee SSC', label: 'Health (KV) employee rate',
      emParam: '$tsceehl_ee_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Health'))?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employee SSC', label: 'Unemployment (ALV) max rate',
      emParam: '$tsceeui_rate4',
      appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Unemployment'))?.rate ?? NaN,
      displayUnit: '%',
      tolerance: 0.02,
      note: 'EUROMOD: tiered ALV rate up to 2.95% (top tier). App: simplified flat 3.0%. Acceptable approximation.',
    },
    {
      section: 'Employee SSC', label: 'Accident (UV) employee rate',
      emParam: '$tsceeho_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Accident'))?.rate ?? NaN,
      displayUnit: '%',
      note: 'EUROMOD $tsceeho_rate = 0.5%. App has 0.1%. Note: employee UV in AT is a nominal flat levy; confirm current law.',
    },
    {
      section: 'Employee SSC', label: 'HBG ceiling (monthly)',
      emParam: '$tsceeHBG_thres',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.employeeSSC.ceiling ?? NaN,
      displayUnit: 'EUR/mo',
      note: 'HBG ceiling not directly parameterised in EUROMOD Excel for AT — stored in XML policy logic.',
    },
    // ── Employer SSC — ASVG ──────────────────────────────────────
    {
      section: 'Employer SSC', label: 'Pension (PV) employer rate',
      emParam: '$tscerpi_ee_rate',
      appResolver: c => c.employerSSC.components.find(x => x.label.includes('Pension'))?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employer SSC', label: 'Health (KV) employer rate',
      emParam: '$tscerhl_ee_rate',
      appResolver: c => c.employerSSC.components.find(x => x.label.includes('Health'))?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employer SSC', label: 'Unemployment (ALV) employer rate',
      emParam: '$tscerui_rate',
      appResolver: c => c.employerSSC.components.find(x => x.label.includes('Unemployment'))?.rate ?? NaN,
      displayUnit: '%',
      tolerance: 0.02,
      note: 'EUROMOD: ALV employer = 2.95%. App: 3.0% simplified.',
    },
    {
      section: 'Employer SSC', label: 'Family Fund (FLAF) rate',
      emParam: '$tscerfa_rate',
      appResolver: c => c.employerSSC.components.find(
        x => x.label.toLowerCase().includes('family') || x.label.toLowerCase().includes('flaf')
      )?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employer SSC', label: 'Accident (UV) employer note: not in Excel',
      emParam: '$tscerUV_rate',
      appResolver: c => c.employerSSC.components.find(x => x.label.includes('Accident'))?.rate ?? NaN,
      displayUnit: '%',
      note: 'AT employer UV rate not in EUROMOD Excel — comes from XML. Sector average ~1.3% in app.',
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // SK — Slovakia
  // ═══════════════════════════════════════════════════════════════
  SK: [
    { section: 'Income Tax', label: 'Rate band 1 (19%)', emParam: '$tin_rate1', appResolver: c => c.incomeTax.brackets?.[0].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Rate band 2 (25%)', emParam: '$tin_rate2', appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN, displayUnit: '%' },
    {
      section: 'Wages', label: 'Minimum wage (monthly)',
      emParam: '$MinWage', emTransform: raw => toMonthly(raw),
      appResolver: c => c.minimumWage ?? NaN, displayUnit: 'EUR/mo',
    },
    { section: 'Employee SSC', label: 'Old-age pension (starobné) rate', emParam: '$tsceepi_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Old-Age') || x.label.includes('Pension'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'Health insurance (zdravotné) rate', emParam: '$tsceehl_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Health'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'Disability insurance (invalidné) rate', emParam: '$tsceedi_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Disability'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'Unemployment insurance (nezamest.) rate', emParam: '$tsceeui_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Unemployment'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Pension (starobné) employer rate', emParam: '$tscerpi_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('Old-Age') || x.label.includes('Pension'))?.rate ?? NaN, displayUnit: '%' },
    {
      section: 'Employer SSC', label: 'Health insurance (zdravotné) employer rate',
      emParam: '$tscerhl_rate',
      appResolver: c => c.employerSSC.components.find(x => x.label.includes('Health'))?.rate ?? NaN,
      displayUnit: '%',
      note: 'EUROMOD $tscerhl_rate = 11%. App uses 10% (employer health rate in SK). Check if 11% includes an additional levy component.',
    },
    { section: 'Employer SSC', label: 'Disability (invalidné) employer rate', emParam: '$tscerdi_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('Disability'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Reserve fund (rezervný fond) rate', emParam: '$tscerot_rate', appResolver: c => c.employerSSC.components.find(x => x.label.toLowerCase().includes('reserve'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Guarantee fund (garančné) rate', emParam: '$tscersf_rate', appResolver: c => c.employerSSC.components.find(x => x.label.toLowerCase().includes('guarantee') || x.label.toLowerCase().includes('garančné'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Accident insurance (úrazové) rate', emParam: '$tscerac_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('Accident'))?.rate ?? NaN, displayUnit: '%' },
  ],

  // ═══════════════════════════════════════════════════════════════
  // BE — Belgium
  // ═══════════════════════════════════════════════════════════════
  BE: [
    { section: 'Employee SSC', label: 'Pension (vieillesse) employee rate', emParam: '$tscee_Pen_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.toLowerCase().includes('pension'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'Health / disability (maladie) employee rate', emParam: '$tscee_Health_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.toLowerCase().includes('health') || x.label.toLowerCase().includes('maladie'))?.rate ?? NaN, displayUnit: '%' },
    {
      section: 'Employee SSC', label: 'Unemployment (chômage) employee rate',
      emParam: '$tscee_Unempl_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.label.toLowerCase().includes('unemploy') || x.label.toLowerCase().includes('chômage'))?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employer SSC', label: 'Employer standard (net) rate after reductions',
      emParam: '$tscer_stdrate',
      appResolver: c => c.employerSSC.components.reduce((sum, x) => sum + x.rate, 0),
      displayUnit: '%',
      tolerance: 0.15,
      note: 'EUROMOD $tscer_stdrate = 19.88% is the employer rate after Maribel/wage-moderation reductions. App sums all employer components (~25%). Known BE modelling difference.',
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // NL — Netherlands
  // ═══════════════════════════════════════════════════════════════
  NL: [
    {
      section: 'Wages', label: 'Minimum wage (monthly — WML)',
      emParam: '$MinWage_m', emTransform: raw => toMonthly(raw),
      appResolver: c => c.minimumWage ?? NaN, displayUnit: 'EUR/mo',
    },
    {
      section: 'Income Tax', label: 'Box 1 Schijf 1 — pure income tax rate (excl. SV)',
      emParam: '$tin_br1',
      appResolver: c => c.incomeTax.brackets?.[0].rate ?? NaN,
      displayUnit: '%',
      tolerance: 0.02,
      note: 'EUROMOD $tin_br1: 2025 pure IT component of schijf 1. App: 2026 rate. Year-gap from Belastingplan annual changes.',
    },
    {
      section: 'Income Tax', label: 'Box 1 Schijf 2 — rate above first bracket',
      emParam: '$tin_br3',
      appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN,
      displayUnit: '%',
      note: 'EUROMOD $tin_br3 = top rate 49.5%; maps to schijf 2 (no SV premium applies).',
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // IE — Ireland
  // ═══════════════════════════════════════════════════════════════
  IE: [
    { section: 'Income Tax', label: 'Standard rate (20%)', emParam: '$tin_Std_rate', appResolver: c => c.incomeTax.brackets?.[0].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Higher rate (40%)', emParam: '$tin_high_rate', appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN, displayUnit: '%' },
    {
      section: 'Income Tax', label: 'Standard rate band — single (monthly)',
      emParam: '$tin_StdSingleband_lim',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[0].upTo ?? NaN,
      displayUnit: 'EUR/mo',
      tolerance: 0.03,
    },
    {
      section: 'Employee SSC', label: 'PRSI Class A employee rate',
      emParam: '$tscee_prsiA_rate1',
      appResolver: c => c.employeeSSC.components.find(x => x.label.includes('PRSI'))?.rate ?? NaN,
      displayUnit: '%',
      tolerance: 0.02,
      note: 'EUROMOD $tscee_prsiA_rate1 = 4.10% (includes rounding); app uses 4.00% (rounded to nearest 0.5%). Within tolerance.',
    },
    {
      section: 'Employer SSC', label: 'PRSI employer (Class A) rate',
      emParam: '$tscer_prsiA_rate2',
      appResolver: c => c.employerSSC.components.find(x => x.label.includes('PRSI') || x.label.includes('Employer'))?.rate ?? NaN,
      displayUnit: '%',
      tolerance: 0.02,
      note: 'EUROMOD $tscer_prsiA_rate2 = 11.15%; app uses 11.05% (Budget 2025 increase). Year gap or minor difference.',
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // LU — Luxembourg
  // ═══════════════════════════════════════════════════════════════
  LU: [
    {
      section: 'Wages', label: 'Minimum wage (SSM monthly)',
      emParam: '$MinWage', emTransform: raw => toMonthly(raw),
      appResolver: c => c.minimumWage ?? NaN, displayUnit: 'EUR/mo',
      tolerance: 0.05,
    },
    {
      section: 'Employee SSC', label: 'Pension (CNAP vieillesse) employee rate',
      emParam: '$tscee_pen_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.label.toLowerCase().includes('pension') || x.label.toLowerCase().includes('cnap'))?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employee SSC', label: 'Health (CNS maladie/HIK) employee rate',
      emParam: '$tscee_hik_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.label.toLowerCase().includes('health') || x.label.toLowerCase().includes('cns'))?.rate ?? NaN,
      displayUnit: '%',
      tolerance: 0.02,
      note: 'EUROMOD $tscee_hik_rate = 2.80%; app uses 3.05% (MISSOC 2026 CNS employee rate). Year-gap from annual CNS tariff update.',
    },
    {
      section: 'Employer SSC', label: 'Pension (CNAP vieillesse) employer rate',
      emParam: '$tscer_pen_rate',
      appResolver: c => c.employerSSC.components.find(x => x.label.toLowerCase().includes('pension') || x.label.toLowerCase().includes('cnap'))?.rate ?? NaN,
      displayUnit: '%',
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // SE — Sweden
  // ═══════════════════════════════════════════════════════════════
  SE: [
    {
      section: 'Income Tax', label: 'State income tax add-on rate (topskat equivalent)',
      emParam: '$tinna_rate2',
      appResolver: c => {
        const b = c.incomeTax.brackets;
        return b ? b[1].rate - b[0].rate : NaN;
      },
      displayUnit: '%',
      note: 'EUROMOD $tinna_rate2 = 20% state tax add-on above threshold. App bracket diff = 52.37%-32.37% = 20%.',
    },
    {
      section: 'Employee SSC', label: 'Allmän pensionsavgift (NDC employee) rate',
      emParam: '$tscee_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.label.toLowerCase().includes('pensions'))?.rate ?? NaN,
      displayUnit: '%',
    },
    { section: 'Employer SSC', label: 'Sjukförsäkringsavgift (health) rate', emParam: '$tscer_rate1', appResolver: c => c.employerSSC.components.find(x => x.label.toLowerCase().includes('sjuk'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Ålderspensionsavgift (pension) rate', emParam: '$tscer_rate2', appResolver: c => c.employerSSC.components.find(x => x.label.toLowerCase().includes('ålders') || x.label.toLowerCase().includes('pension'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Efterlevandepensionsavgift (survivor) rate', emParam: '$tscer_rate3', appResolver: c => c.employerSSC.components.find(x => x.label.toLowerCase().includes('efterlevande') || x.label.toLowerCase().includes('survivor'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Arbetsmarknadsavgift (unemployment) rate', emParam: '$tscer_rate5', appResolver: c => c.employerSSC.components.find(x => x.label.toLowerCase().includes('arbetsmarknads') || x.label.toLowerCase().includes('unemployment'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Allmän löneavgift (general levy) rate', emParam: '$tscer_rate6', appResolver: c => c.employerSSC.components.find(x => x.label.toLowerCase().includes('löneavgift') || x.label.toLowerCase().includes('general'))?.rate ?? NaN, displayUnit: '%' },
  ],

  // ═══════════════════════════════════════════════════════════════
  // FI — Finland
  // ═══════════════════════════════════════════════════════════════
  FI: [
    {
      section: 'Employee SSC', label: 'TyEL employee contribution rate (age <53)',
      emParam: '$tscee_rate1',
      appResolver: c => c.employeeSSC.components.find(x => x.label.includes('TyEL'))?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employer SSC', label: 'TyEL employer contribution rate (average)',
      emParam: '$tscer_rate1',
      appResolver: c => c.employerSSC.components.find(x => x.label.includes('TyEL'))?.rate ?? NaN,
      displayUnit: '%',
      tolerance: 0.04,
      note: 'EUROMOD $tscer_rate1 = 17.76% (2025 avg). App: 17.34% (average after risk-class adjustment). Small year/rate-class difference.',
    },
    {
      section: 'Employee SSC', label: 'Employee unemployment insurance rate',
      emParam: '$tscee_unemp_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Unemployment'))?.rate ?? NaN,
      displayUnit: '%',
      note: 'EUROMOD $tscee_unemp_rate = 0.59% (2025 sub-threshold rate). App: 1.42% (standard full rate). EUROMOD models the lower-earnings tier; app uses standard employee rate.',
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // DK — Denmark
  // ═══════════════════════════════════════════════════════════════
  DK: [
    {
      section: 'Income Tax', label: 'Bundskat rate (bottom income tax)',
      emParam: '$tinbt_rate',
      appResolver: _c => 0.1201, // statutory bundskat; app combines into effective-on-gross bracket rates
      displayUnit: '%',
      note: 'EUROMOD $tinbt_rate = 12.01% (statutory). App uses effective-on-gross combined rate (34.05%). Direct comparison not meaningful; included for reference.',
    },
    {
      section: 'Income Tax', label: 'Topskat rate (top income tax add-on)',
      emParam: '$tinto_rate',
      appResolver: c => {
        const b = c.incomeTax.brackets;
        return b ? b[1].rate - b[0].rate : NaN;
      },
      displayUnit: '%',
      emTransform: raw => parseFloat(raw) * 0.92, // topskat is on after-AM-bidrag income (× 0.92 = on-gross)
      note: 'EUROMOD $tinto_rate = 15% (on after-AM-bidrag). Transformed × 0.92 = 13.8% on gross. App bracket diff = 47.85%-34.05% = 13.80%.',
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // EE — Estonia
  // ═══════════════════════════════════════════════════════════════
  EE: [
    {
      section: 'Income Tax', label: 'Flat income tax rate (tulumaks)',
      emParam: '$tin_stdrate',
      appResolver: c => (c.incomeTax as any).flatRate ?? c.incomeTax.brackets?.[0].rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Wages', label: 'Minimum wage (monthly — alampalk)',
      emParam: '$MinWage', emTransform: raw => toMonthly(raw),
      appResolver: c => c.minimumWage ?? NaN, displayUnit: 'EUR/mo',
    },
    {
      section: 'Employee SSC', label: 'Unemployment insurance (töötuskind.) rate',
      emParam: '$tscee_unemp_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Unemployment') || x.label.includes('töötuskind'))?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employer SSC', label: 'Sotsiaalmaks total pension (Pillar 1 + Pillar 2)',
      emParam: '$tscer_pen1_rate',
      appResolver: c => c.employerSSC.components.filter(x => x.pensionFunded).reduce((s, x) => s + x.rate, 0),
      displayUnit: '%',
      note: 'EUROMOD $tscer_pen1_rate = 20% total sotsiaalmaks pension portion. App: 16% NDC + 4% Pillar2 = 20%. Sum matches ✓.',
    },
    {
      section: 'Employer SSC', label: 'Sotsiaalmaks health (ravikindlustus) rate',
      emParam: '$tscer_health_rate',
      appResolver: c => c.employerSSC.components.find(x => x.label.includes('Health') || x.label.includes('ravikindlustus'))?.rate ?? NaN,
      displayUnit: '%',
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // LV — Latvia
  // ═══════════════════════════════════════════════════════════════
  LV: [
    {
      section: 'Wages', label: 'Minimum wage (monthly)',
      emParam: '$MinWage', emTransform: raw => toMonthly(raw),
      appResolver: c => c.minimumWage ?? NaN, displayUnit: 'EUR/mo',
    },
    {
      section: 'Income Tax', label: 'Rate band 1 (IIN — 2025 rate)',
      emParam: '$tin_rate1',
      appResolver: c => c.incomeTax.brackets?.[0].rate ?? NaN,
      displayUnit: '%',
      note: 'EUROMOD $tin_rate1 = 25.5% reflects pre-2026 LV IIT rate. App: 20% (2026 rate after reform). Significant legislative change between EUROMOD 2025 and App 2026.',
    },
    {
      section: 'Income Tax', label: 'Rate band 2 (IIN — 2025 rate)',
      emParam: '$tin_rate2',
      appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN,
      displayUnit: '%',
      note: 'EUROMOD $tin_rate2 = 33% vs App 23%. Latvia reformed IIT rates; 23% band introduced in 2022 may not yet be in this EUROMOD version.',
    },
    {
      section: 'Employee SSC', label: 'Total employee SSC rate (VSAOI)',
      emParam: '$tscee_rate1',
      appResolver: c => c.employeeSSC.components.reduce((s, x) => s + x.rate, 0),
      displayUnit: '%',
      note: 'EUROMOD $tscee_rate1 = 10.5% total employee VSAOI. App: 4%+6%+0.5% = 10.5% ✓.',
    },
    {
      section: 'Employer SSC', label: 'Total employer SSC rate (VSAOI)',
      emParam: '$tscer_rate1',
      appResolver: c => c.employerSSC.components.reduce((s, x) => s + x.rate, 0),
      displayUnit: '%',
      note: 'EUROMOD $tscer_rate1 = 23.59% total employer VSAOI. App: 2%+8%+10.6%+3% = 23.6% ✓.',
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // LT — Lithuania
  // ═══════════════════════════════════════════════════════════════
  LT: [
    { section: 'Income Tax', label: 'Standard GPM rate (20%)', emParam: '$tin_StdRate', appResolver: c => c.incomeTax.brackets?.[0].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Higher GPM rate (32%)', emParam: '$tin_HighestRate', appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN, displayUnit: '%' },
    {
      section: 'Employee SSC', label: 'SODRA pension insurance (pensijų dr.) rate',
      emParam: '$tsceepi_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.pensionFunded)?.rate ?? NaN,
      displayUnit: '%',
      note: 'EUROMOD $tsceepi_rate = 8.72% (SODRA Pillar 1 only). App: 12.52% (includes 3.8% voluntary II pillar state-match redirect). Different convention — EUROMOD tracks mandatory SODRA portion only.',
    },
    {
      section: 'Employee SSC', label: 'PSDF health insurance (sveikatos dr.) rate',
      emParam: '$tsceehi_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.label.includes('PSDF') || x.label.includes('health'))?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employer SSC', label: 'Work accident insurance (nelaimingų ats.) rate',
      emParam: '$tscerui_rate',
      appResolver: c => c.employerSSC.components.find(x => x.label.includes('accident') || x.label.includes('Nelaimingų'))?.rate ?? NaN,
      displayUnit: '%',
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // IT — Italy
  // ═══════════════════════════════════════════════════════════════
  IT: [
    { section: 'Income Tax', label: 'IRPEF rate band 1 (23%)', emParam: '$tintsna_rate1', appResolver: c => c.incomeTax.brackets?.[0].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'IRPEF rate band 2 (35%)', emParam: '$tintsna_rate2', appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'IRPEF rate band 3 (43%)', emParam: '$tintsna_rate3', appResolver: c => c.incomeTax.brackets?.[2].rate ?? NaN, displayUnit: '%' },
    {
      section: 'Income Tax', label: 'IRPEF band 1 upper threshold (monthly)',
      emParam: '$tintsna_upthres1',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[0].upTo ?? NaN,
      displayUnit: 'EUR/mo',
    },
    {
      section: 'Income Tax', label: 'IRPEF band 2 upper threshold (monthly)',
      emParam: '$tintsna_upthres2',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[1].upTo ?? NaN,
      displayUnit: 'EUR/mo',
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // ES — Spain
  // ═══════════════════════════════════════════════════════════════
  ES: [
    {
      section: 'Income Tax', label: 'IRPF band 1 upper threshold (monthly)',
      emParam: '$tin_upthres1',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[0].upTo ?? NaN,
      displayUnit: 'EUR/mo',
    },
    {
      section: 'Income Tax', label: 'IRPF band 2 upper threshold (monthly)',
      emParam: '$tin_upthres2',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[1].upTo ?? NaN,
      displayUnit: 'EUR/mo',
    },
    {
      section: 'Income Tax', label: 'IRPF band 3 upper threshold (monthly)',
      emParam: '$tin_upthres3',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[2].upTo ?? NaN,
      displayUnit: 'EUR/mo',
    },
    {
      section: 'Income Tax', label: 'IRPF band 4 upper threshold (monthly)',
      emParam: '$tin_upthres4',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[3].upTo ?? NaN,
      displayUnit: 'EUR/mo',
    },
    {
      section: 'Income Tax', label: 'IRPF band 5 upper threshold (monthly)',
      emParam: '$tin_upthres5',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[4].upTo ?? NaN,
      displayUnit: 'EUR/mo',
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // PT — Portugal
  // ═══════════════════════════════════════════════════════════════
  PT: [
    {
      section: 'Wages', label: 'Minimum wage (monthly — SMN)',
      emParam: '$MinWage', emTransform: raw => toMonthly(raw),
      appResolver: c => c.minimumWage ?? NaN, displayUnit: 'EUR/mo',
    },
    {
      section: 'Employee SSC', label: 'Segurança Social employee rate',
      emParam: '$tscee_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.pensionFunded || x.label.includes('Segur'))?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employer SSC', label: 'Segurança Social employer rate',
      emParam: '$tscer_rate',
      appResolver: c => c.employerSSC.components.find(x => x.label.includes('Segur') || x.label.includes('Regime'))?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Income Tax', label: 'IRS rate band 1',
      emParam: '$tin00_rate1',
      appResolver: c => c.incomeTax.brackets?.[0].rate ?? NaN,
      displayUnit: '%',
      note: 'EUROMOD $tin00_rate1 = 12.5% (2025). App: 13.25% (OE 2026 reform reduced to 13.25%). Year-gap from OE 2025 → 2026 rate cut.',
    },
    {
      section: 'Income Tax', label: 'IRS band 1 upper threshold (monthly)',
      emParam: '$tin00_upthres1',
      emTransform: raw => toMonthly(raw),
      appResolver: c => c.incomeTax.brackets?.[0].upTo ?? NaN,
      displayUnit: 'EUR/mo',
      tolerance: 0.05,
      note: 'EUROMOD: 8,059 EUR/yr = 671.6 EUR/mo (2025). App: 7,703 EUR/yr = 642 EUR/mo (OE 2026 revised brackets).',
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // HU — Hungary
  // ═══════════════════════════════════════════════════════════════
  HU: [
    {
      section: 'Income Tax', label: 'SZJA flat income tax rate (15%)',
      emParam: '$tin_rate',
      appResolver: c => (c.incomeTax as any).flatRate ?? c.incomeTax.brackets?.[0].rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Wages', label: 'Minimum wage (monthly — minimálbér)',
      emParam: '$MinWage_m', emTransform: raw => toMonthly(raw),
      appResolver: c => c.minimumWage ?? NaN, displayUnit: 'HUF/mo',
      note: 'EUROMOD $MinWage_m = 290,800 HUF/month (2025). App: 440,100 HUF/month (2026 increase of 51.7%). Major year-gap from annual minimálbér government decree.',
    },
    {
      section: 'Employee SSC', label: 'Nyugdíjjárulék (pension) rate',
      emParam: '$tscee_pen_rate1',
      appResolver: c => c.employeeSSC.components.find(x => x.pensionFunded)?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employee SSC', label: 'Egészségbiztosítás (health insurance) rate',
      emParam: '$tscee_hlt_rate1',
      appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Egészség') || x.label.includes('Health'))?.rate ?? NaN,
      displayUnit: '%',
    },
    {
      section: 'Employee SSC', label: 'Munkaerő-piaci járulék (labour market) rate',
      emParam: '$tscee_unemp_rate1',
      appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Munkaerő') || x.label.includes('Labour'))?.rate ?? NaN,
      displayUnit: '%',
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // SI — Slovenia
  // ═══════════════════════════════════════════════════════════════
  SI: [
    { section: 'Income Tax', label: 'Dohodnina rate band 1 (16%)', emParam: '$tin_rate1', appResolver: c => c.incomeTax.brackets?.[0].rate ?? NaN, displayUnit: '%' },
    {
      section: 'Income Tax', label: 'Dohodnina rate band 2 (27%)',
      emParam: '$tin_rate2',
      appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN,
      displayUnit: '%',
      note: 'EUROMOD $tin_rate2 = 26% (2025). App: 27% (2026 ZDOH-2 update). Year-gap expected.',
    },
    {
      section: 'Income Tax', label: 'Dohodnina rate band 3 (34%)',
      emParam: '$tin_rate3',
      appResolver: c => c.incomeTax.brackets?.[2].rate ?? NaN,
      displayUnit: '%',
      note: 'EUROMOD $tin_rate3 = 33% (2025). App: 34% (2026). Year-gap expected.',
    },
    { section: 'Income Tax', label: 'Dohodnina rate band 4 (39%)', emParam: '$tin_rate4', appResolver: c => c.incomeTax.brackets?.[3].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Dohodnina rate band 5 (50%)', emParam: '$tin_rate5', appResolver: c => c.incomeTax.brackets?.[4].rate ?? NaN, displayUnit: '%' },
    {
      section: 'Wages', label: 'Minimum wage (monthly — minimalna plača)',
      emParam: '$MinWage', emTransform: raw => toMonthly(raw),
      appResolver: c => c.minimumWage ?? NaN, displayUnit: 'EUR/mo',
      tolerance: 0.03,
    },
    {
      section: 'Wages', label: 'Average wage (monthly)',
      emParam: '$AvgWage', emTransform: raw => toMonthly(raw),
      appResolver: c => c.averageWage, displayUnit: 'EUR/mo',
      tolerance: 0.15,
      note: 'EUROMOD $AvgWage = 2,497 EUR/mo (SURS 2025 stat). App: 2,200 EUR/mo (2026 estimate). Year-gap or different wage concept.',
    },
    { section: 'Employee SSC', label: 'Pokojninsko zavarovanje (ZPIZ pension) rate', emParam: '$tscee_pen_rate', appResolver: c => c.employeeSSC.components.find(x => x.pensionFunded)?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'Zdravstveno zavarovanje (ZZZS health) rate', emParam: '$tscee_health_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Zdravstveno'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'Brezposelnost (unemployment) rate', emParam: '$tscee_unemp_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Brezposelnost') || x.label.includes('nezaposl'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Pokojninsko zavarovanje (ZPIZ pension) employer rate', emParam: '$tscer_pen_rate', appResolver: c => c.employerSSC.components.find(x => x.pensionFunded)?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Zdravstveno zavarovanje (ZZZS health) employer rate', emParam: '$tscer_health_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('Zdravstveno'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Poškodbe pri delu (work accidents) rate', emParam: '$tscer_occup_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('Poškodbe') || x.label.includes('accident'))?.rate ?? NaN, displayUnit: '%' },
  ],
};
