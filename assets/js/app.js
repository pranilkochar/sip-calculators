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

// --- Investment Splitter: localStorage-backed state ---
const SPLITTER_STATE_KEY = 'investmentSplitterState_v1';
const SPLITTER_PROFILES_KEY = 'investmentSplitterProfiles_v1';
let splitterState = {
  monthlyAmount: 50000,
  years: 10,
  funds: [] // { id, name, allocationPercent, expectedReturn, schemeCode }
};

function saveSplitterState() {
  try {
    localStorage.setItem(SPLITTER_STATE_KEY, JSON.stringify(splitterState));
  } catch (e) {
    console.error('Failed to save splitter state', e);
  }
}

function loadSplitterState() {
  try {
    const raw = localStorage.getItem(SPLITTER_STATE_KEY);
    if (raw) {
      splitterState = JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load splitter state', e);
  }
}

function saveProfile(profileName) {
  try {
    const profilesRaw = localStorage.getItem(SPLITTER_PROFILES_KEY);
    const profiles = profilesRaw ? JSON.parse(profilesRaw) : {};
    profiles[profileName] = JSON.parse(JSON.stringify(splitterState));
    localStorage.setItem(SPLITTER_PROFILES_KEY, JSON.stringify(profiles));
    alert('Profile saved: ' + profileName);
  } catch (e) {
    console.error('Failed to save profile', e);
    alert('Save failed');
  }
}

function loadProfile(profileName) {
  try {
    const profilesRaw = localStorage.getItem(SPLITTER_PROFILES_KEY);
    const profiles = profilesRaw ? JSON.parse(profilesRaw) : {};
    if (profiles[profileName]) {
      splitterState = profiles[profileName];
      renderFundList();
      document.getElementById('universeMonthlyAmount').value = splitterState.monthlyAmount;
      document.getElementById('universeYears').value = splitterState.years;
      alert('Profile loaded: ' + profileName);
      saveSplitterState();
    } else {
      alert('Profile not found: ' + profileName);
    }
  } catch (e) {
    console.error('Failed to load profile', e);
  }
}

function listProfiles() {
  try {
    const profilesRaw = localStorage.getItem(SPLITTER_PROFILES_KEY);
    const profiles = profilesRaw ? JSON.parse(profilesRaw) : {};
    return Object.keys(profiles);
  } catch (e) {
    return [];
  }
}

// Utility to create unique ids for funds
function uid() {
  return 'f_' + Math.random().toString(36).slice(2, 9);
}

function renderFundList() {
  const container = document.getElementById('fundList');
  container.innerHTML = '';
  splitterState.funds.forEach((fund) => {
    const el = document.createElement('div');
    el.className = 'summary-tile';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.gap = '8px';

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div style="flex:1;">
          <small>Fund</small>
          <strong style="display:block">${fund.name || ''}</strong>
        </div>
        <div style="text-align:right;">
          <small>Alloc %</small>
          <input data-fund-id="${fund.id}" class="fund-alloc-input" type="number" value="${fund.allocationPercent}" min="0" step="0.1" style="width:90px;margin-left:8px;padding:6px;border-radius:8px;border:1px solid rgba(0,0,0,0.06)" />
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <div style="flex:1;">
          <small>Expected return % (auto from 3y CAGR)</small>
          <input data-fund-id="${fund.id}" class="fund-return-input" type="number" value="${fund.expectedReturn || ''}" min="0" step="0.1" style="width:120px;padding:6px;border-radius:8px;border:1px solid rgba(0,0,0,0.06)" />
        </div>
        <div>
          <button data-fund-id="${fund.id}" class="remove-fund-btn" style="background:#ef5d5d;color:#fff;border:0;padding:8px 10px;border-radius:8px;cursor:pointer">Remove</button>
        </div>
      </div>
    `;

    container.appendChild(el);
  });

  // Wire up listeners
  document.querySelectorAll('.fund-alloc-input').forEach((input) => {
    input.addEventListener('change', (e) => {
      const id = e.target.dataset.fundId;
      const val = Number(e.target.value || 0);
      const fund = splitterState.funds.find((f) => f.id === id);
      if (fund) {
        fund.allocationPercent = val;
        saveSplitterState();
      }
    });
  });

  document.querySelectorAll('.fund-return-input').forEach((input) => {
    input.addEventListener('change', (e) => {
      const id = e.target.dataset.fundId;
      const val = Number(e.target.value || 0);
      const fund = splitterState.funds.find((f) => f.id === id);
      if (fund) {
        fund.expectedReturn = val;
        saveSplitterState();
      }
    });
  });

  document.querySelectorAll('.remove-fund-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.fundId;
      splitterState.funds = splitterState.funds.filter((f) => f.id !== id);
      renderFundList();
      saveSplitterState();
    });
  });
}

// Search funds via public API (mfapi.in). This is best-effort and may be blocked by CORS.
async function searchFunds(query) {
  const resultsContainer = document.getElementById('fundSearchResults');
  resultsContainer.innerHTML = 'Searching...';
  try {
    const resp = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`);
    if (!resp.ok) throw new Error('Search failed');
    const data = await resp.json();
    // data is expected to be array of {schemeCode, schemeName}
    if (!Array.isArray(data) || data.length === 0) {
      resultsContainer.innerHTML = '<small>No results</small>';
      return;
    }

    resultsContainer.innerHTML = '';
    data.slice(0, 10).forEach((item) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '6px 0';
      row.innerHTML = `
        <div style="flex:1;min-width:0;">
          <strong style="display:block">${item.schemeName}</strong>
          <small style="color:var(--muted)">Code: ${item.schemeCode}</small>
        </div>
        <div>
          <button data-scheme-code="${item.schemeCode}" class="add-fund-api-btn" style="padding:6px 10px;border-radius:8px;border:0;background:linear-gradient(135deg,var(--primary),var(--primary-2));color:#fff;cursor:pointer">Add</button>
        </div>
      `;
      resultsContainer.appendChild(row);
    });

    // wire add buttons
    document.querySelectorAll('.add-fund-api-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const code = e.target.dataset.schemeCode;
        await addFundFromApi(code);
      });
    });
  } catch (err) {
    console.error('Search failed', err);
    resultsContainer.innerHTML = '<small>Search failed (CORS or network). You can add funds manually.</small>';
  }
}

