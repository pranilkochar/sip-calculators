const CURRENCY_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

const formatCurrency = (value) => CURRENCY_FORMATTER.format(value || 0);
const formatNumber = (value) => new Intl.NumberFormat('en-IN').format(Math.round(value || 0));

const currencyValue = (raw) => Number(raw || 0);

function toMonthlyRate(annualPercent) {
  return (annualPercent / 100) / 12;
}

function sipFutureValue(monthlyInvestment, annualReturn, years) {
  const monthlyRate = toMonthlyRate(annualReturn);
  const months = years * 12;

  if (monthlyRate === 0) {
    return monthlyInvestment * months;
  }

  return monthlyInvestment * (((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate));
}

function sipFutureValueWithInflation(monthlyInvestment, annualReturn, years, inflationRate) {
  const nominal = sipFutureValue(monthlyInvestment, annualReturn, years);
  const realRate = (1 + annualReturn / 100) / (1 + inflationRate / 100) - 1;
  const effectiveFuture = nominal / Math.pow(1 + inflationRate / 100, years);
  return {
    nominalFuture: nominal,
    realFuture: effectiveFuture,
    realRate
  };
}

function stepUpSipFutureValue(initialMonthlyInvestment, annualStepUp, annualReturn, years) {
  const months = years * 12;
  const monthlyRate = toMonthlyRate(annualReturn);
  let total = 0;
  let currentMonthly = initialMonthlyInvestment;

  for (let month = 1; month <= months; month++) {
    const yearIndex = Math.floor((month - 1) / 12);
    if (month === 1 || (month - 1) % 12 === 0) {
      currentMonthly = initialMonthlyInvestment * Math.pow(1 + annualStepUp / 100, yearIndex);
    }

    const futureValueFactor = Math.pow(1 + monthlyRate, months - month + 1);
    total += currentMonthly * futureValueFactor;
  }

  return total;
}

function simulateSwp(corpus, monthlyWithdrawal, annualReturn, inflationRate, yearsToProject = 30) {
  let balance = corpus;
  let totalWithdrawn = 0;
  let totalInterest = 0;
  const monthlyRate = (annualReturn / 100) / 12;
  const monthlyInflation = (inflationRate / 100) / 12;
  const steps = yearsToProject * 12;
  let lastYear = 0;

  for (let month = 1; month <= steps; month++) {
    const adjustedWithdrawal = monthlyWithdrawal * Math.pow(1 + monthlyInflation, month - 1);

    if (balance <= 0) break;

    balance = balance * (1 + monthlyRate);
    const withdrawal = Math.min(adjustedWithdrawal, balance);
    balance -= withdrawal;
    totalWithdrawn += withdrawal;
    totalInterest += balance * 0;

    if (month % 12 === 0) {
      lastYear = month / 12;
    }
  }

  return {
    finalBalance: Math.max(balance, 0),
    totalWithdrawn,
    monthsProjected: Math.min(steps, steps),
    lastedYears: lastYear
  };
}

function renderSummary(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = items
    .map(
      (item) => `
        <div class="summary-tile">
          <small>${item.label}</small>
          <strong>${item.value}</strong>
        </div>
      `
    )
    .join('');
}

function buildBarChart(canvasId, labels, values, color) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  if (window[`${canvasId}ChartInstance`]) {
    window[`${canvasId}ChartInstance`].destroy();
  }

  window[`${canvasId}ChartInstance`] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: color,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          ticks: {
            callback: (value) => '₹' + formatNumber(value)
          }
        }
      }
    }
  });
}

function calculateSip() {
  const monthlyInvestment = currencyValue(document.getElementById('sipMonthlyInvestment').value);
  const annualReturn = currencyValue(document.getElementById('sipAnnualReturn').value);
  const years = currencyValue(document.getElementById('sipYears').value);
  const inflationRate = currencyValue(document.getElementById('sipInflation').value);

  const result = sipFutureValueWithInflation(monthlyInvestment, annualReturn, years, inflationRate);

  document.getElementById('sipFutureValue').textContent = formatCurrency(result.nominalFuture);

  renderSummary('sipSummary', [
    { label: 'Invested', value: formatCurrency(monthlyInvestment * years * 12) },
    { label: 'Wealth gained', value: formatCurrency(result.nominalFuture - monthlyInvestment * years * 12) },
    { label: 'Real value', value: formatCurrency(result.realFuture) },
    { label: 'Real return', value: `${((result.realRate) * 100).toFixed(2)}%` }
  ]);

  const labels = Array.from({ length: years + 1 }, (_, i) => i === 0 ? 'Start' : `Y${i}`);
  const values = [0];
  let running = 0;
  for (let year = 1; year <= years; year++) {
    running = sipFutureValue(monthlyInvestment, annualReturn, year);
    values.push(running);
  }

  buildBarChart('sipChart', labels, values, '#5b6cf6');
}

