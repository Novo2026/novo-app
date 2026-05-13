import type { NovoPrintFullPayload } from './novoReportData';

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function kvTable(rows: { label: string; value: string }[]): string {
  return `<table class="kv">${rows
    .map((r) => `<tr><th>${escapeHtml(r.label)}</th><td>${escapeHtml(r.value)}</td></tr>`)
    .join('')}</table>`;
}

function severityClass(s: string): string {
  if (s === 'red') return 'flag-red';
  if (s === 'yellow') return 'flag-yellow';
  return 'flag-green';
}

export function buildNovoFullReportHtml(p: NovoPrintFullPayload): string {
  const debtHead = ['Account', 'Category', 'Current balance', 'Interest rate', 'Minimum payment', 'Status', 'Notes'];
  const debtHeadHtml = debtHead.map((h) => `<th>${escapeHtml(h)}</th>`).join('');

  const debtBody =
    p.debts.rows.length === 0
      ? `<tr><td colspan="7" class="muted">No debts in NOVO.</td></tr>`
      : p.debts.rows
          .map(
            (r) =>
              `<tr class="${r.isHighestRate ? 'row-high-rate' : ''}">${[
                r.account,
                r.category,
                r.balance,
                r.rate,
                r.minimum,
                r.status,
                r.note || '—',
              ]
                .map((c) => `<td>${escapeHtml(c)}</td>`)
                .join('')}</tr>`
          )
          .join('') +
        `<tr class="totals-row"><td><strong>Totals</strong></td><td>—</td><td><strong>${escapeHtml(
          p.debts.totalBalance
        )}</strong></td><td>—</td><td><strong>${escapeHtml(p.debts.totalMinimums)}</strong></td><td>—</td><td>Sum of minimums reflects active debts only; balance sum includes all listed debts.</td></tr>`;

  const homeEquityHtml = p.homeEquity
    ? `
  <section class="report-section">
    <h2>Home equity</h2>
    ${p.homeEquity.addressOnFile ? `<p class="addr"><strong>Address on file:</strong> ${escapeHtml(p.homeEquity.addressOnFile)}</p>` : ''}
    ${kvTable([
      { label: 'Estimated home value', value: p.homeEquity.estimatedHomeValue },
      { label: 'Mortgage balance', value: p.homeEquity.mortgageBalance },
      { label: 'Estimated equity', value: p.homeEquity.estimatedEquity },
      { label: 'HELOC limit', value: p.homeEquity.helocLimit },
      { label: 'HELOC balance', value: p.homeEquity.helocBalance },
      { label: 'HELOC available (limit − balance)', value: p.homeEquity.helocAvailable },
    ])}
  </section>`
    : '';

  const homeReadyHtml = p.homeReady
    ? `
  <section class="report-section">
    <h2>Home Ready analysis</h2>
    <p class="fine-print">Sample purchase aligned with the Home Ready calculator defaults in NOVO.</p>
    ${kvTable([
      { label: 'Target home price', value: p.homeReady.targetHomePrice },
      { label: 'Down payment (sample)', value: p.homeReady.downPayment },
      { label: 'Credit score range (for PMI table)', value: p.homeReady.creditScoreRange },
      { label: 'Front-end DTI (housing ÷ gross)', value: p.homeReady.frontDti },
      { label: 'Back-end DTI (housing + debt mins ÷ gross)', value: p.homeReady.backDti },
      { label: 'Readiness level', value: p.homeReady.readinessLevel },
      { label: 'PMI estimate (illustrative)', value: p.homeReady.pmiEstimate },
    ])}
    <h3 class="subhead">What could improve readiness</h3>
    <ul class="bullets">${p.homeReady.improvementBullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
    <h3 class="subhead">PMI drop-off</h3>
    <p class="body-text">${escapeHtml(p.homeReady.pmiDropoff)}</p>
  </section>`
    : `
  <section class="report-section">
    <h2>Home Ready analysis</h2>
    <p class="muted">Not available — add gross monthly income in your financial profile to generate DTI and readiness.</p>
  </section>`;

  const coachingHtml = p.coaching.flags
    .map(
      (f) =>
        `<div class="coaching-row ${severityClass(f.severity)}"><span class="coaching-dot" aria-hidden="true"></span><span>${escapeHtml(
          f.text
        )}</span></div>`
    )
    .join('');

  const incomeNote = !p.income.hasProfile
    ? '<p class="muted">Save a financial profile in Settings to populate income and surplus fields.</p>'
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NOVO Report — ${escapeHtml(p.header.generatedAt)}</title>
  <style>
    @page { margin: 0.55in; size: letter; }
    * { box-sizing: border-box; }
    html { font-size: 10.5pt; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
      color: #1a202c;
      line-height: 1.42;
      margin: 0;
      padding: 0.25in 0.45in 0.5in;
      background: #fff;
    }
    .report-section {
      page-break-inside: avoid;
      page-break-after: always;
      margin-bottom: 0.25rem;
    }
    .report-section:last-of-type {
      page-break-after: auto;
    }
    .logo {
      font-size: 2rem;
      font-weight: 900;
      letter-spacing: 0.08em;
      color: #FF6B35;
      margin: 0 0 0.1rem;
    }
    .tagline {
      font-size: 0.95rem;
      color: #334155;
      font-weight: 600;
      margin: 0 0 0.75rem;
    }
    .header-meta {
      font-size: 0.88rem;
      color: #475569;
      border-bottom: 2px solid #FF6B35;
      padding-bottom: 0.65rem;
      margin-bottom: 0.5rem;
    }
    .header-meta div { margin: 0.15rem 0; }
    .header-meta strong { color: #0f172a; }
    h2 {
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #1E3A5F;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 0.2rem;
      margin: 0 0 0.5rem;
    }
    h3.subhead {
      font-size: 0.8rem;
      color: #334155;
      margin: 0.75rem 0 0.35rem;
    }
    .kv {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.86rem;
    }
    .kv th {
      text-align: left;
      font-weight: 600;
      color: #475569;
      width: 44%;
      padding: 0.28rem 0.5rem 0.28rem 0;
      vertical-align: top;
      border-bottom: 1px solid #e2e8f0;
    }
    .kv td {
      padding: 0.28rem 0;
      border-bottom: 1px solid #e2e8f0;
      font-variant-numeric: tabular-nums;
    }
    table.data {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.78rem;
      margin-top: 0.35rem;
    }
    table.data th, table.data td {
      border: 1px solid #cbd5e1;
      padding: 0.28rem 0.35rem;
      text-align: left;
      vertical-align: top;
    }
    table.data th {
      background: #f1f5f9;
      font-weight: 600;
      color: #1e293b;
    }
    table.data td:nth-child(3), table.data td:nth-child(5) { text-align: right; font-variant-numeric: tabular-nums; }
    table.data th:nth-child(3), table.data th:nth-child(5) { text-align: right; }
    tr.row-high-rate td { background: #fff7ed; font-weight: 600; }
    tr.totals-row td { background: #f8fafc; font-weight: 600; }
    .fine-print { font-size: 0.75rem; color: #64748b; margin: 0 0 0.4rem; }
    .body-text { font-size: 0.82rem; color: #334155; margin: 0.25rem 0; }
    .addr { font-size: 0.82rem; margin: 0 0 0.5rem; }
    .bullets { margin: 0.25rem 0 0 1rem; padding: 0; font-size: 0.82rem; color: #334155; }
    .bullets li { margin: 0.2rem 0; }
    .muted { color: #64748b; font-style: italic; }
    .strategy-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 0.45rem 0.55rem;
      font-size: 0.82rem;
      margin: 0.5rem 0;
    }
    .coaching-row {
      display: flex;
      align-items: flex-start;
      gap: 0.45rem;
      padding: 0.35rem 0.45rem;
      margin: 0.28rem 0;
      border-radius: 4px;
      font-size: 0.82rem;
      border: 1px solid #e2e8f0;
    }
    .coaching-dot {
      width: 0.55rem;
      height: 0.55rem;
      border-radius: 999px;
      margin-top: 0.28rem;
      flex-shrink: 0;
    }
    .flag-red { background: #fef2f2; border-color: #fecaca; }
    .flag-red .coaching-dot { background: #dc2626; }
    .flag-yellow { background: #fffbeb; border-color: #fde68a; }
    .flag-yellow .coaching-dot { background: #ca8a04; }
    .flag-green { background: #f0fdf4; border-color: #bbf7d0; }
    .flag-green .coaching-dot { background: #16a34a; }
    footer {
      margin-top: 1rem;
      padding-top: 0.65rem;
      border-top: 3px solid #FF6B35;
      font-size: 0.72rem;
      color: #475569;
      line-height: 1.55;
    }
    @media print {
      body { padding: 0; }
      .report-section { page-break-after: always; }
      .report-section:last-of-type { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <section class="report-section">
    <p class="logo">NOVO</p>
    <p class="tagline">Debt Free. Home Ready.</p>
    <div class="header-meta">
      <div><strong>Prepared for</strong> ${escapeHtml(p.header.userName)}</div>
      <div><strong>Member since</strong> ${escapeHtml(p.header.memberSince)}</div>
      <div><strong>Generated</strong> ${escapeHtml(p.header.generatedAt)}</div>
    </div>
  </section>

  <section class="report-section">
    <h2>Income picture</h2>
    ${incomeNote}
    ${kvTable([
      { label: 'Gross monthly income', value: p.income.grossMonthlyIncome },
      { label: 'Net monthly income', value: p.income.netMonthlyIncome },
      { label: 'Gross annual income (×12)', value: p.income.grossAnnualIncome },
      { label: 'Essential expenses (monthly)', value: p.income.essentialExpenses },
      { label: 'Discretionary expenses (monthly)', value: p.income.discretionaryExpenses },
      { label: 'Total debt minimums (active)', value: p.income.totalDebtMinimums },
      { label: 'True monthly surplus', value: p.income.trueMonthlySurplus },
      { label: 'Monthly savings goal', value: p.income.monthlySavingsGoal },
      { label: 'Deployable cash after savings (to debt)', value: p.income.deployableCashAfterSavings },
    ])}
    <p class="fine-print">True surplus = net income − living expenses − active debt minimums (before your savings carve-out). Deployable cash = portion of surplus after savings goal and commitment % applied to extra debt payments, per NOVO cash-flow logic.</p>
  </section>

  <section class="report-section">
    <h2>Debt detail</h2>
    <table class="data">
      <thead><tr>${debtHeadHtml}</tr></thead>
      <tbody>${debtBody}</tbody>
    </table>
    <p class="fine-print">Highest-rate active debt is highlighted for avalanche-style focus.</p>
    <div class="strategy-box">
      <strong>Current payoff strategy</strong><br />
      ${escapeHtml(p.debts.strategySummary)}
    </div>
    ${kvTable([
      { label: 'Estimated months to debt-free', value: p.debts.estimatedMonthsToDebtFree },
      { label: 'Projected debt-free date', value: p.debts.projectedDebtFreeDate },
    ])}
  </section>

  ${homeEquityHtml}

  <section class="report-section">
    <h2>Savings picture</h2>
    ${kvTable([
      { label: 'Current savings balance (all accounts)', value: p.savings.currentTotalBalance },
      { label: 'Monthly savings goal (from profile)', value: p.savings.monthlySavingsGoal },
      { label: 'Emergency fund status', value: p.savings.emergencyFundStatus },
      { label: 'Down payment progress (vs 20% of sample $300k)', value: p.savings.downPaymentProgress },
      { label: 'Months to reach 20% benchmark (illustrative)', value: p.savings.monthsToReachDownPayment },
    ])}
    <p class="fine-print">${escapeHtml(p.savings.savingsFootnote)}</p>
  </section>

  ${homeReadyHtml}

  <section class="report-section">
    <h2>Coaching flags</h2>
    <p class="fine-print">Automated observations from your NOVO data — not loan approval advice.</p>
    ${coachingHtml}
  </section>

  <footer>
    Ben Hulshof | Windmill Mortgage | NMLS #216697 | ben@windmillmortgage.com | 614-327-2213<br />
    Prepared exclusively for ${escapeHtml(p.header.userName)} — Confidential
  </footer>
</body>
</html>`;
}

export function printHtmlDocument(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'NOVO printable report');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const remove = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } finally {
      setTimeout(remove, 500);
    }
  }, 150);
}