async function addFundFromApi(schemeCode) {
  const status = document.getElementById('universeStatus');
  status.textContent = 'Fetching NAV history...';
  try {
    const resp = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
    if (!resp.ok) throw new Error('Fetch failed');
    const data = await resp.json();
    // data.data is array with most recent first, each {date, nav}
    const navSeries = data.data;
    if (!Array.isArray(navSeries) || navSeries.length === 0) {
      status.textContent = 'No NAV data for this scheme.';
      return;
    }
    // parse latest and approx 3 years ago
    const latest = parseFloat(navSeries[0].nav.replace(/,/g, ''));
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    let startNav = null;
    let startDate = null;
    for (let i = navSeries.length - 1; i >= 0; i--) {
      const rowDate = new Date(navSeries[i].date.split('-').reverse().join('-'));
      // Note: mfapi dates are in DD-MM-YYYY
      if (rowDate <= threeYearsAgo) {
        startNav = parseFloat(navSeries[i].nav.replace(/,/g, ''));
        startDate = rowDate;
        break;
      }
    }
    if (!startNav) {
      // fallback to oldest available
      const oldest = navSeries[navSeries.length - 1];
      startNav = parseFloat(oldest.nav.replace(/,/g, ''));
      startDate = new Date(oldest.date.split('-').reverse().join('-'));
    }
    const years = (new Date(navSeries[0].date.split('-').reverse().join('-')) - startDate) / (1000 * 60 * 60 * 24 * 365.25);
    const cagr = Math.pow(latest / startNav, 1 / years) - 1;
    const expectedReturn = +(cagr * 100).toFixed(2);

    // create fund entry
    const fund = {
      id: uid(),
      name: data.meta ? data.meta.scheme_name || data.schemeName || ('Scheme ' + schemeCode) : (data.schemeName || ('Scheme ' + schemeCode)),
      allocationPercent: 0,
      expectedReturn: expectedReturn,
      schemeCode
    };

    splitterState.funds.push(fund);
    renderFundList();
    saveSplitterState();
    document.getElementById('fundSearchResults').innerHTML = '';
    document.getElementById('universeStatus').textContent = 'Added fund with 3y CAGR prefilled.';
  } catch (err) {
    console.error('Failed to fetch NAV', err);
    document.getElementById('universeStatus').textContent = 'Failed to fetch NAV (CORS or network). Add manually.';
  }
}