function calculateStepup() {
  const initialMonthlyInvestment = currencyValue(document.getElementById('stepupMonthlyInvestment').value);
  const annualStepUp = currencyValue(document.getElementById('stepupRate').value);
  const annualReturn = currencyValue(document.getElementById('stepupAnnualReturn').value);
  const years = currencyValue(document.getElementById('stepupYears').value);

  const futureValue = stepUpSipFutureValue(initialMonthlyInvestment, annualStepUp, annualReturn, years);

  document.getElementById('stepupFutureValue').textContent = formatCurrency(futureValue);

  const totalInvested = [];
  let total = 0;
  for (let year = 1; year <= years; year++) {
    const yearlyContribution = initialMonthlyInvestment * Math.pow(1 + annualStepUp / 100, year - 1) * 12;
    total += yearlyContribution;
    totalInvested.push(total);
  }

  renderSummary('stepupSummary', [
    { label: 'Invested', value: formatCurrency(total) },
    { label: 'Gain', value: formatCurrency(futureValue - total) },
    { label: 'Monthly final SIP', value: formatCurrency(initialMonthlyInvestment * Math.pow(1 + annualStepUp / 100, years - 1)) },
    { label: 'Growth', value: `${(((futureValue / total) - 1) * 100).toFixed(2)}%` }
  ]);

  const labels = Array.from({ length: years + 1 }, (_, i) => i === 0 ? 'Start' : `Y${i}`);
  const values = [0];
  for (let year = 1; year <= years; year++) {
    values.push(stepUpSipFutureValue(initialMonthlyInvestment, annualStepUp, annualReturn, year));
  }

  buildBarChart('stepupChart', labels, values, '#17b38b');
}

function calculateInflationAdjusted() {
  const monthlyInvestment = currencyValue(document.getElementById('inflationMonthlyInvestment').value);
  const nominalReturn = currencyValue(document.getElementById('inflationNominalReturn').value);
  const inflationRate = currencyValue(document.getElementById('inflationRate').value);
  const years = currencyValue(document.getElementById('inflationYears').value);

  const result = sipFutureValueWithInflation(monthlyInvestment, nominalReturn, years, inflationRate);
  document.getElementById('inflationFutureValue').textContent = formatCurrency(result.realFuture);

  renderSummary('inflationSummary', [
    { label: 'Nominal future', value: formatCurrency(result.nominalFuture) },
    { label: 'Real future', value: formatCurrency(result.realFuture) },
    { label: 'Real return', value: `${((result.realRate) * 100).toFixed(2)}%` },
    { label: 'Total invested', value: formatCurrency(monthlyInvestment * years * 12) }
  ]);

  const labels = Array.from({ length: years + 1 }, (_, i) => i === 0 ? 'Start' : `Y${i}`);
  const values = [0];
  for (let year = 1; year <= years; year++) {
    values.push(sipFutureValueWithInflation(monthlyInvestment, nominalReturn, year, inflationRate).realFuture);
  }

  buildBarChart('inflationChart', labels, values, '#ffb648');
}

function calculateSwp() {
  const corpus = currencyValue(document.getElementById('swpCorpus').value);
  const withdrawal = currencyValue(document.getElementById('swpWithdrawal').value);
  const annualReturn = currencyValue(document.getElementById('swpAnnualReturn').value);
  const inflationRate = currencyValue(document.getElementById('swpInflation').value);

  const result = simulateSwp(corpus, withdrawal, annualReturn, inflationRate, 30);
  document.getElementById('swpFinalValue').textContent = formatCurrency(result.finalBalance);

  renderSummary('swpSummary', [
    { label: 'Total withdrawn', value: formatCurrency(result.totalWithdrawn) },
    { label: 'Final corpus', value: formatCurrency(result.finalBalance) },
    { label: 'Years lasted', value: `${result.lastedYears.toFixed(1)} yrs` },
    { label: 'Monthly withdrawal', value: formatCurrency(withdrawal) }
  ]);

  const labels = Array.from({ length: 31 }, (_, i) => i === 0 ? 'Start' : `Y${i}`);
  const values = [corpus];
  let balance = corpus;
  const monthlyRate = (annualReturn / 100) / 12;
  const monthlyInflation = (inflationRate / 100) / 12;

  for (let year = 1; year <= 30; year++) {
    for (let month = 1; month <= 12; month++) {
      const adjustedWithdrawal = withdrawal * Math.pow(1 + monthlyInflation, (year - 1) * 12 + month - 1);
      if (balance <= 0) break;
      balance = balance * (1 + monthlyRate);
      balance -= Math.min(adjustedWithdrawal, balance);
    }
    values.push(Math.max(balance, 0));
  }

  buildBarChart('swpChart', labels, values, '#ef5d5d');
}

function bindTabSwitching() {
  const tabs = document.querySelectorAll('.card');
  const panels = document.querySelectorAll('.panel');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((item) => item.classList.toggle('active', item === tab));
      panels.forEach((panel) => {
        const isMatch = panel.id === `${tab.dataset.tab}-panel`;
        panel.classList.toggle('active-panel', isMatch);
      });
    });
  });
}

function init() {
  bindTabSwitching();
  document.getElementById('calculateSip').addEventListener('click', calculateSip);
  document.getElementById('calculateStepup').addEventListener('click', calculateStepup);
  document.getElementById('calculateInflation').addEventListener('click', calculateInflationAdjusted);
  document.getElementById('calculateSwp').addEventListener('click', calculateSwp);

  calculateSip();
  calculateStepup();
  calculateInflationAdjusted();
  calculateSwp();
}

window.addEventListener('DOMContentLoaded', init);


































































































































