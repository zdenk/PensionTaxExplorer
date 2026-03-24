/**
 * src/data/eurodiffParams.ts
 *
 * Browser-safe mirror of scripts/euromod/parameterMap.ts.
 *
 * Contains the same per-country parameter entries (section / label / emParam /
 * appResolver / note) but WITHOUT any xlsx or Node.js dependencies.
 *
 * Used by SourcesPage to show live app values alongside EUROMOD parameter names
 * and any known discrepancy notes.
 *
 * Keep in sync with scripts/euromod/parameterMap.ts.
 */

import type { CountryConfig } from '../types';

/** Convert a raw EUROMOD parameter string to a monthly value.
 *  Strings ending in '#y' are annual → divide by 12.
 *  Strings ending in '#m' or plain numbers are monthly → use as-is. */
function toMonthly(raw: string | undefined): number {
  if (!raw || raw === 'n/a') return NaN;
  const s = raw.trim();
  const n = parseFloat(s);
  if (isNaN(n)) return NaN;
  return s.endsWith('#y') ? n / 12 : n;
}

/**
 * EUROMOD diff status for a single parameter entry.
 * Omitting the field (or 'match') means the app value matches EUROMOD.
 * - 'changed'       : ❌ App differs from EUROMOD — manual review/fix required
 * - 'year_gap'      : 🕐 Difference is explained by policy-year lag (expected until next EUROMOD release)
 * - 'not_in_euromod': ⬜ Parameter not present in EUROMOD Excel (no cross-check possible)
 */
export type DiffStatus = 'match' | 'changed' | 'year_gap' | 'not_in_euromod';

export interface ParamEntry {
  section: string;
  label: string;
  /** EUROMOD parameter name (e.g. '$tin_rate1') */
  emParam: string;
  /** Resolves the app's current value from the country config */
  appResolver: (c: CountryConfig) => number;
  displayUnit?: string;
  /** Notes explaining known differences vs EUROMOD */
  note?: string;
  /** EUROMOD diff status — omit or 'match' for a clean match */
  status?: DiffStatus;
}