function addFundManually(name) {
  const fund = {
    id: uid(),
    name: name || 'New Fund',
    allocationPercent: 0,
    expectedReturn: 10
  };
  splitterState.funds.push(fund);
  renderFundList();
  saveSplitterState();
}

function normalizeAllocations() {
  const total = splitterState.funds.reduce((s, f) => s + (Number(f.allocationPercent) || 0), 0);
  if (total === 0) return;
  splitterState.funds.forEach((f) => {
    f.allocationPercent = +( (Number(f.allocationPercent) || 0) / total * 100 ).toFixed(2);
  });
  renderFundList();
  saveSplitterState();
}

function roundToNearest500(value) {
  return Math.round(value / 500) * 500;
}

function calculateSplitter() {
  const monthlyAmount = currencyValue(document.getElementById('universeMonthlyAmount').value);
  const years = currencyValue(document.getElementById('universeYears').value);

  // guard
  if (splitterState.funds.length === 0) {
    document.getElementById('universeStatus').textContent = 'Add at least one fund.';
    return;
  }

  // compute raw allocations
  const rawAllocations = splitterState.funds.map((f) => {
    const pct = Number(f.allocationPercent) || 0;
    return {
      id: f.id,
      name: f.name,
      pct,
      rawAmount: (monthlyAmount * pct) / 100,
      expectedReturn: Number(f.expectedReturn) || 10
    };
  });

  const rounded = rawAllocations.map((r) => ({ ...r, roundedAmount: roundToNearest500(r.rawAmount) }));
  const sumRounded = rounded.reduce((s, r) => s + r.roundedAmount, 0);
  let remainder = monthlyAmount - sumRounded;

  // absorb remainder into largest allocation (by pct). If tie, pick first.
  if (remainder !== 0) {
    let largest = rounded.reduce((prev, curr) => (curr.pct > prev.pct ? curr : prev), rounded[0]);
    // find its index
    const idx = rounded.findIndex((r) => r.id === largest.id);
    rounded[idx].roundedAmount += remainder;
    remainder = 0;
  }

  // compute per-fund future values
  const perFundResults = rounded.map((r) => {
    const fv = sipFutureValue(Math.max(0, r.roundedAmount), r.expectedReturn, years);
    return {
      id: r.id,
      name: r.name,
      pct: r.pct,
      monthly: r.roundedAmount,
      expectedReturn: r.expectedReturn,
      futureValue: fv
    };
  });

  const totalFuture = perFundResults.reduce((s, p) => s + p.futureValue, 0);
  document.getElementById('universeTotalValue').textContent = formatCurrency(totalFuture);
  document.getElementById('universeStatus').textContent = '';

  // render summary tiles
  const summaryItems = [
    { label: 'Total invested (monthly)', value: formatCurrency(monthlyAmount) },
    { label: 'Duration (years)', value: `${years} yrs` },
    { label: 'Funds', value: `${perFundResults.length}` },
    { label: 'Projected combined FV', value: formatCurrency(totalFuture) }
  ];
  renderSummary('universeSummary', summaryItems);

  // render per-fund tiles below summary
  const fundTilesContainer = document.getElementById('fundList');
  // after existing list, append results
  const resultsSection = document.createElement('div');
  resultsSection.style.marginTop = '12px';
  resultsSection.innerHTML = perFundResults.map((p) => `
    <div class="summary-tile">
      <small>${p.name} — ${p.pct}%</small>
      <strong>${formatCurrency(p.futureValue)}<span style="display:block;font-size:12px;color:var(--muted)">₹${formatNumber(p.monthly)} / month @ ${p.expectedReturn}%</span></strong>
    </div>
  `).join('');

  // remove old results section if present
  const existingResults = document.getElementById('splitter-results');
  if (existingResults) existingResults.remove();
  resultsSection.id = 'splitter-results';
  fundTilesContainer.appendChild(resultsSection);

  // chart: per-fund future values
  const labels = perFundResults.map((p) => p.name);
  const values = perFundResults.map((p) => Math.round(p.futureValue));
  buildBarChart('universeChart', labels, values, '#7a8cff');
}

