import { czechRepublic } from '../data/czechRepublic';
import { TaxEngine } from '../engines/TaxEngine';
import { SSCEngine } from '../engines/SSCEngine';

const gross = czechRepublic.averageWage; // 48,967
const tax = TaxEngine.calculate(czechRepublic, gross);
const ssc = SSCEngine.calculate(czechRepublic, gross);

const c = ssc.components;
const eePension  = c.find(x => x.label === 'Pension Insurance')?.employeeAmount ?? 0;
const eeSick     = c.find(x => x.label === 'Sick Leave Insurance')?.employeeAmount ?? 0;
const eeHealth   = c.find(x => x.label === 'Health Insurance')?.employeeAmount ?? 0;
const erPension  = c.find(x => x.label === 'Pension Insurance')?.employerAmount ?? 0;
const erSick     = c.find(x => x.label === 'Sick Leave Insurance')?.employerAmount ?? 0;
const erStateEmp = c.find(x => x.label === 'State Employment Policy')?.employerAmount ?? 0;
const erHealth   = c.find(x => x.label === 'Health Insurance')?.employerAmount ?? 0;

const net = gross - ssc.employeeTotal - tax.incomeTaxMonthly;

function row(label: string, got: number, ref: number) {
  const ok = Math.round(got) === ref;
  console.log(`${ok ? '✅' : '❌'}  ${label.padEnd(36)} got=${String(Math.round(got)).padStart(6)}  ref=${String(ref).padStart(6)}${ok ? '' : '  DIFF=' + (Math.round(got) - ref)}`);
}

console.log('=== CZ 2026 @ 1×AW (48,967 CZK) ===\n');
row('Hrubá mzda',                   gross,                   48_967);
console.log();
row('Tax base (ceil100)',            tax.taxableBase,         49_000);
row('Raw tax before slevy',         tax.taxableBase * 0.15,   7_350);
row('Záloha na daň (after slevy)',  tax.incomeTaxMonthly,     4_780);
console.log();
row('Ee Pension Insurance (6.5%)',  eePension,                3_183);
row('Ee Sick Leave (0.6%)',         eeSick,                     294);
row('Ee Sociální+nemocenské total', eePension + eeSick,       3_477);
row('Ee Health Insurance (4.5%)',   eeHealth,                  2_204);
row('Employee SSC total',           ssc.employeeTotal,         5_681);
console.log();
row('Er Pension Insurance (21.5%)', erPension,               10_528);
row('Er Sick Leave (2.1%)',         erSick,                    1_028);
row('Er State Employment (1.2%)',   erStateEmp,                  588);
row('Er ČSSZ total (24.8%)',        erPension+erSick+erStateEmp, 12_144);
row('Er Health Insurance (9%)',     erHealth,                  4_408);
row('Employer SSC total',           ssc.employerTotal,        16_552);
console.log();
row('Čistý příjem (net)',           net,                      38_506);
row('Total employer cost',          ssc.totalEmployerCost,    65_519);
