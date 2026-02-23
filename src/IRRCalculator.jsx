import { useState, useMemo } from "react";

function computeIRR(cashFlows, guess = 0.1) {
  const maxIter = 1000;
  const tol = 1e-7;
  let rate = guess;
  for (let i = 0; i < maxIter; i++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      const pv = cashFlows[t] / Math.pow(1 + rate, t);
      npv += pv;
      if (t > 0) dnpv -= t * cashFlows[t] / Math.pow(1 + rate, t + 1);
    }
    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < tol) return newRate;
    rate = newRate;
  }
  return rate;
}

function computeMortgagePayment(principal, annualRate, years) {
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function computeRemainingBalance(principal, annualRate, years, monthsPaid) {
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return principal - (principal / n) * monthsPaid;
  const payment = computeMortgagePayment(principal, annualRate, years);
  return principal * Math.pow(1 + r, monthsPaid) - payment * (Math.pow(1 + r, monthsPaid) - 1) / r;
}

export default function IRRCalculator() {
  const [purchasePrice, setPurchasePrice] = useState(400000);
  const [downPctInput, setDownPctInput] = useState(20);
  const [mortgageRate, setMortgageRate] = useState(6.8);
  const [monthlyRent, setMonthlyRent] = useState(2400);
  const [rentGrowth, setRentGrowth] = useState(3);
  const [appreciation, setAppreciation] = useState(3.5);
  const [expenseRatio, setExpenseRatio] = useState(45);
  const [holdYears, setHoldYears] = useState(10);
  const [sellingCost, setSellingCost] = useState(6);
  const [closingCost, setClosingCost] = useState(3);

  const analysis = useMemo(() => {
    const downPct = downPctInput / 100;
    const downPayment = purchasePrice * downPct;
    const closingCosts = purchasePrice * (closingCost / 100);
    const loanAmount = purchasePrice - downPayment;
    const monthlyMortgage = computeMortgagePayment(loanAmount, mortgageRate / 100, 30);
    const annualMortgage = monthlyMortgage * 12;

    const cashFlows = [];
    const yearlyData = [];

    // Year 0: initial investment
    const initialOutlay = -(downPayment + closingCosts);
    cashFlows.push(initialOutlay);

    for (let y = 1; y <= holdYears; y++) {
      const rent = monthlyRent * 12 * Math.pow(1 + rentGrowth / 100, y - 1);
      const expenses = rent * (expenseRatio / 100);
      const noi = rent - expenses;
      const cashFlow = noi - annualMortgage;

      if (y < holdYears) {
        cashFlows.push(cashFlow);
      } else {
        // Sale in final year
        const salePrice = purchasePrice * Math.pow(1 + appreciation / 100, holdYears);
        const remainingLoan = computeRemainingBalance(loanAmount, mortgageRate / 100, 30, holdYears * 12);
        const sellingCosts = salePrice * (sellingCost / 100);
        const saleProceeds = salePrice - remainingLoan - sellingCosts;
        cashFlows.push(cashFlow + saleProceeds);

        yearlyData.push({
          year: y,
          rent,
          expenses,
          noi,
          mortgage: annualMortgage,
          cashFlow,
          propertyValue: salePrice,
          saleProceeds,
          totalCashFlow: cashFlow + saleProceeds,
        });
        continue;
      }

      yearlyData.push({
        year: y,
        rent,
        expenses,
        noi,
        mortgage: annualMortgage,
        cashFlow,
        propertyValue: purchasePrice * Math.pow(1 + appreciation / 100, y),
      });
    }

    let irr;
    try {
      irr = computeIRR(cashFlows, 0.08);
      if (isNaN(irr) || !isFinite(irr)) irr = null;
    } catch {
      irr = null;
    }

    const totalCashInvested = downPayment + closingCosts;
    const totalCashFlow = cashFlows.slice(1).reduce((a, b) => a + b, 0);
    const totalReturn = totalCashFlow + totalCashInvested;
    const equityMultiple = totalReturn / totalCashInvested;
    const cashOnCash = yearlyData.length > 0 ? (yearlyData[0].cashFlow / totalCashInvested) * 100 : 0;

    return {
      irr,
      downPayment,
      closingCosts,
      totalCashInvested,
      loanAmount,
      monthlyMortgage,
      equityMultiple,
      cashOnCash,
      yearlyData,
      cashFlows,
    };
  }, [purchasePrice, downPctInput, mortgageRate, monthlyRent, rentGrowth, appreciation, expenseRatio, holdYears, sellingCost, closingCost]);

  // Price sensitivity table
  const pricePoints = [250000, 300000, 350000, 400000, 450000, 500000, 550000, 600000];
  const sensitivityData = useMemo(() => {
    return pricePoints.map((price) => {
      const dp = price * (downPctInput / 100);
      const cc = price * (closingCost / 100);
      const loan = price - dp;
      const mp = computeMortgagePayment(loan, mortgageRate / 100, 30);
      const am = mp * 12;
      const flows = [-(dp + cc)];
      for (let y = 1; y <= holdYears; y++) {
        const rent = monthlyRent * 12 * Math.pow(1 + rentGrowth / 100, y - 1);
        const exp = rent * (expenseRatio / 100);
        const cf = rent - exp - am;
        if (y < holdYears) {
          flows.push(cf);
        } else {
          const sv = price * Math.pow(1 + appreciation / 100, holdYears);
          const rl = computeRemainingBalance(loan, mortgageRate / 100, 30, holdYears * 12);
          const sc = sv * (sellingCost / 100);
          flows.push(cf + sv - rl - sc);
        }
      }
      let irr;
      try {
        irr = computeIRR(flows, 0.08);
        if (isNaN(irr) || !isFinite(irr)) irr = null;
      } catch {
        irr = null;
      }
      const yr1cf = monthlyRent * 12 * (1 - expenseRatio / 100) - am;
      const coc = (yr1cf / (dp + cc)) * 100;
      return { price, irr, cashOnCash: coc, downPayment: dp + cc, monthlyCashFlow: yr1cf / 12 };
    });
  }, [downPctInput, mortgageRate, monthlyRent, rentGrowth, appreciation, expenseRatio, holdYears, sellingCost, closingCost]);

  const fmt = (n) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const fmtPct = (n) => (n != null ? (n * 100).toFixed(1) + "%" : "N/A");

  const irrColor = (irr) => {
    if (irr === null) return "text-gray-500";
    if (irr >= 0.12) return "text-emerald-600";
    if (irr >= 0.08) return "text-green-600";
    if (irr >= 0.04) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-800 mb-1">Rental Property IRR Calculator</h1>
          <p className="text-stone-500">1895 Oakland Victorian · Adjust assumptions below</p>
        </div>

        {/* Big IRR Display */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 mb-6 flex flex-wrap gap-8 items-center justify-center">
          <div className="text-center">
            <div className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-1">IRR</div>
            <div className={`text-5xl font-bold ${irrColor(analysis.irr)}`}>
              {analysis.irr != null ? fmtPct(analysis.irr) : "N/A"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-1">Cash-on-Cash (Yr 1)</div>
            <div className="text-3xl font-semibold text-stone-700">{analysis.cashOnCash.toFixed(1)}%</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-1">Equity Multiple</div>
            <div className="text-3xl font-semibold text-stone-700">{analysis.equityMultiple.toFixed(2)}x</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-1">Cash Invested</div>
            <div className="text-3xl font-semibold text-stone-700">{fmt(analysis.totalCashInvested)}</div>
          </div>
        </div>

        {/* Inputs */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-stone-700 mb-4">Assumptions</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: "Purchase Price", value: purchasePrice, set: setPurchasePrice, step: 10000, min: 0, max: 10000000, prefix: "$", fmt: (v) => (v / 1000).toFixed(0) + "k" },
              { label: "Down Payment %", value: downPctInput, set: setDownPctInput, step: 5, min: 0, max: 100, suffix: "%" },
              { label: "Mortgage Rate", value: mortgageRate, set: setMortgageRate, step: 0.25, min: 0, max: 12, suffix: "%" },
              { label: "Monthly Rent", value: monthlyRent, set: setMonthlyRent, step: 100, prefix: "$" },
              { label: "Rent Growth/yr", value: rentGrowth, set: setRentGrowth, step: 0.5, min: 0, max: 10, suffix: "%" },
              { label: "Appreciation/yr", value: appreciation, set: setAppreciation, step: 0.5, min: -5, max: 15, suffix: "%" },
              { label: "Expense Ratio", value: expenseRatio, set: setExpenseRatio, step: 5, min: 10, max: 70, suffix: "%" },
              { label: "Hold Period (yrs)", value: holdYears, set: setHoldYears, step: 1, min: 1, max: 30 },
              { label: "Selling Costs", value: sellingCost, set: setSellingCost, step: 0.5, min: 0, max: 10, suffix: "%" },
              { label: "Closing Costs", value: closingCost, set: setClosingCost, step: 0.5, min: 0, max: 10, suffix: "%" },
            ].map((input) => (
              <div key={input.label} className="flex flex-col">
                <label className="text-xs font-medium text-stone-500 mb-1">{input.label}</label>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => input.set((v) => Math.max(input.min ?? 0, v - input.step))}
                    className="w-7 h-8 rounded bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold text-sm flex items-center justify-center"
                  >−</button>
                  <div className="flex-1 text-center text-sm font-semibold text-stone-800 bg-stone-50 rounded h-8 flex items-center justify-center">
                    {input.prefix || ""}{input.fmt ? input.fmt(input.value) : input.value}{input.suffix || ""}
                  </div>
                  <button
                    onClick={() => input.set((v) => Math.min(input.max ?? 10000000, v + input.step))}
                    className="w-7 h-8 rounded bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold text-sm flex items-center justify-center"
                  >+</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Price Sensitivity Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-stone-700 mb-4">IRR by Purchase Price</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left py-2 px-3 font-medium text-stone-500">Price</th>
                  <th className="text-right py-2 px-3 font-medium text-stone-500">Cash In</th>
                  <th className="text-right py-2 px-3 font-medium text-stone-500">Mo. Cash Flow</th>
                  <th className="text-right py-2 px-3 font-medium text-stone-500">Cash-on-Cash</th>
                  <th className="text-right py-2 px-3 font-medium text-stone-500">IRR ({holdYears}yr)</th>
                </tr>
              </thead>
              <tbody>
                {sensitivityData.map((row) => (
                  <tr
                    key={row.price}
                    className={`border-b border-stone-100 ${row.price === purchasePrice ? "bg-blue-50 font-semibold" : "hover:bg-stone-50"}`}
                  >
                    <td className="py-2.5 px-3 text-stone-700">
                      {fmt(row.price)}
                      {row.price === purchasePrice && <span className="ml-2 text-xs text-blue-500">← selected</span>}
                    </td>
                    <td className="py-2.5 px-3 text-right text-stone-600">{fmt(row.downPayment)}</td>
                    <td className={`py-2.5 px-3 text-right ${row.monthlyCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmt(row.monthlyCashFlow)}
                    </td>
                    <td className={`py-2.5 px-3 text-right ${row.cashOnCash >= 0 ? "text-stone-700" : "text-red-600"}`}>
                      {row.cashOnCash.toFixed(1)}%
                    </td>
                    <td className={`py-2.5 px-3 text-right font-semibold ${irrColor(row.irr)}`}>
                      {fmtPct(row.irr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Year by Year */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          <h2 className="text-lg font-semibold text-stone-700 mb-4">Year-by-Year Cash Flows</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left py-2 px-2 font-medium text-stone-500">Yr</th>
                  <th className="text-right py-2 px-2 font-medium text-stone-500">Gross Rent</th>
                  <th className="text-right py-2 px-2 font-medium text-stone-500">Expenses</th>
                  <th className="text-right py-2 px-2 font-medium text-stone-500">Mortgage</th>
                  <th className="text-right py-2 px-2 font-medium text-stone-500">Cash Flow</th>
                  <th className="text-right py-2 px-2 font-medium text-stone-500">Property Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-stone-100 bg-stone-50">
                  <td className="py-2 px-2 text-stone-700 font-medium">0</td>
                  <td colSpan={4} className="py-2 px-2 text-right text-red-600 font-medium">
                    −{fmt(analysis.totalCashInvested)} (initial investment)
                  </td>
                  <td className="py-2 px-2 text-right text-stone-600">{fmt(purchasePrice)}</td>
                </tr>
                {analysis.yearlyData.map((row) => (
                  <tr key={row.year} className={`border-b border-stone-100 ${row.year === holdYears ? "bg-emerald-50" : ""}`}>
                    <td className="py-2 px-2 text-stone-700 font-medium">{row.year}</td>
                    <td className="py-2 px-2 text-right text-stone-600">{fmt(row.rent)}</td>
                    <td className="py-2 px-2 text-right text-red-500">−{fmt(row.expenses)}</td>
                    <td className="py-2 px-2 text-right text-red-500">−{fmt(row.mortgage)}</td>
                    <td className={`py-2 px-2 text-right font-medium ${row.cashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmt(row.cashFlow)}
                    </td>
                    <td className="py-2 px-2 text-right text-stone-600">{fmt(row.propertyValue)}</td>
                  </tr>
                ))}
                {analysis.yearlyData.length > 0 && (
                  <tr className="bg-emerald-50 font-semibold">
                    <td colSpan={4} className="py-2 px-2 text-right text-stone-600">Sale Proceeds (after loan payoff & costs):</td>
                    <td className="py-2 px-2 text-right text-emerald-700">
                      +{fmt(analysis.yearlyData[analysis.yearlyData.length - 1].saleProceeds)}
                    </td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-stone-400 mt-4 text-center">
          For educational purposes only. Not financial advice. Consult a financial advisor before making investment decisions.
        </p>
      </div>
    </div>
  );
}