function initInvestmentSplitter() {
  // load state
  loadSplitterState();
  // populate inputs
  document.getElementById('universeMonthlyAmount').value = splitterState.monthlyAmount || 50000;
  document.getElementById('universeYears').value = splitterState.years || 10;

  renderFundList();

  // wire buttons
  const searchBtn = document.getElementById('searchFundBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      const q = document.getElementById('fundSearchQuery').value.trim();
      if (!q) return;
      searchFunds(q);
    });
  }

  const normalizeBtn = document.getElementById('normalizeAllocationsBtn');
  if (normalizeBtn) normalizeBtn.addEventListener('click', normalizeAllocations);

  const saveBtn = document.getElementById('saveUniverseProfileBtn');
  if (saveBtn) saveBtn.addEventListener('click', () => {
    const name = prompt('Enter profile name to save:', 'My Profile');
    if (name) saveProfile(name);
  });

  const loadBtn = document.getElementById('loadUniverseProfileBtn');
  if (loadBtn) loadBtn.addEventListener('click', () => {
    const profiles = listProfiles();
    if (profiles.length === 0) {
      alert('No profiles saved');
      return;
    }
    const name = prompt('Enter profile name to load (available: ' + profiles.join(', ') + ')');
    if (name) loadProfile(name);
  });

  const calcBtn = document.getElementById('calculateUniverse');
  if (calcBtn) calcBtn.addEventListener('click', () => {
    // update state inputs
    splitterState.monthlyAmount = Number(document.getElementById('universeMonthlyAmount').value || 0);
    splitterState.years = Number(document.getElementById('universeYears').value || 0);
    saveSplitterState();
    calculateSplitter();
  });

  // provide a quick add manual fund button by double-clicking the fund list area
  const fundListEl = document.getElementById('fundList');
  const quickAdd = document.createElement('div');
  quickAdd.style.marginTop = '8px';
  quickAdd.innerHTML = `<button id="addManualFundBtn" class="secondary-btn" style="padding:8px 10px;border-radius:8px;border:0;cursor:pointer">Add fund manually</button>`;
  fundListEl.parentNode.insertBefore(quickAdd, fundListEl.nextSibling);
  document.getElementById('addManualFundBtn').addEventListener('click', () => {
    const name = prompt('Fund name');
    if (name) addFundManually(name);
  });
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

function init() {
  bindTabSwitching();
  document.getElementById('calculateSip').addEventListener('click', calculateSip);
  document.getElementById('calculateStepup').addEventListener('click', calculateStepup);
  document.getElementById('calculateInflation').addEventListener('click', calculateInflationAdjusted);
  document.getElementById('calculateSwp').addEventListener('click', calculateSwp);

  // initialize investment splitter
  initInvestmentSplitter();

  calculateSip();
  calculateStepup();
  calculateInflationAdjusted();
  calculateSwp();
}

window.addEventListener('DOMContentLoaded', init);
