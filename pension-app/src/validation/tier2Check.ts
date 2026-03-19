import { COUNTRY_MAP } from '../data/countryRegistry';
import { PensionEngine } from '../engines/PensionEngine';
import { SSCEngine } from '../engines/SSCEngine';
import { TaxEngine } from '../engines/TaxEngine';

const tier2 = ['FR', 'BE', 'NL', 'IE', 'LU'];
for (const code of tier2) {
  const c = COUNTRY_MAP[code];
  const AW = c.averageWage;
  const career = c.defaults.retirementAge - c.defaults.careerStartAge;
  const tax = TaxEngine.calculate(c, AW);
  const ssc = SSCEngine.calculate(c, AW);
  const pen = PensionEngine.calculate(c, AW, career, c.defaults.retirementAge);
  const rr = (pen.monthlyPension / AW * 100).toFixed(1);
  const netPct = ((AW - tax.incomeTaxMonthly - ssc.employeeTotal) / AW * 100).toFixed(1);
  console.log(
    `${code}  AW=${AW}  career=${career}yr  pension=${pen.monthlyPension.toFixed(0)} EUR/mo  RR=${rr}%  netTakeHome=${netPct}%  incomplete=${c.incomplete ?? false}`
  );
}
