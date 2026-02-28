import { useState, useMemo, useCallback } from "react";

function computeIRR(cashFlows, guess = 0.1) {
  const maxIter = 1000;
  const tol = 1e-7;
  let rate = guess;
  for (let i = 0; i < maxIter; i++) {
    let npv = 0, dnpv = 0;
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
  if (r === 0) return principal - (principal / (years * 12)) * monthsPaid;
  const payment = computeMortgagePayment(principal, annualRate, years);
  return principal * Math.pow(1 + r, monthsPaid) - payment * (Math.pow(1 + r, monthsPaid) - 1) / r;
}

// Helper: calculate maintenance rate from age
function calculateMaintenanceRate(age) {
  // Maintenance rate: 0.75% for new, scaling to ~2.5% for 130+ year old
  // Curve: starts slow, accelerates after 50 years
  return 0.75 + Math.min(1.75, (age / 130) * 1.25 + Math.max(0, (age - 50) / 80) * 0.5);
}

// Model: estimate costs based on home age
function estimateCosts(yearBuilt) {
  const currentYear = 2026;
  const age = currentYear - yearBuilt;

  const maintenanceRate = calculateMaintenanceRate(age);

  // CapEx reserve: $500/yr for new, up to $4000/yr for very old
  const capexReserve = Math.round((500 + (age / 130) * 2500 + Math.max(0, (age - 40) / 90) * 1000) / 100) * 100;

  // Insurance: $1200 for new, up to $2800 for very old
  const insurance = Math.round((1200 + (age / 130) * 1200 + Math.max(0, (age - 60) / 70) * 400) / 100) * 100;

  // Build a description of likely issues
  let issues = [];
  if (age >= 100) {
    issues = [
      { item: "Foundation", cost: "$15–40k", status: "critical", note: "Brick/stone foundation, likely needs seismic retrofit" },
      { item: "Electrical", cost: "$8–15k", status: "critical", note: "Knob-and-tube wiring, fire hazard" },
      { item: "Plumbing", cost: "$5–15k", status: "critical", note: "Galvanized/lead pipes, corrosion likely" },
      { item: "Roof", cost: "$15–25k", status: "warning", note: "Complex Victorian rooflines cost more" },
      { item: "Windows", cost: "$15–30k", status: "warning", note: "Single-pane, period-appropriate replacements expensive" },
      { item: "Lead Paint", cost: "$5–15k", status: "critical", note: "Mandatory disclosure, remediation for rental" },
      { item: "Insulation", cost: "$3–8k", status: "info", note: "Likely minimal, walls may lack any" },
      { item: "Sewer Lateral", cost: "$5–15k", status: "warning", note: "Original clay pipes, root intrusion common" },
    ];
  } else if (age >= 70) {
    issues = [
      { item: "Foundation", cost: "$5–20k", status: "warning", note: "May need bolting or minor repair" },
      { item: "Electrical", cost: "$3–10k", status: "warning", note: "Panel upgrade likely needed, possible old wiring" },
      { item: "Plumbing", cost: "$3–8k", status: "warning", note: "Mixed piping, some galvanized likely" },
      { item: "Roof", cost: "$10–20k", status: "warning", note: "Likely replaced once, may be due again" },
      { item: "Windows", cost: "$8–20k", status: "info", note: "Likely single-pane, upgrade recommended" },
      { item: "Sewer Lateral", cost: "$3–10k", status: "info", note: "Cast iron or clay, inspect before purchase" },
    ];
  } else if (age >= 40) {
    issues = [
      { item: "Roof", cost: "$8–15k", status: "warning", note: "Original roof likely at end of life" },
      { item: "HVAC", cost: "$5–10k", status: "warning", note: "Original system nearing replacement" },
      { item: "Water Heater", cost: "$1–3k", status: "info", note: "May have been replaced already" },
      { item: "Electrical Panel", cost: "$2–4k", status: "info", note: "May need upgrade for modern loads" },
      { item: "Windows", cost: "$5–15k", status: "info", note: "Dual-pane but seals may be failing" },
      { item: "Cosmetic", cost: "$3–8k", status: "info", note: "Kitchens/baths may feel dated" },
    ];
  } else if (age >= 20) {
    issues = [
      { item: "HVAC", cost: "$5–10k", status: "info", note: "May need replacement in 5–10 years" },
      { item: "Roof", cost: "$8–15k", status: "info", note: "~10–15 years of life remaining" },
      { item: "Water Heater", cost: "$1–3k", status: "info", note: "Nearing end of life" },
      { item: "Cosmetic", cost: "$2–5k", status: "info", note: "Minor updates to stay competitive" },
    ];
  } else {
    issues = [
      { item: "Minimal repairs expected", cost: "$0–2k/yr", status: "good", note: "Most systems under warranty or nearly new" },
      { item: "Cosmetic only", cost: "$1–3k", status: "good", note: "Touch-ups between tenants" },
    ];
  }

  // Age bracket label
  let ageLabel, ageColor;
  if (age >= 100) { ageLabel = "Antique"; ageColor = "text-red-700 bg-red-100"; }
  else if (age >= 70) { ageLabel = "Very Old"; ageColor = "text-orange-700 bg-orange-100"; }
  else if (age >= 40) { ageLabel = "Aging"; ageColor = "text-yellow-700 bg-yellow-100"; }
  else if (age >= 20) { ageLabel = "Mature"; ageColor = "text-lime-700 bg-lime-100"; }
  else { ageLabel = "Modern"; ageColor = "text-emerald-700 bg-emerald-100"; }

  return { maintenanceRate: Math.round(maintenanceRate * 100) / 100, capexReserve, insurance, issues, age, ageLabel, ageColor };
}

function runAnalysis(params) {
  const { purchasePrice, downPctInput, mortgageRate, monthlyRent, rentGrowth, appreciation, holdYears, sellingCost, closingCost, propertyTaxRate, insurance, vacancyRate, propertyMgmt, maintenanceRate, capexReserve, monthlyHOA = 0, hoaGrowthRate = 6, renovationBonus = 0, yearBuilt = null } = params;
  const downPct = downPctInput / 100;
  const downPayment = purchasePrice * downPct;
  const closingCosts = purchasePrice * (closingCost / 100);
  const loanAmount = purchasePrice - downPayment;
  const monthlyMortgage = computeMortgagePayment(loanAmount, mortgageRate / 100, 30);
  const annualMortgage = monthlyMortgage * 12;
  const cashFlows = [];
  const yearlyData = [];
  cashFlows.push(-(downPayment + closingCosts));

  for (let y = 1; y <= holdYears; y++) {
    const rent = monthlyRent * 12 * Math.pow(1 + rentGrowth / 100, y - 1);
    // Apply renovation bonus starting in year 1
    const baseValue = purchasePrice + (y >= 1 ? renovationBonus : 0);
    const propValueStart = baseValue * Math.pow(1 + appreciation / 100, Math.max(0, y - 1));
    const propValue = baseValue * Math.pow(1 + appreciation / 100, y);
    const propTax = propValueStart * (propertyTaxRate / 100);
    const ins = insurance * Math.pow(1.03, y - 1);
    const vacancy = rent * (vacancyRate / 100);
    const mgmt = rent * (propertyMgmt / 100);

    // Age-based maintenance: recalculate rate each year as home ages
    const currentYear = 2026;
    const currentAge = yearBuilt !== null ? (currentYear - yearBuilt) + (y - 1) : null;
    const yearlyMaintenanceRate = currentAge !== null ? calculateMaintenanceRate(currentAge) : maintenanceRate;
    const maintenance = propValueStart * (yearlyMaintenanceRate / 100);

    const capex = capexReserve * Math.pow(1.03, y - 1);
    const hoa = (monthlyHOA || 0) * 12 * Math.pow(1 + (hoaGrowthRate || 0) / 100, y - 1);
    const totalExpenses = propTax + ins + vacancy + mgmt + maintenance + capex + hoa;
    const noi = rent - totalExpenses;
    const cashFlow = noi - annualMortgage;
    const expenseBreakdown = { propTax, ins, vacancy, mgmt, maintenance, maintenanceRate: yearlyMaintenanceRate, capex, hoa, totalExpenses };

    if (y < holdYears) {
      cashFlows.push(cashFlow);
    } else {
      const remainingLoan = computeRemainingBalance(loanAmount, mortgageRate / 100, 30, holdYears * 12);
      const sellingCosts = propValue * (sellingCost / 100);
      const saleProceeds = propValue - remainingLoan - sellingCosts;
      cashFlows.push(cashFlow + saleProceeds);
      yearlyData.push({ year: y, rent, totalExpenses, noi, mortgage: annualMortgage, cashFlow, propertyValue: propValue, saleProceeds, expenseBreakdown });
      continue;
    }
    yearlyData.push({ year: y, rent, totalExpenses, noi, mortgage: annualMortgage, cashFlow, propertyValue: propValue, expenseBreakdown });
  }

  let irr;
  try { irr = computeIRR(cashFlows, 0.08); if (isNaN(irr) || !isFinite(irr)) irr = null; } catch { irr = null; }

  const totalCashInvested = downPayment + closingCosts;
  const cashOnCash = yearlyData.length > 0 ? (yearlyData[0].cashFlow / totalCashInvested) * 100 : 0;
  const expenseRatioYr1 = yearlyData.length > 0 ? (yearlyData[0].totalExpenses / yearlyData[0].rent) * 100 : 0;
  const totalCashFlow = cashFlows.slice(1).reduce((a, b) => a + b, 0);
  const equityMultiple = totalCashFlow / totalCashInvested;

  return { irr, downPayment, closingCosts, totalCashInvested, monthlyMortgage, equityMultiple, cashOnCash, yearlyData, expenseRatioYr1 };
}

export default function IRRCalculator() {
  const [yearBuilt, setYearBuilt] = useState(1895);
  const [purchasePrice, setPurchasePrice] = useState(400000);
  const [downPctInput, setDownPctInput] = useState(20);
  const [mortgageRate, setMortgageRate] = useState(6.0);
  const [monthlyRent, setMonthlyRent] = useState(2400);
  const [rentGrowth, setRentGrowth] = useState(3);
  const [appreciation, setAppreciation] = useState(3.5);
  const [holdYears, setHoldYears] = useState(10);
  const [sellingCost, setSellingCost] = useState(6);
  const [closingCost, setClosingCost] = useState(3);
  const [propertyTaxRate, setPropertyTaxRate] = useState(1.2);
  const [vacancyRate, setVacancyRate] = useState(5);
  const [propertyMgmt, setPropertyMgmt] = useState(8);
  const [monthlyHOA, setMonthlyHOA] = useState(0);
  const [hoaGrowthRate, setHoaGrowthRate] = useState(6);
  const [renovationBonus, setRenovationBonus] = useState(0);

  // Manual overrides (null = use estimated)
  const [manualMaint, setManualMaint] = useState(null);
  const [manualCapex, setManualCapex] = useState(null);
  const [manualInsurance, setManualInsurance] = useState(null);

  const costs = useMemo(() => estimateCosts(yearBuilt), [yearBuilt]);

  const insurance = manualInsurance !== null ? manualInsurance : costs.insurance;
  const maintenanceRate = manualMaint !== null ? manualMaint : costs.maintenanceRate;
  const capexReserve = manualCapex !== null ? manualCapex : costs.capexReserve;

  const sharedParams = { purchasePrice, downPctInput, mortgageRate, monthlyRent, rentGrowth, appreciation, holdYears, sellingCost, closingCost, propertyTaxRate, vacancyRate, propertyMgmt };

  const analysis = useMemo(() => runAnalysis({ ...sharedParams, insurance, maintenanceRate, capexReserve, monthlyHOA, hoaGrowthRate, renovationBonus, yearBuilt }), [purchasePrice, downPctInput, mortgageRate, monthlyRent, rentGrowth, appreciation, holdYears, sellingCost, closingCost, propertyTaxRate, vacancyRate, propertyMgmt, insurance, maintenanceRate, capexReserve, monthlyHOA, hoaGrowthRate, renovationBonus, yearBuilt]);

  // Compare across decades
  const decadeComparison = useMemo(() => {
    const decades = [1890, 1920, 1950, 1970, 1990, 2000, 2010, 2020];
    return decades.map(yr => {
      const c = estimateCosts(yr);
      const res = runAnalysis({ ...sharedParams, insurance: c.insurance, maintenanceRate: c.maintenanceRate, capexReserve: c.capexReserve, monthlyHOA, hoaGrowthRate, yearBuilt: yr });
      const yr1 = res.yearlyData[0];
      return { yearBuilt: yr, ...c, irr: res.irr, cashOnCash: res.cashOnCash, yr1Expenses: yr1 ? yr1.totalExpenses : 0, yr1CashFlow: yr1 ? yr1.cashFlow : 0 };
    });
  }, [purchasePrice, downPctInput, mortgageRate, monthlyRent, rentGrowth, appreciation, holdYears, sellingCost, closingCost, propertyTaxRate, vacancyRate, propertyMgmt, monthlyHOA, hoaGrowthRate]);

  // Price sensitivity
  const pricePoints = [250000, 300000, 350000, 400000, 450000, 500000, 550000, 600000];
  const sensitivityData = useMemo(() => {
    return pricePoints.map(price => {
      const res = runAnalysis({ ...sharedParams, purchasePrice: price, insurance, maintenanceRate, capexReserve, monthlyHOA, hoaGrowthRate, renovationBonus, yearBuilt });
      const yr1 = res.yearlyData[0];
      return { price, irr: res.irr, cashOnCash: res.cashOnCash, downPayment: res.totalCashInvested, monthlyCashFlow: yr1 ? yr1.cashFlow / 12 : 0 };
    });
  }, [purchasePrice, downPctInput, mortgageRate, monthlyRent, rentGrowth, appreciation, holdYears, sellingCost, closingCost, propertyTaxRate, vacancyRate, propertyMgmt, insurance, maintenanceRate, capexReserve, monthlyHOA, hoaGrowthRate, renovationBonus, yearBuilt]);

  const fmt = (n) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const fmtPct = (n) => (n != null ? (n * 100).toFixed(1) + "%" : "N/A");

  const irrColor = (irr) => {
    if (irr === null) return "text-gray-400";
    if (irr >= 0.15) return "text-emerald-600";
    if (irr >= 0.12) return "text-green-600";
    if (irr >= 0.10) return "text-lime-600";
    if (irr >= 0.08) return "text-yellow-600";
    if (irr >= 0.05) return "text-orange-500";
    return "text-red-600";
  };
  const irrBg = (irr) => {
    if (irr === null) return "bg-gray-50";
    if (irr >= 0.15) return "bg-emerald-50";
    if (irr >= 0.12) return "bg-green-50";
    if (irr >= 0.10) return "bg-lime-50";
    if (irr >= 0.08) return "bg-yellow-50";
    if (irr >= 0.05) return "bg-orange-50";
    return "bg-red-50";
  };
  const irrLabel = (irr) => {
    if (irr === null) return "N/A";
    if (irr >= 0.15) return "Excellent";
    if (irr >= 0.12) return "Strong";
    if (irr >= 0.10) return "Solid";
    if (irr >= 0.08) return "Acceptable";
    if (irr >= 0.05) return "Weak";
    return "Poor";
  };

  const statusIcon = (s) => {
    if (s === "critical") return "🔴";
    if (s === "warning") return "🟡";
    if (s === "info") return "🔵";
    return "🟢";
  };

  const SliderInput = ({ label, value, set, step, min, max, prefix, suffix, fmtFn, hint, highlight, allowDirectInput = false }) => {
    const parseAndClamp = (raw) => {
      const parsed = parseFloat(raw);
      if (!Number.isFinite(parsed)) return null;
      return Math.min(max, Math.max(min, parsed));
    };

    return (
    <div className={`flex flex-col gap-1 ${highlight ? "bg-amber-50 rounded-lg p-2 -m-2" : ""}`}>
      <div className="flex justify-between items-baseline">
        <label className="text-xs font-medium text-stone-500">{label}</label>
        {allowDirectInput ? (
          <div className="flex items-center gap-1">
            {prefix && <span className="text-sm font-semibold text-stone-800">{prefix}</span>}
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(e) => {
                const nextValue = parseAndClamp(e.target.value);
                if (nextValue !== null) set(nextValue);
              }}
              className="w-24 rounded-md border border-stone-300 bg-white px-2 py-0.5 text-right text-sm font-semibold text-stone-800 focus:border-stone-500 focus:outline-none"
            />
            {suffix && <span className="text-sm font-semibold text-stone-800">{suffix}</span>}
          </div>
        ) : (
          <span className="text-sm font-semibold text-stone-800">{prefix || ""}{fmtFn ? fmtFn(value) : value}{suffix || ""}</span>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const nextValue = parseAndClamp(e.target.value);
          if (nextValue !== null) set(nextValue);
        }}
        className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-600"
      />
      {hint && <span className="text-xs text-stone-400 italic">{hint}</span>}
    </div>
  );
  };

  const yr1 = analysis.yearlyData.length > 0 ? analysis.yearlyData[0] : null;

  // Age visual bar
  const ageBarWidth = Math.min(100, (costs.age / 140) * 100);

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-stone-800 mb-1"> Rental — IRR Calculator</h1>
          <p className="text-stone-500">Repair costs estimated by year built</p>
        </div>

        {/* Year Built Hero */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-stone-800">Year Built</h2>
            <div className="flex items-center gap-3">
              <span className="text-4xl font-black text-stone-800">{yearBuilt}</span>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${costs.ageColor}`}>{costs.ageLabel} · {costs.age} yrs old</span>
            </div>
          </div>
          <input type="range" min={1860} max={2024} step={1} value={yearBuilt}
            onChange={(e) => { setYearBuilt(parseInt(e.target.value)); setManualMaint(null); setManualCapex(null); setManualInsurance(null); }}
            className="w-full h-2 bg-gradient-to-r from-red-300 via-yellow-200 to-emerald-300 rounded-lg appearance-none cursor-pointer accent-stone-700" />
          <div className="flex justify-between text-xs text-stone-400 mt-1">
            <span>1860</span><span>1900</span><span>1940</span><span>1970</span><span>2000</span><span>2024</span>
          </div>

          {/* Auto-estimated costs */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="bg-stone-50 rounded-lg p-3 text-center">
              <div className="text-xs text-stone-400 font-medium">Est. Maintenance (Year 1)</div>
              <div className="text-xl font-bold text-stone-800">{maintenanceRate}%<span className="text-xs font-normal text-stone-400"> of value/yr</span></div>
              <div className="text-xs text-stone-500">{fmt(purchasePrice * (maintenanceRate / 100))}/yr</div>
              <div className="text-xs text-amber-600 font-medium mt-1">↑ Increases with age</div>
            </div>
            <div className="bg-stone-50 rounded-lg p-3 text-center">
              <div className="text-xs text-stone-400 font-medium">Est. CapEx Reserve</div>
              <div className="text-xl font-bold text-stone-800">{fmt(capexReserve)}<span className="text-xs font-normal text-stone-400">/yr</span></div>
              <div className="text-xs text-stone-500">{fmt(capexReserve / 12)}/mo</div>
            </div>
            <div className="bg-stone-50 rounded-lg p-3 text-center">
              <div className="text-xs text-stone-400 font-medium">Est. Insurance</div>
              <div className="text-xl font-bold text-stone-800">{fmt(insurance)}<span className="text-xs font-normal text-stone-400">/yr</span></div>
              <div className="text-xs text-stone-500">{fmt(insurance / 12)}/mo</div>
            </div>
          </div>
        </div>

        {/* Likely Repair Items */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 mb-6">
          <h3 className="text-sm font-bold text-stone-700 mb-3">Expected Repair Items — {yearBuilt} Build ({costs.age} years old)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {costs.issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-stone-50">
                <span>{statusIcon(issue.status)}</span>
                <div>
                  <span className="font-semibold text-stone-700">{issue.item}</span>
                  <span className="text-stone-400 ml-2">{issue.cost}</span>
                  <div className="text-xs text-stone-500">{issue.note}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-4 text-xs text-stone-400">
            <span>🔴 Critical/likely needed</span><span>🟡 May be needed</span><span>🔵 Monitor</span><span>🟢 Good shape</span>
          </div>
        </div>

        {/* Hero Metrics */}
        <div className={`rounded-2xl shadow-sm border border-stone-200 p-6 mb-6 ${irrBg(analysis.irr)}`}>
          <div className="flex flex-wrap gap-8 items-center justify-center">
            <div className="text-center">
              <div className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">IRR ({holdYears}-yr)</div>
              <div className={`text-5xl font-bold ${irrColor(analysis.irr)}`}>{fmtPct(analysis.irr)}</div>
              <div className={`text-sm font-semibold mt-1 ${irrColor(analysis.irr)}`}>{irrLabel(analysis.irr)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Cap Rate</div>
              <div className="text-3xl font-semibold text-stone-700">{yr1 ? ((yr1.noi / purchasePrice) * 100).toFixed(1) + "%" : "—"}</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Cash-on-Cash</div>
              <div className="text-3xl font-semibold text-stone-700">{analysis.cashOnCash.toFixed(1)}%</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Eq. Multiple</div>
              <div className="text-3xl font-semibold text-stone-700">{analysis.equityMultiple.toFixed(2)}x</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Expense Ratio</div>
              <div className="text-3xl font-semibold text-stone-700">{analysis.expenseRatioYr1.toFixed(0)}%</div>
            </div>
          </div>
        </div>

        {/* IRR by Decade */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-stone-700 mb-4">IRR by Decade Built — Same Price, Same Rent</h2>
          <p className="text-xs text-stone-400 mb-3">Shows how home age alone affects returns at {fmt(purchasePrice)} / {fmt(monthlyRent)}/mo</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left py-2 px-2 font-medium text-stone-500">Built</th>
                  <th className="text-center py-2 px-2 font-medium text-stone-500">Age</th>
                  <th className="text-right py-2 px-2 font-medium text-stone-500">Maint %</th>
                  <th className="text-right py-2 px-2 font-medium text-stone-500">CapEx</th>
                  <th className="text-right py-2 px-2 font-medium text-stone-500">Insurance</th>
                  <th className="text-right py-2 px-2 font-medium text-stone-500">Yr1 Expenses</th>
                  <th className="text-right py-2 px-2 font-medium text-stone-500">Yr1 CF</th>
                  <th className="text-right py-2 px-2 font-medium text-stone-500">IRR</th>
                  <th className="text-center py-2 px-2 font-medium text-stone-500">Rating</th>
                </tr>
              </thead>
              <tbody>
                {decadeComparison.map((row) => {
                  const isSelected = Math.abs(row.yearBuilt - yearBuilt) <= 5;
                  return (
                    <tr key={row.yearBuilt} className={`border-b border-stone-100 ${isSelected ? "ring-2 ring-blue-400 ring-inset bg-blue-50" : "hover:bg-stone-50"}`}>
                      <td className="py-2 px-2 font-bold text-stone-700">{row.yearBuilt}s{isSelected && <span className="ml-1 text-xs text-blue-500">✦</span>}</td>
                      <td className="py-2 px-2 text-center"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${row.ageColor}`}>{row.age}yr</span></td>
                      <td className="py-2 px-2 text-right text-stone-600">{row.maintenanceRate}%</td>
                      <td className="py-2 px-2 text-right text-stone-600">{fmt(row.capexReserve)}</td>
                      <td className="py-2 px-2 text-right text-stone-600">{fmt(row.insurance)}</td>
                      <td className="py-2 px-2 text-right text-red-500">{fmt(row.yr1Expenses)}</td>
                      <td className={`py-2 px-2 text-right font-medium ${row.yr1CashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(row.yr1CashFlow)}</td>
                      <td className={`py-2 px-2 text-right font-bold ${irrColor(row.irr)}`}>{fmtPct(row.irr)}</td>
                      <td className="py-2 px-2 text-center"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${irrBg(row.irr)} ${irrColor(row.irr)}`}>{irrLabel(row.irr)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* All inputs */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-stone-700 mb-4">Deal Assumptions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
            <SliderInput label="Purchase Price" value={purchasePrice} set={setPurchasePrice} step={10000} min={10000} max={1800000} prefix="$" fmtFn={(v) => (v / 1000).toFixed(0) + "k"} />
            <SliderInput label="Down Payment" value={downPctInput} set={setDownPctInput} step={5} min={0} max={100} suffix="%" />
            <SliderInput label="Mortgage Rate (30yr)" value={mortgageRate} set={setMortgageRate} step={0.125} min={3} max={10} suffix="%" hint="Current avg ~6.0%" />
            <SliderInput label="Monthly Rent" value={monthlyRent} set={setMonthlyRent} step={100} min={1000} max={50000} prefix="$" allowDirectInput />
            <SliderInput label="Annual Rent Growth" value={rentGrowth} set={setRentGrowth} step={0.5} min={0} max={8} suffix="%" />
            <SliderInput label="Annual Appreciation" value={appreciation} set={setAppreciation} step={0.5} min={-3} max={10} suffix="%" />
            <SliderInput label="Hold Period" value={holdYears} set={setHoldYears} step={1} min={1} max={30} suffix=" yrs" />
            <SliderInput label="Renovation Bonus (Year 1)" value={renovationBonus} set={setRenovationBonus} step={5000} min={-200000} max={200000} prefix="$" fmtFn={(v) => (v / 1000).toFixed(0) + "k"} hint="Adds to or subtracts from home value in year 1" allowDirectInput />
            <SliderInput label="Selling Costs" value={sellingCost} set={setSellingCost} step={0.5} min={0} max={10} suffix="%" />
            <SliderInput label="Closing Costs" value={closingCost} set={setClosingCost} step={0.5} min={0} max={6} suffix="%" />
          </div>

          <h3 className="text-base font-semibold text-stone-700 mt-6 mb-1">Expense Overrides</h3>
          <p className="text-xs text-stone-400 mb-3">Auto-estimated from year built. Slide to override.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
            <SliderInput label="Property Tax Rate" value={propertyTaxRate} set={setPropertyTaxRate} step={0.1} min={0.5} max={2.5} suffix="%" />
            <SliderInput label="Insurance ($/yr)" value={insurance} set={(v) => setManualInsurance(v)} step={200} min={800} max={6000} prefix="$" hint={manualInsurance !== null ? "Manually set" : `Auto: ${fmt(costs.insurance)}`} />
            <SliderInput label="Vacancy Rate" value={vacancyRate} set={setVacancyRate} step={1} min={0} max={15} suffix="%" />
            <SliderInput label="Property Mgmt" value={propertyMgmt} set={setPropertyMgmt} step={1} min={0} max={12} suffix="% of rent" />
            <SliderInput label="Maintenance" value={maintenanceRate} set={(v) => setManualMaint(v)} step={0.25} min={0.5} max={4} suffix="% of value" hint={manualMaint !== null ? "Manually set" : `Auto: ${costs.maintenanceRate}%`} />
            <SliderInput label="CapEx Reserve ($/yr)" value={capexReserve} set={(v) => setManualCapex(v)} step={500} min={0} max={10000} prefix="$" hint={manualCapex !== null ? "Manually set" : `Auto: ${fmt(costs.capexReserve)}`} />
            <SliderInput label="Monthly HOA" value={monthlyHOA} set={setMonthlyHOA} step={25} min={0} max={2000} prefix="$" allowDirectInput />
            <SliderInput label="HOA yearly increase" value={hoaGrowthRate} set={setHoaGrowthRate} step={0.25} min={5} max={7} suffix="%" hint="Annual HOA escalation" />
          </div>
          <button onClick={() => { setManualMaint(null); setManualCapex(null); setManualInsurance(null); }}
            className="mt-3 text-xs text-blue-500 hover:text-blue-700 font-medium">↻ Reset overrides to auto-estimate</button>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4 mb-6">
          <div className="flex flex-wrap gap-3 justify-center text-xs font-medium">
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">≥15% Excellent</span>
            <span className="px-3 py-1 rounded-full bg-green-100 text-green-700">≥12% Strong</span>
            <span className="px-3 py-1 rounded-full bg-lime-100 text-lime-700">≥10% Solid</span>
            <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700">≥8% Acceptable</span>
            <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-600">≥5% Weak</span>
            <span className="px-3 py-1 rounded-full bg-red-100 text-red-600">&lt;5% Poor</span>
          </div>
        </div>

        {/* Price sensitivity */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-stone-700 mb-4">IRR by Purchase Price — {yearBuilt} Build</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left py-2 px-3 font-medium text-stone-500">Price</th>
                  <th className="text-right py-2 px-3 font-medium text-stone-500">Cash In</th>
                  <th className="text-right py-2 px-3 font-medium text-stone-500">Mo. Cash Flow</th>
                  <th className="text-right py-2 px-3 font-medium text-stone-500">Cash-on-Cash</th>
                  <th className="text-right py-2 px-3 font-medium text-stone-500">IRR ({holdYears}yr)</th>
                  <th className="text-center py-2 px-3 font-medium text-stone-500">Rating</th>
                </tr>
              </thead>
              <tbody>
                {sensitivityData.map((row) => (
                  <tr key={row.price} className={`border-b border-stone-100 ${row.price === purchasePrice ? "ring-2 ring-blue-400 ring-inset bg-blue-50" : "hover:bg-stone-50"}`}>
                    <td className="py-2.5 px-3 text-stone-700 font-medium">{fmt(row.price)}{row.price === purchasePrice && <span className="ml-1 text-xs text-blue-500">✦</span>}</td>
                    <td className="py-2.5 px-3 text-right text-stone-600">{fmt(row.downPayment)}</td>
                    <td className={`py-2.5 px-3 text-right ${row.monthlyCashFlow >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(row.monthlyCashFlow)}</td>
                    <td className={`py-2.5 px-3 text-right ${row.cashOnCash >= 0 ? "text-stone-700" : "text-red-500"}`}>{row.cashOnCash.toFixed(1)}%</td>
                    <td className={`py-2.5 px-3 text-right font-bold ${irrColor(row.irr)}`}>{fmtPct(row.irr)}</td>
                    <td className="py-2.5 px-3 text-center"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${irrBg(row.irr)} ${irrColor(row.irr)}`}>{irrLabel(row.irr)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Year by Year */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          <h2 className="text-lg font-semibold text-stone-700 mb-4">{yearBuilt} Build — Year-by-Year</h2>
          <p className="text-xs text-amber-600 mb-2">Maintenance rate increases as home ages during hold period</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left py-2 px-2 font-medium text-stone-500">Yr</th>
                  <th className="text-right py-2 px-2 font-medium text-stone-500">Age</th>
                  <th className="text-right py-2 px-2 font-medium text-stone-500">Maint%</th>
                  <th className="text-right py-2 px-2 font-medium text-stone-500">Rent</th>
                  <th className="text-right py-2 px-2 font-medium text-stone-500">Expenses</th>
                  <th className="text-right py-2 px-2 font-medium text-stone-500">NOI</th>
                  <th className="text-right py-2 px-2 font-medium text-stone-500">Mortgage</th>
                  <th className="text-right py-2 px-2 font-medium text-stone-500">Cash Flow</th>
                  <th className="text-right py-2 px-2 font-medium text-stone-500">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-stone-100 bg-stone-50">
                  <td className="py-2 px-2 text-stone-700 font-medium">0</td>
                  <td colSpan={5} className="py-2 px-2 text-right text-red-600 font-medium">−{fmt(analysis.totalCashInvested)} invested</td>
                  <td className="py-2 px-2 text-right text-stone-600">{fmt(purchasePrice)}</td>
                </tr>
                {analysis.yearlyData.map((row) => (
                  <tr key={row.year} className={`border-b border-stone-100 ${row.year === holdYears ? "bg-emerald-50" : ""}`}>
                    <td className="py-2 px-2 text-stone-700 font-medium">{row.year}</td>
                    <td className="py-2 px-2 text-right text-stone-600">{fmt(row.rent)}</td>
                    <td className="py-2 px-2 text-right text-red-500">−{fmt(row.totalExpenses)}</td>
                    <td className={`py-2 px-2 text-right ${row.noi >= 0 ? "text-stone-700" : "text-red-500"}`}>{fmt(row.noi)}</td>
                    <td className="py-2 px-2 text-right text-red-500">−{fmt(row.mortgage)}</td>
                    <td className={`py-2 px-2 text-right font-medium ${row.cashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(row.cashFlow)}</td>
                    <td className="py-2 px-2 text-right text-stone-600">{fmt(row.propertyValue)}</td>
                  </tr>
                ))}
                {analysis.yearlyData.length > 0 && analysis.yearlyData[analysis.yearlyData.length - 1].saleProceeds != null && (
                  <tr className="bg-emerald-50 font-semibold">
                    <td colSpan={5} className="py-2 px-2 text-right text-stone-600">Sale Proceeds:</td>
                    <td className="py-2 px-2 text-right text-emerald-700">+{fmt(analysis.yearlyData[analysis.yearlyData.length - 1].saleProceeds)}</td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-stone-400 mt-4 text-center">For educational purposes only. Not financial advice.</p>
      </div>
    </div>
  );
}