export const EUROMOD_PARAMS: Record<string, ParamEntry[]> = {

  // ═══════════════════════════════════════════════════════════════
  // CZ — Czech Republic
  // ═══════════════════════════════════════════════════════════════
  CZ: [
    { section: 'Income Tax', label: 'Rate band 1 (15%)', emParam: '$tin_rate1', appResolver: c => c.incomeTax.brackets?.[0].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Rate band 2 (23%)', emParam: '$tin_rate2', appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN, displayUnit: '%' },
    {
      section: 'Income Tax', label: 'Personal allowance / basic credit (monthly)',
      emParam: '$tin_basic_amt',
      appResolver: c => c.incomeTax.personalAllowance,
      displayUnit: 'CZK/mo',
    },
    {
      section: 'Income Tax', label: 'Upper band threshold (monthly)',
      emParam: '$tscer_soc_upthres',
      appResolver: c => c.incomeTax.brackets?.[0].upTo ?? NaN,
      displayUnit: 'CZK/mo',
      note: 'EUROMOD: 0.75 × annual SSC ceiling / 12. App: 3 × AW_decree. Same statutory formula, different reference year.',
    },
    { section: 'Employee SSC', label: 'Pension insurance rate', emParam: '$tscee_pen_rate', appResolver: c => c.employeeSSC.components.find(x => x.pensionFunded)?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'Sick-leave insurance rate', emParam: '$tscee_sick_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.toLowerCase().includes('sick'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'Health insurance rate', emParam: '$tscee_health_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.toLowerCase().includes('health'))?.rate ?? NaN, displayUnit: '%' },
    {
      section: 'Employee SSC', label: 'Pension / social SSC ceiling (monthly)',
      emParam: '$tscer_soc_upthres',
      appResolver: c => c.employeeSSC.ceiling ?? NaN,
      displayUnit: 'CZK/mo',
      note: 'EUROMOD annual ceiling / 12. App: 4 × AW_decree. Same statutory formula, different year.',
    },
    { section: 'Employer SSC', label: 'Pension insurance rate', emParam: '$tscer_pen_rate', appResolver: c => c.employerSSC.components.find(x => x.pensionFunded)?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Sick-leave insurance rate', emParam: '$tscer_sick_rate', appResolver: c => c.employerSSC.components.find(x => x.label.toLowerCase().includes('sick'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'State employment policy rate', emParam: '$tscer_unemp_rate', appResolver: c => c.employerSSC.components.find(x => x.label.toLowerCase().includes('employment') || x.label.toLowerCase().includes('unemp'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Health insurance rate', emParam: '$tscer_health_rate', appResolver: c => c.employerSSC.components.find(x => x.label.toLowerCase().includes('health'))?.rate ?? NaN, displayUnit: '%' },
    {
      section: 'Wages', label: 'Minimum wage (monthly)',
      emParam: '$MinWage',
      appResolver: c => c.minimumWage ?? NaN,
      displayUnit: 'CZK/mo',
    },
    {
      section: 'Wages', label: 'Average wage (monthly)',
      emParam: '$AvWage',
      appResolver: c => c.averageWage,
      displayUnit: 'CZK/mo',
      note: 'EUROMOD: prior-year AW decree. App: current-year AW decree.',
      status: 'year_gap',
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // DE — Germany
  // ═══════════════════════════════════════════════════════════════
  DE: [
    {
      section: 'Income Tax', label: 'Grundfreibetrag (monthly, bracket[0].upTo)',
      emParam: '$tin_upthres1',
      appResolver: c => c.incomeTax.brackets?.[0].upTo ?? NaN,
      displayUnit: 'EUR/mo',
      note: 'EUROMOD: annual Grundfreibetrag / 12. App: modelled as 0%-rate first bracket.',
    },
    {
      section: 'Income Tax', label: 'Proportional zone (42%) start — monthly',
      emParam: '$tin_upthres3',
      appResolver: c => c.incomeTax.brackets?.[2].upTo ?? NaN,
      displayUnit: 'EUR/mo',
      note: 'Approximate comparison. EUROMOD: start of 42% zone (annual/12). App: simplified upper-progression bracket.',
    },
    {
      section: 'Income Tax', label: 'Reichensteuer (45%) start — monthly',
      emParam: '$tin_upthres4',
      appResolver: c => c.incomeTax.brackets?.[3].upTo ?? NaN,
      displayUnit: 'EUR/mo',
      note: 'Fixed 2026-03-23: was 48,167 EUR/mo (data entry error, ×2). Corrected to 23,152 EUR/mo = 277,825 EUR/year (EStG §32a 2025).',
    },
    { section: 'Income Tax', label: 'Proportional zone rate (42%)', emParam: '$tin_rate1', appResolver: c => c.incomeTax.brackets?.[3].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Reichensteuer rate (45%)', emParam: '$tin_rate2', appResolver: c => c.incomeTax.brackets?.[4].rate ?? NaN, displayUnit: '%' },
    {
      section: 'SSC Ceilings', label: 'BBG Pension/ALV ceiling (monthly)',
      emParam: '$tsceepi_thres',
      appResolver: c => c.employeeSSC.ceiling ?? NaN,
      displayUnit: 'EUR/mo',
      note: 'EUROMOD: unified BBG (Ost=West from 2025). App: SVR-Verordnung 2026 value. Year gap expected.',
    },
    {
      section: 'SSC Ceilings', label: 'BBG Kranken/Pflege ceiling (monthly)',
      emParam: '$tsceehi_thres',
      appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Health'))?.ceiling ?? NaN,
      displayUnit: 'EUR/mo',
      note: 'EUROMOD: BBG KV 2025. App: BBG_HEALTH 2026. Year gap expected.',
      status: 'year_gap',
    },
    { section: 'Employee SSC', label: 'Pension (RV) rate', emParam: '$tsceepi_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Pension'))?.rate ?? NaN, displayUnit: '%' },
    {
      section: 'Employee SSC', label: 'Health (KV) rate incl. avg Zusatzbeitrag',
      emParam: '$tsceehi_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Health'))?.rate ?? NaN,
      displayUnit: '%',
      note: 'EUROMOD: 7.3% base + half avg Zusatzbeitrag. App: may use different year Zusatzbeitrag.',
      status: 'year_gap',
    },
    { section: 'Employee SSC', label: 'Unemployment (ALV) rate', emParam: '$tsceeui_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Unemployment'))?.rate ?? NaN, displayUnit: '%' },
    {
      section: 'Employee SSC', label: 'Care (PV) base rate',
      emParam: '$tsceeci_rate',
      appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Care'))?.rate ?? NaN,
      displayUnit: '%',
      note: 'EUROMOD: base PV rate. App: blended rate incl. childless surcharge average.',
      status: 'year_gap',
    },
    { section: 'Employer SSC', label: 'Pension (RV) rate', emParam: '$tscerpi_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('Pension'))?.rate ?? NaN, displayUnit: '%' },
    {
      section: 'Employer SSC', label: 'Health (KV) rate incl. avg Zusatzbeitrag',
      emParam: '$tscerhi_rate',
      appResolver: c => c.employerSSC.components.find(x => x.label.includes('Health'))?.rate ?? NaN,
      displayUnit: '%',
      note: 'EUROMOD: 7.3% base + half avg Zusatzbeitrag.',
      status: 'year_gap',
    },
    { section: 'Employer SSC', label: 'Unemployment (ALV) rate', emParam: '$tscerui_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('Unemployment'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Care (PV) base rate', emParam: '$tscerci_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('Care'))?.rate ?? NaN, displayUnit: '%', note: 'EUROMOD: employer PV (base, no childless surcharge).' },
  ],

  // ═══════════════════════════════════════════════════════════════
  // FR — France
  // ═══════════════════════════════════════════════════════════════
  FR: [
    { section: 'Wages', label: 'SMIC (monthly)', emParam: '$MinWage', appResolver: c => c.minimumWage ?? NaN, displayUnit: 'EUR/mo' },
    { section: 'Income Tax', label: 'Band 1 upper threshold (monthly)', emParam: '$tin_upthres1', appResolver: c => c.incomeTax.brackets?.[0].upTo ?? NaN, displayUnit: 'EUR/mo', note: 'EUROMOD annual / 12. Year gap expected.' },
    { section: 'Income Tax', label: 'Band 2 upper threshold — 11% (monthly)', emParam: '$tin_upthres3', appResolver: c => c.incomeTax.brackets?.[1].upTo ?? NaN, displayUnit: 'EUR/mo', note: 'EUROMOD annual ÷ 12. Year gap expected.' },
    { section: 'Income Tax', label: 'Band 3 upper threshold — 30% (monthly)', emParam: '$tin_upthres4', appResolver: c => c.incomeTax.brackets?.[2].upTo ?? NaN, displayUnit: 'EUR/mo' },
    { section: 'Income Tax', label: 'Band 4 upper threshold — 41% (monthly)', emParam: '$tin_upthres5', appResolver: c => c.incomeTax.brackets?.[3].upTo ?? NaN, displayUnit: 'EUR/mo' },
    { section: 'Income Tax', label: 'Rate band 2 (11%)', emParam: '$tin_rate3', appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Rate band 3 (30%)', emParam: '$tin_rate4', appResolver: c => c.incomeTax.brackets?.[2].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Rate band 4 (41%)', emParam: '$tin_rate5', appResolver: c => c.incomeTax.brackets?.[3].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Rate band 5 (45%)', emParam: '$tin_rate6', appResolver: c => c.incomeTax.brackets?.[4].rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'CNAV vieillesse plafonné rate', emParam: '$tsceepi_rate1', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('CNAV') && !x.label.includes('déplafonné'))?.rate ?? NaN, displayUnit: '%', note: 'EUROMOD 7.30% vs app 6.90%. Official CSS rate = 6.90%; EUROMOD may include supplementary components.', status: 'year_gap' },
    { section: 'Employee SSC', label: 'CNAV vieillesse déplafonné rate', emParam: '$tsceepi_rate2', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('CNAV') && x.label.includes('déplafonné'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'AGIRC-ARRCO T1 employee rate', emParam: '$tsceepi_rate3', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('AGIRC'))?.rate ?? NaN, displayUnit: '%', note: 'EUROMOD 3.15% (T1 employee). App 3.75% (includes CET). Check convention source.', status: 'changed' },
    { section: 'Employer SSC', label: 'CNAV vieillesse plafonné rate', emParam: '$tscerpi_rate1', appResolver: c => c.employerSSC.components.find(x => x.label.includes('CNAV') && !x.label.includes('déplafonné'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'CNAV vieillesse déplafonné rate', emParam: '$tscerpi_rate2', appResolver: c => c.employerSSC.components.find(x => x.label.includes('CNAV') && x.label.includes('déplafonné'))?.rate ?? NaN, displayUnit: '%', note: 'EUROMOD 2.02%; App 1.90%. May reflect inclusion/exclusion of minor sub-components.', status: 'year_gap' },
    { section: 'Employer SSC', label: 'AGIRC-ARRCO T1 employer rate', emParam: '$tscerpi_rate4', appResolver: c => c.employerSSC.components.find(x => x.label.includes('AGIRC'))?.rate ?? NaN, displayUnit: '%', note: 'EUROMOD 4.72% (T1 employer). App 5.65% (includes CET+APEC). Check convention source.', status: 'changed' },
    { section: 'Employer SSC', label: 'Chômage (UNEDIC) employer rate', emParam: '$tscerui_rate1', appResolver: c => c.employerSSC.components.find(x => x.label.includes('hômage') || x.label.includes('UNEDIC'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Allocations familiales rate', emParam: '$tscerfa_rate', appResolver: c => c.employerSSC.components.find(x => x.label.toLowerCase().includes('famil'))?.rate ?? NaN, displayUnit: '%', note: 'EUROMOD: 5.25% (full rate). App may blend reduced rate.' },
  ],

  // ═══════════════════════════════════════════════════════════════
  // PL — Poland
  // ═══════════════════════════════════════════════════════════════
  PL: [
    { section: 'Wages', label: 'Minimum wage (monthly)', emParam: '$MinWage', appResolver: c => c.minimumWage ?? NaN, displayUnit: 'PLN/mo', note: 'EUROMOD y2025 = 4,666 PLN; App = 4,626 PLN (2026 decree). Year-gap.' },
    { section: 'Income Tax', label: 'Rate band 1 (12%)', emParam: '$tin_rate1', appResolver: c => c.incomeTax.brackets?.[0].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Rate band 2 (32%)', emParam: '$tin_rate2', appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: '32% threshold (monthly)', emParam: '$tintb_upthres1', appResolver: c => c.incomeTax.brackets?.[0].upTo ?? NaN, displayUnit: 'PLN/mo' },
    { section: 'Employee SSC', label: 'Emerytalne (pension) rate', emParam: '$tscee_pen_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Emerytalne'))?.rate ?? NaN, displayUnit: '%', status: 'not_in_euromod' },
    { section: 'Employee SSC', label: 'Rentowe (disability) rate', emParam: '$tscee_dis_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Rentowe') || x.label.includes('Disability'))?.rate ?? NaN, displayUnit: '%', status: 'not_in_euromod' },
    { section: 'Employee SSC', label: 'Chorobowe (sickness) rate', emParam: '$tscee_sick_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Chorobowe') || x.label.includes('Sickness'))?.rate ?? NaN, displayUnit: '%', status: 'not_in_euromod' },
    { section: 'Employee SSC', label: 'Zdrowotna (health) rate', emParam: '$tscee_health_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Zdrowotna') || x.label.includes('Health'))?.rate ?? NaN, displayUnit: '%', status: 'not_in_euromod' },
    { section: 'Employer SSC', label: 'Emerytalne (pension) rate', emParam: '$tscer_pen_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('Emerytalne'))?.rate ?? NaN, displayUnit: '%', status: 'not_in_euromod' },
    { section: 'Employer SSC', label: 'Rentowe (disability) rate', emParam: '$tscer_dis_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('Rentowe') || x.label.includes('Disability'))?.rate ?? NaN, displayUnit: '%', status: 'not_in_euromod' },
    { section: 'Employer SSC', label: 'Fundusz Pracy rate', emParam: '$tscer_fp_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('Labour') || x.label.includes('FP'))?.rate ?? NaN, displayUnit: '%', status: 'not_in_euromod' },
  ],

  // ═══════════════════════════════════════════════════════════════
  // AT — Austria
  // ═══════════════════════════════════════════════════════════════
  AT: [
    { section: 'Income Tax', label: 'Band 0→1 threshold (monthly)', emParam: '$tin_upthres1', appResolver: c => c.incomeTax.brackets?.[0].upTo ?? NaN, displayUnit: 'EUR/mo', note: 'EUROMOD y2025: 13,308 EUR/yr. Year-gap or source difference.', status: 'year_gap' },
    { section: 'Income Tax', label: 'Band 1→2 threshold (monthly)', emParam: '$tin_upthres2', appResolver: c => c.incomeTax.brackets?.[1].upTo ?? NaN, displayUnit: 'EUR/mo' },
    { section: 'Income Tax', label: 'Band 2→3 threshold (monthly)', emParam: '$tin_upthres3', appResolver: c => c.incomeTax.brackets?.[2].upTo ?? NaN, displayUnit: 'EUR/mo' },
    { section: 'Income Tax', label: 'Band 3→4 threshold (monthly)', emParam: '$tin_upthres4', appResolver: c => c.incomeTax.brackets?.[3].upTo ?? NaN, displayUnit: 'EUR/mo' },
    { section: 'Income Tax', label: 'Band 4→5 threshold (monthly)', emParam: '$tin_upthres5', appResolver: c => c.incomeTax.brackets?.[4].upTo ?? NaN, displayUnit: 'EUR/mo' },
    { section: 'Income Tax', label: 'Rate band 2 (20%)', emParam: '$tin_basic_rate2', appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Rate band 3 (30%)', emParam: '$tin_basic_rate3', appResolver: c => c.incomeTax.brackets?.[2].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Rate band 4 (40%)', emParam: '$tin_basic_rate4', appResolver: c => c.incomeTax.brackets?.[3].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Rate band 5 (48%)', emParam: '$tin_basic_rate5', appResolver: c => c.incomeTax.brackets?.[4].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Rate band 6 (50%)', emParam: '$tin_basic_rate6', appResolver: c => c.incomeTax.brackets?.[5].rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'Pension (PV) employee rate', emParam: '$tsceepi_ee_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Pension'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'Health (KV) employee rate', emParam: '$tsceehl_ee_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Health'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'Unemployment (ALV) max rate', emParam: '$tsceeui_rate4', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Unemployment'))?.rate ?? NaN, displayUnit: '%', note: 'EUROMOD: tiered ALV up to 2.95%. App: 3.0% simplified.' },
    { section: 'Employee SSC', label: 'Accident (UV) employee rate', emParam: '$tsceeho_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Accident'))?.rate ?? NaN, displayUnit: '%', note: 'EUROMOD 0.5%; App 0.1%. Confirm current law.', status: 'changed' },
    { section: 'Employee SSC', label: 'HBG ceiling (monthly)', emParam: '$tsceeHBG_thres', appResolver: c => c.employeeSSC.ceiling ?? NaN, displayUnit: 'EUR/mo', note: 'HBG not directly in EUROMOD Excel — stored in XML.', status: 'not_in_euromod' },
    { section: 'Employer SSC', label: 'Pension (PV) employer rate', emParam: '$tscerpi_ee_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('Pension'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Health (KV) employer rate', emParam: '$tscerhl_ee_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('Health'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Unemployment (ALV) employer rate', emParam: '$tscerui_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('Unemployment'))?.rate ?? NaN, displayUnit: '%', note: 'EUROMOD: 2.95%. App: 3.0%.' },
    { section: 'Employer SSC', label: 'Family Fund (FLAF) rate', emParam: '$tscerfa_rate', appResolver: c => c.employerSSC.components.find(x => x.label.toLowerCase().includes('family') || x.label.toLowerCase().includes('flaf'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Accident (UV) employer — not in Excel', emParam: '$tscerUV_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('Accident'))?.rate ?? NaN, displayUnit: '%', note: 'AT employer UV not in EUROMOD Excel — comes from XML. ~1.3%.', status: 'not_in_euromod' },
    { section: 'Wages', label: 'Minimum wage KV (monthly)', emParam: '$MinWage', appResolver: c => c.minimumWage ?? NaN, displayUnit: 'EUR/mo' },
  ],

  // ═══════════════════════════════════════════════════════════════
  // SK — Slovakia
  // ═══════════════════════════════════════════════════════════════
  SK: [
    { section: 'Income Tax', label: 'Rate band 1 (19%)', emParam: '$tin_rate1', appResolver: c => c.incomeTax.brackets?.[0].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Rate band 2 (25%)', emParam: '$tin_rate2', appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN, displayUnit: '%' },
    { section: 'Wages', label: 'Minimum wage (monthly)', emParam: '$MinWage', appResolver: c => c.minimumWage ?? NaN, displayUnit: 'EUR/mo' },
    { section: 'Employee SSC', label: 'Old-age pension (starobné) rate', emParam: '$tsceepi_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Old-Age') || x.label.includes('Pension'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'Health insurance (zdravotné) rate', emParam: '$tsceehl_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Health'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'Disability insurance (invalidné) rate', emParam: '$tsceedi_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Disability'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'Unemployment insurance (nezamest.) rate', emParam: '$tsceeui_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Unemployment'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Pension (starobné) employer rate', emParam: '$tscerpi_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('Old-Age') || x.label.includes('Pension'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Health insurance (zdravotné) employer rate', emParam: '$tscerhl_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('Health'))?.rate ?? NaN, displayUnit: '%', note: 'EUROMOD 11%. App 10%. Check if 11% includes an additional levy.', status: 'year_gap' },
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
    { section: 'Employee SSC', label: 'Unemployment (chômage) employee rate', emParam: '$tscee_Unempl_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.toLowerCase().includes('unemploy') || x.label.toLowerCase().includes('chômage'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Employer net rate after reductions', emParam: '$tscer_stdrate', appResolver: c => c.employerSSC.components.reduce((s, x) => s + x.rate, 0), displayUnit: '%', note: 'EUROMOD 19.88% (after Maribel/wage-moderation reductions). App sums all components (~25%). Known BE modelling difference.', status: 'changed' },
  ],

  // ═══════════════════════════════════════════════════════════════
  // NL — Netherlands
  // ═══════════════════════════════════════════════════════════════
  NL: [
    { section: 'Wages', label: 'Minimum wage (monthly — WML)', emParam: '$MinWage_m', appResolver: c => c.minimumWage ?? NaN, displayUnit: 'EUR/mo' },
    { section: 'Income Tax', label: 'Box 1 Schijf 1 — pure IT rate (excl. SV)', emParam: '$tin_br1', appResolver: c => c.incomeTax.brackets?.[0].rate ?? NaN, displayUnit: '%', note: 'EUROMOD 2025 IT component. App: 2026 rate. Year-gap from Belastingplan.', status: 'year_gap' },
    { section: 'Income Tax', label: 'Box 1 Schijf 2 — top rate', emParam: '$tin_br3', appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN, displayUnit: '%', note: 'EUROMOD $tin_br3 = 49.5%.' },
  ],

  // ═══════════════════════════════════════════════════════════════
  // IE — Ireland
  // ═══════════════════════════════════════════════════════════════
  IE: [
    { section: 'Income Tax', label: 'Standard rate (20%)', emParam: '$tin_Std_rate', appResolver: c => c.incomeTax.brackets?.[0].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Higher rate (40%)', emParam: '$tin_high_rate', appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Standard rate band — single (monthly)', emParam: '$tin_StdSingleband_lim', appResolver: c => c.incomeTax.brackets?.[0].upTo ?? NaN, displayUnit: 'EUR/mo' },
    { section: 'Employee SSC', label: 'PRSI Class A employee rate', emParam: '$tscee_prsiA_rate1', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('PRSI'))?.rate ?? NaN, displayUnit: '%', note: 'EUROMOD 4.10%; App 4.00%. Within tolerance — year-gap from annual Budget rounding.', status: 'year_gap' },
    { section: 'Employer SSC', label: 'PRSI employer (Class A) rate', emParam: '$tscer_prsiA_rate2', appResolver: c => c.employerSSC.components.find(x => x.label.includes('PRSI') || x.label.includes('Employer'))?.rate ?? NaN, displayUnit: '%', note: 'EUROMOD 11.15%; App 11.05%.' },
  ],

  // ═══════════════════════════════════════════════════════════════
  // LU — Luxembourg
  // ═══════════════════════════════════════════════════════════════
  LU: [
    { section: 'Wages', label: 'Minimum wage (SSM monthly)', emParam: '$MinWage', appResolver: c => c.minimumWage ?? NaN, displayUnit: 'EUR/mo' },
    { section: 'Employee SSC', label: 'Pension (CNAP vieillesse) employee rate', emParam: '$tscee_pen_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.toLowerCase().includes('pension') || x.label.toLowerCase().includes('cnap'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'Health (CNS maladie/HIK) employee rate', emParam: '$tscee_hik_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.toLowerCase().includes('health') || x.label.toLowerCase().includes('cns'))?.rate ?? NaN, displayUnit: '%', note: 'EUROMOD 2.80%; App 3.05% (MISSOC 2026). Year-gap from annual CNS tariff update.', status: 'year_gap' },
    { section: 'Employer SSC', label: 'Pension (CNAP vieillesse) employer rate', emParam: '$tscer_pen_rate', appResolver: c => c.employerSSC.components.find(x => x.label.toLowerCase().includes('pension') || x.label.toLowerCase().includes('cnap'))?.rate ?? NaN, displayUnit: '%' },
  ],

  // ═══════════════════════════════════════════════════════════════
  // SE — Sweden
  // ═══════════════════════════════════════════════════════════════
  SE: [
    { section: 'Income Tax', label: 'State IT add-on rate (topskat equivalent)', emParam: '$tinna_rate2', appResolver: c => { const b = c.incomeTax.brackets; return b ? b[1].rate - b[0].rate : NaN; }, displayUnit: '%', note: 'EUROMOD 20% state add-on. App bracket diff = 52.37%−32.37% = 20%.' },
    { section: 'Employee SSC', label: 'Allmän pensionsavgift (NDC employee) rate', emParam: '$tscee_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.toLowerCase().includes('pensions'))?.rate ?? NaN, displayUnit: '%' },
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
    { section: 'Employee SSC', label: 'TyEL employee contribution rate (age <53)', emParam: '$tscee_rate1', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('TyEL'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'TyEL employer contribution rate (average)', emParam: '$tscer_rate1', appResolver: c => c.employerSSC.components.find(x => x.label.includes('TyEL'))?.rate ?? NaN, displayUnit: '%', note: 'EUROMOD 17.76% (2025 avg). App: 17.34%.' },
    { section: 'Employee SSC', label: 'Employee unemployment insurance rate', emParam: '$tscee_unemp_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Unemployment'))?.rate ?? NaN, displayUnit: '%', note: 'EUROMOD 0.59% (sub-threshold tier). App: 1.42% (standard full rate). EUROMOD models lower-earnings tier.', status: 'changed' },
  ],

  // ═══════════════════════════════════════════════════════════════
  // DK — Denmark
  // ═══════════════════════════════════════════════════════════════
  DK: [
    { section: 'Income Tax', label: 'Bundskat rate (bottom income tax)', emParam: '$tinbt_rate', appResolver: _c => 0.1201, displayUnit: '%', note: 'EUROMOD 12.01% (statutory). App uses effective-on-gross combined rate (34.05%). Direct comparison not meaningful.' },
    { section: 'Income Tax', label: 'Topskat rate add-on (on gross)', emParam: '$tinto_rate', appResolver: c => { const b = c.incomeTax.brackets; return b ? b[1].rate - b[0].rate : NaN; }, displayUnit: '%', note: 'EUROMOD 15% on after-AM-bidrag × 0.92 = 13.8% on gross. App bracket diff = 13.80%.' },
  ],

  // ═══════════════════════════════════════════════════════════════
  // EE — Estonia
  // ═══════════════════════════════════════════════════════════════
  EE: [
    { section: 'Income Tax', label: 'Flat income tax rate (tulumaks)', emParam: '$tin_stdrate', appResolver: c => (c.incomeTax as any).flatRate ?? c.incomeTax.brackets?.[0].rate ?? NaN, displayUnit: '%' },
    { section: 'Wages', label: 'Minimum wage (monthly — alampalk)', emParam: '$MinWage', appResolver: c => c.minimumWage ?? NaN, displayUnit: 'EUR/mo' },
    { section: 'Employee SSC', label: 'Unemployment insurance (töötuskind.) rate', emParam: '$tscee_unemp_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Unemployment') || x.label.includes('töötuskind'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Sotsiaalmaks total pension (P1 + P2)', emParam: '$tscer_pen1_rate', appResolver: c => c.employerSSC.components.filter(x => x.pensionFunded).reduce((s, x) => s + x.rate, 0), displayUnit: '%', note: 'EUROMOD 20% total. App: 16% NDC + 4% P2 = 20% ✓.' },
    { section: 'Employer SSC', label: 'Sotsiaalmaks health (ravikindlustus) rate', emParam: '$tscer_health_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('Health') || x.label.includes('ravikindlustus'))?.rate ?? NaN, displayUnit: '%' },
  ],

  // ═══════════════════════════════════════════════════════════════
  // LV — Latvia
  // ═══════════════════════════════════════════════════════════════
  LV: [
    { section: 'Wages', label: 'Minimum wage (monthly)', emParam: '$MinWage', appResolver: c => c.minimumWage ?? NaN, displayUnit: 'EUR/mo' },
    { section: 'Income Tax', label: 'Rate band 1 (IIN — 2026 reform)', emParam: '$tin_rate1', appResolver: c => c.incomeTax.brackets?.[0].rate ?? NaN, displayUnit: '%', note: 'EUROMOD 25.5% (pre-2026). App 20% (2026 reform). Significant legislative change not yet in EUROMOD J2.0+.', status: 'changed' },
    { section: 'Income Tax', label: 'Rate band 2 (IIN — 2026 reform)', emParam: '$tin_rate2', appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN, displayUnit: '%', note: 'EUROMOD 33% vs App 23%. Latvia reformed IIT in 2022; EUROMOD J2.0+ may not yet reflect this.', status: 'changed' },
    { section: 'Employee SSC', label: 'Total employee SSC rate (VSAOI)', emParam: '$tscee_rate1', appResolver: c => c.employeeSSC.components.reduce((s, x) => s + x.rate, 0), displayUnit: '%', note: 'EUROMOD 10.5%. App: 4%+6%+0.5% = 10.5% ✓.' },
    { section: 'Employer SSC', label: 'Total employer SSC rate (VSAOI)', emParam: '$tscer_rate1', appResolver: c => c.employerSSC.components.reduce((s, x) => s + x.rate, 0), displayUnit: '%', note: 'EUROMOD 23.59%. App: 2%+8%+10.6%+3% = 23.6% ✓.' },
  ],

  // ═══════════════════════════════════════════════════════════════
  // LT — Lithuania
  // ═══════════════════════════════════════════════════════════════
  LT: [
    { section: 'Income Tax', label: 'Standard GPM rate (20%)', emParam: '$tin_StdRate', appResolver: c => c.incomeTax.brackets?.[0].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Higher GPM rate (32%)', emParam: '$tin_HighestRate', appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'SODRA pension insurance rate', emParam: '$tsceepi_rate', appResolver: c => c.employeeSSC.components.find(x => x.pensionFunded)?.rate ?? NaN, displayUnit: '%', note: 'EUROMOD 8.72% (SODRA P1 mandatory only). App 12.52% (includes 3.8% voluntary Pillar II state-match redirect). Different convention.', status: 'changed' },
    { section: 'Employee SSC', label: 'PSDF health insurance (sveikatos dr.) rate', emParam: '$tsceehi_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('PSDF') || x.label.includes('health'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Work accident insurance (nelaimingų ats.) rate', emParam: '$tscerui_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('accident') || x.label.includes('Nelaimingų'))?.rate ?? NaN, displayUnit: '%' },
  ],

  // ═══════════════════════════════════════════════════════════════
  // IT — Italy
  // ═══════════════════════════════════════════════════════════════
  IT: [
    { section: 'Income Tax', label: 'IRPEF rate band 1 (23%)', emParam: '$tintsna_rate1', appResolver: c => c.incomeTax.brackets?.[0].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'IRPEF rate band 2 (35%)', emParam: '$tintsna_rate2', appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'IRPEF rate band 3 (43%)', emParam: '$tintsna_rate3', appResolver: c => c.incomeTax.brackets?.[2].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'IRPEF band 1 upper threshold (monthly)', emParam: '$tintsna_upthres1', appResolver: c => c.incomeTax.brackets?.[0].upTo ?? NaN, displayUnit: 'EUR/mo' },
    { section: 'Income Tax', label: 'IRPEF band 2 upper threshold (monthly)', emParam: '$tintsna_upthres2', appResolver: c => c.incomeTax.brackets?.[1].upTo ?? NaN, displayUnit: 'EUR/mo' },
  ],

  // ═══════════════════════════════════════════════════════════════
  // ES — Spain
  // ═══════════════════════════════════════════════════════════════
  ES: [
    { section: 'Income Tax', label: 'IRPF band 1 upper threshold (monthly)', emParam: '$tin_upthres1', appResolver: c => c.incomeTax.brackets?.[0].upTo ?? NaN, displayUnit: 'EUR/mo' },
    { section: 'Income Tax', label: 'IRPF band 2 upper threshold (monthly)', emParam: '$tin_upthres2', appResolver: c => c.incomeTax.brackets?.[1].upTo ?? NaN, displayUnit: 'EUR/mo' },
    { section: 'Income Tax', label: 'IRPF band 3 upper threshold (monthly)', emParam: '$tin_upthres3', appResolver: c => c.incomeTax.brackets?.[2].upTo ?? NaN, displayUnit: 'EUR/mo' },
    { section: 'Income Tax', label: 'IRPF band 4 upper threshold (monthly)', emParam: '$tin_upthres4', appResolver: c => c.incomeTax.brackets?.[3].upTo ?? NaN, displayUnit: 'EUR/mo' },
    { section: 'Income Tax', label: 'IRPF band 5 upper threshold (monthly)', emParam: '$tin_upthres5', appResolver: c => c.incomeTax.brackets?.[4].upTo ?? NaN, displayUnit: 'EUR/mo' },
  ],

  // ═══════════════════════════════════════════════════════════════
  // PT — Portugal
  // ═══════════════════════════════════════════════════════════════
  PT: [
    { section: 'Wages', label: 'Minimum wage (monthly — SMN)', emParam: '$MinWage', appResolver: c => c.minimumWage ?? NaN, displayUnit: 'EUR/mo', note: 'EUROMOD 870 EUR/mo (2025). App 1,020 EUR/mo (2026 legislated increase). Year-gap.', status: 'year_gap' },
    { section: 'Employee SSC', label: 'Segurança Social employee rate', emParam: '$tscee_rate', appResolver: c => c.employeeSSC.components.find(x => x.pensionFunded || x.label.includes('Segur'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Segurança Social employer rate', emParam: '$tscer_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('Segur') || x.label.includes('Regime'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'IRS rate band 1', emParam: '$tin00_rate1', appResolver: c => c.incomeTax.brackets?.[0].rate ?? NaN, displayUnit: '%', note: 'EUROMOD 12.5% (2025). App: 13.25% (OE 2026 rate cut).', status: 'year_gap' },
    { section: 'Income Tax', label: 'IRS band 1 upper threshold (monthly)', emParam: '$tin00_upthres1', appResolver: c => c.incomeTax.brackets?.[0].upTo ?? NaN, displayUnit: 'EUR/mo', note: 'EUROMOD: 8,059/yr = 671.6/mo. App: 7,703/yr = 642/mo (OE 2026).' },
  ],

  // ═══════════════════════════════════════════════════════════════
  // HU — Hungary
  // ═══════════════════════════════════════════════════════════════
  HU: [
    { section: 'Income Tax', label: 'SZJA flat income tax rate (15%)', emParam: '$tin_rate', appResolver: c => (c.incomeTax as any).flatRate ?? c.incomeTax.brackets?.[0].rate ?? NaN, displayUnit: '%' },
    { section: 'Wages', label: 'Minimum wage (monthly — minimálbér)', emParam: '$MinWage_m', appResolver: c => c.minimumWage ?? NaN, displayUnit: 'HUF/mo', note: 'EUROMOD 290,800 HUF/mo (2025). App: 440,100 HUF/mo (2026 government decree +51.7%). Large year-gap flagged by diff.', status: 'changed' },
    { section: 'Employee SSC', label: 'Nyugdíjjárulék (pension) rate', emParam: '$tscee_pen_rate1', appResolver: c => c.employeeSSC.components.find(x => x.pensionFunded)?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'Egészségbiztosítás (health) rate', emParam: '$tscee_hlt_rate1', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Egészség') || x.label.includes('Health'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'Munkaerő-piaci járulék (labour market) rate', emParam: '$tscee_unemp_rate1', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Munkaerő') || x.label.includes('Labour'))?.rate ?? NaN, displayUnit: '%' },
  ],

  // ═══════════════════════════════════════════════════════════════
  // SI — Slovenia
  // ═══════════════════════════════════════════════════════════════
  SI: [
    { section: 'Income Tax', label: 'Dohodnina rate band 1 (16%)', emParam: '$tin_rate1', appResolver: c => c.incomeTax.brackets?.[0].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Dohodnina rate band 2 (27%)', emParam: '$tin_rate2', appResolver: c => c.incomeTax.brackets?.[1].rate ?? NaN, displayUnit: '%', note: 'EUROMOD 26% (2025). App 27% (2026 ZDOH-2 update). Year-gap expected.', status: 'year_gap' },
    { section: 'Income Tax', label: 'Dohodnina rate band 3 (34%)', emParam: '$tin_rate3', appResolver: c => c.incomeTax.brackets?.[2].rate ?? NaN, displayUnit: '%', note: 'EUROMOD 33% (2025). App 34% (2026 ZDOH-2 update). Year-gap expected.', status: 'year_gap' },
    { section: 'Income Tax', label: 'Dohodnina rate band 4 (39%)', emParam: '$tin_rate4', appResolver: c => c.incomeTax.brackets?.[3].rate ?? NaN, displayUnit: '%' },
    { section: 'Income Tax', label: 'Dohodnina rate band 5 (50%)', emParam: '$tin_rate5', appResolver: c => c.incomeTax.brackets?.[4].rate ?? NaN, displayUnit: '%' },
    { section: 'Wages', label: 'Minimum wage (monthly — minimalna plača)', emParam: '$MinWage', appResolver: c => c.minimumWage ?? NaN, displayUnit: 'EUR/mo' },
    { section: 'Wages', label: 'Average wage (monthly)', emParam: '$AvgWage', appResolver: c => c.averageWage, displayUnit: 'EUR/mo', note: 'EUROMOD 2,497 EUR/mo (SURS 2025). App: 2,200 EUR/mo. Year-gap.' },
    { section: 'Employee SSC', label: 'Pokojninsko zavarovanje (ZPIZ pension) rate', emParam: '$tscee_pen_rate', appResolver: c => c.employeeSSC.components.find(x => x.pensionFunded)?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'Zdravstveno zavarovanje (ZZZS health) rate', emParam: '$tscee_health_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Zdravstveno'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employee SSC', label: 'Brezposelnost (unemployment) rate', emParam: '$tscee_unemp_rate', appResolver: c => c.employeeSSC.components.find(x => x.label.includes('Brezposelnost') || x.label.includes('nezaposl'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Pokojninsko zavarovanje (ZPIZ pension) employer rate', emParam: '$tscer_pen_rate', appResolver: c => c.employerSSC.components.find(x => x.pensionFunded)?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Zdravstveno zavarovanje (ZZZS health) employer rate', emParam: '$tscer_health_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('Zdravstveno'))?.rate ?? NaN, displayUnit: '%' },
    { section: 'Employer SSC', label: 'Poškodbe pri delu (work accidents) rate', emParam: '$tscer_occup_rate', appResolver: c => c.employerSSC.components.find(x => x.label.includes('Poškodbe') || x.label.includes('accident'))?.rate ?? NaN, displayUnit: '%' },
  ],
};

/** Format a resolved app value for display */
export function fmtParamValue(value: number, unit = '%'): string {
  if (isNaN(value)) return '—';
  if (unit === '%') return `${(value * 100).toFixed(2)}%`;
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/** Used by toMonthly above (exported for potential unit tests) */
export { toMonthly };
