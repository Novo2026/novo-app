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
  if (s === 'red') return 'coaching coaching--warn';
  if (s === 'yellow') return 'coaching coaching--caution';
  return 'coaching coaching--win';
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
        )}</strong></td><td>—</td><td><strong>${escapeHtml(p.debts.totalMinimums)}</strong></td><td>—</td><td class="totals-note">Active minimums; balance sum includes all listed debts.</td></tr>`;

  const incomeNote = !p.income.hasProfile
    ? '<p class="muted micro">Save a financial profile in Settings to populate income fields.</p>'
    : '';

  const homeEquityCol = p.homeEquity
    ? `<div class="col-panel">
    <h2 class="section-title">Home equity</h2>
    ${p.homeEquity.addressOnFile ? `<p class="micro addr"><span class="lbl">Address on file</span> ${escapeHtml(p.homeEquity.addressOnFile)}</p>` : ''}
    ${kvTable([
      { label: 'Est. home value', value: p.homeEquity.estimatedHomeValue },
      { label: 'Mortgage balance', value: p.homeEquity.mortgageBalance },
      { label: 'Est. equity', value: p.homeEquity.estimatedEquity },
      { label: 'HELOC limit', value: p.homeEquity.helocLimit },
      { label: 'HELOC balance', value: p.homeEquity.helocBalance },
      { label: 'HELOC available', value: p.homeEquity.helocAvailable },
    ])}
  </div>`
    : `<div class="col-panel">
    <h2 class="section-title">Home equity</h2>
    <p class="muted micro">Not applicable — you have not marked “own a home” with equity details in NOVO, or data is incomplete.</p>
  </div>`;

  const homeReadyCol = p.homeReady
    ? `<div class="col-panel">
    <h2 class="section-title">Home Ready analysis</h2>
    <p class="muted micro">Sample scenario (Home Ready defaults in app).</p>
    ${kvTable([
      { label: 'Target home price', value: p.homeReady.targetHomePrice },
      { label: 'Down payment (sample)', value: p.homeReady.downPayment },
      { label: 'Credit score range', value: p.homeReady.creditScoreRange },
      { label: 'Front-end DTI', value: p.homeReady.frontDti },
      { label: 'Back-end DTI', value: p.homeReady.backDti },
      { label: 'Readiness level', value: p.homeReady.readinessLevel },
      { label: 'PMI estimate', value: p.homeReady.pmiEstimate },
    ])}
    <p class="subhead">Improve readiness</p>
    <ul class="bullets">${p.homeReady.improvementBullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
    <p class="subhead">PMI drop-off</p>
    <p class="micro body-tight">${escapeHtml(p.homeReady.pmiDropoff)}</p>
  </div>`
    : `<div class="col-panel">
    <h2 class="section-title">Home Ready analysis</h2>
    <p class="muted micro">Add gross monthly income to your financial profile to generate DTI and readiness.</p>
  </div>`;

  const coachingHtml = p.coaching.flags
    .map((f) => `<div class="${severityClass(f.severity)}">${escapeHtml(f.text)}</div>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NOVO Report — ${escapeHtml(p.header.generatedAt)}</title>
  <style>
    @page { margin: 0.42in 0.48in; size: letter; }

    :root {
      --novo-orange: #FF6B35;
      --navy: #1E3A5F;
      --body-pt: 9.5pt;
      --section-pt: 11pt;
      --warn: #ef4444;
      --caution: #f59e0b;
      --win: #10b981;
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #1e293b;
      font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
      font-size: var(--body-pt);
      line-height: 1.32;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .doc {
      max-width: 7.5in;
      margin: 0 auto;
    }

    /* —— Main header —— */
    .doc-header {
      padding-bottom: 0.35rem;
    }

    .logo {
      margin: 0 0 0.06in 0;
      font-size: 22pt;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: #FF6B35;
      line-height: 1;
    }

    .tagline {
      margin: 0.06in 0 0.12in 0;
      font-size: 9.5pt;
      font-weight: 600;
      color: var(--navy);
      letter-spacing: 0.02em;
    }

    .header-meta {
      font-size: 9.5pt;
      color: #475569;
    }

    .header-meta div { margin: 0.06rem 0; }
    .header-meta strong { color: #0f172a; font-weight: 600; }

    .header-accent-rule {
      height: 1px;
      background: #FF6B35;
      margin: 0.14in 0 0.16in 0;
      border: none;
    }

    /* —— Two-column rows —— */
    .row-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.12in 0.2in;
      align-items: start;
      margin-bottom: 0.14in;
    }

    .col-panel { min-width: 0; }

    /* —— Section titles —— */
    .section-title {
      margin: 0 0 0.1in 0;
      padding: 0.06in 0 0.06in 0.12in;
      font-size: var(--section-pt);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--navy);
      border-left: 4px solid #FF6B35;
      line-height: 1.2;
    }

    .subhead {
      margin: 0.1in 0 0.04in 0;
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--navy);
    }

    .micro { font-size: 8.25pt; line-height: 1.3; }
    .body-tight { margin: 0.04in 0 0 0; }
    .addr .lbl { font-weight: 600; color: #475569; }

    /* —— Key-value tables —— */
    .kv {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--body-pt);
    }

    .kv th {
      text-align: left;
      font-weight: 600;
      color: #475569;
      width: 46%;
      padding: 0.07rem 0.2rem 0.07rem 0;
      vertical-align: top;
      border-bottom: 1px solid #e5e7eb;
    }

    .kv td {
      padding: 0.07rem 0;
      vertical-align: top;
      border-bottom: 1px solid #e5e7eb;
      font-variant-numeric: tabular-nums;
      text-align: right;
    }

    .bullets {
      margin: 0.04in 0 0.06in 0.18in;
      padding: 0;
      font-size: 8.5pt;
      color: #334155;
    }

    .bullets li { margin: 0.06rem 0; }

    .muted { color: #64748b; font-style: italic; }

    /* —— Debt (full width) —— */
    .debt-section {
      margin-top: 0.06in;
      page-break-after: always;
    }

    table.data {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.75pt;
      margin: 0.06in 0 0.08in 0;
    }

    table.data th,
    table.data td {
      border: 1px solid #cbd5e1;
      padding: 0.12rem 0.22rem;
      text-align: left;
      vertical-align: top;
    }

    table.data th {
      background: #f8fafc;
      font-weight: 600;
      color: var(--navy);
    }

    table.data td:nth-child(3),
    table.data td:nth-child(5) {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    table.data th:nth-child(3),
    table.data th:nth-child(5) { text-align: right; }

    tr.row-high-rate td:first-child {
      border-left: 3px solid #FF6B35;
    }

    tr.row-high-rate td {
      background: transparent;
      font-weight: 600;
    }

    tr.totals-row td {
      background: #f8fafc;
      font-weight: 600;
      font-size: 9pt;
    }

    .totals-note { font-weight: 400 !important; font-size: 8pt !important; text-align: left !important; }

    .strategy-box {
      margin: 0.08in 0 0.06in 0;
      padding: 0.1in 0.12in;
      border: 1px solid #e2e8f0;
      background: #fafafa;
      font-size: 9pt;
    }

    .strategy-box strong { color: var(--navy); }

    /* —— Closing: coaching + footer (last page) —— */
    .closing-block {
      margin-top: 0.08in;
      page-break-inside: avoid;
    }

    .coaching {
      margin: 0.12rem 0;
      padding: 0.14rem 0.14rem 0.14rem 0.38rem;
      border: none;
      border-left: 4px solid #cbd5e1;
      background: transparent;
      font-size: var(--body-pt);
      line-height: 1.35;
    }

    .coaching--warn { border-left-color: #ef4444; }
    .coaching--caution { border-left-color: #f59e0b; }
    .coaching--win { border-left-color: #10b981; }

    footer {
      margin-top: 0.16in;
      padding-top: 0.1in;
      border-top: 1px solid #FF6B35;
      font-size: 8.25pt;
      color: #475569;
      line-height: 1.45;
    }
  </style>
</head>
<body>
  <div class="doc">
    <header class="doc-header">
      <p class="logo">NOVO</p>
      <p class="tagline">Debt Free. Home Ready.</p>
      <div class="header-meta">
        <div><strong>Prepared for</strong> ${escapeHtml(p.header.userName)}</div>
        <div><strong>Member since</strong> ${escapeHtml(p.header.memberSince)}</div>
        <div><strong>Generated</strong> ${escapeHtml(p.header.generatedAt)}</div>
      </div>
    </header>
    <div class="header-accent-rule" role="presentation"></div>

    <div class="row-2col">
      <div class="col-panel">
        <h2 class="section-title">Income picture</h2>
        ${incomeNote}
        ${kvTable([
          { label: 'Gross monthly income', value: p.income.grossMonthlyIncome },
          { label: 'Net monthly income', value: p.income.netMonthlyIncome },
          { label: 'Gross annual income (×12)', value: p.income.grossAnnualIncome },
          { label: 'Essential expenses', value: p.income.essentialExpenses },
          { label: 'Discretionary expenses', value: p.income.discretionaryExpenses },
          { label: 'Total debt minimums (active)', value: p.income.totalDebtMinimums },
          { label: 'True monthly surplus', value: p.income.trueMonthlySurplus },
          { label: 'Monthly savings goal', value: p.income.monthlySavingsGoal },
          { label: 'Deployable cash (to debt)', value: p.income.deployableCashAfterSavings },
        ])}
        <p class="muted micro">Surplus = net − living expenses − active minimums. Deployable = after savings carve-out and commitment % per NOVO.</p>
      </div>
      <div class="col-panel">
        <h2 class="section-title">Savings picture</h2>
        ${kvTable([
          { label: 'Current savings (all accounts)', value: p.savings.currentTotalBalance },
          { label: 'Monthly savings goal', value: p.savings.monthlySavingsGoal },
          { label: 'Emergency fund status', value: p.savings.emergencyFundStatus },
          { label: 'Down payment progress', value: p.savings.downPaymentProgress },
          { label: 'Months to 20% benchmark', value: p.savings.monthsToReachDownPayment },
        ])}
        <p class="muted micro">${escapeHtml(p.savings.savingsFootnote)}</p>
      </div>
    </div>

    <div class="row-2col">
      ${homeEquityCol}
      ${homeReadyCol}
    </div>

    <section class="debt-section">
      <h2 class="section-title">Debt detail</h2>
      <table class="data">
        <thead><tr>${debtHeadHtml}</tr></thead>
        <tbody>${debtBody}</tbody>
      </table>
      <p class="muted micro">Highlighted row = highest active rate (avalanche focus).</p>
      <div class="strategy-box">
        <strong>Payoff strategy</strong> — ${escapeHtml(p.debts.strategySummary)}
      </div>
      ${kvTable([
        { label: 'Est. months to debt-free', value: p.debts.estimatedMonthsToDebtFree },
        { label: 'Projected debt-free date', value: p.debts.projectedDebtFreeDate },
      ])}
    </section>

    <div class="closing-block">
      <h2 class="section-title">Coaching flags</h2>
      <p class="muted micro">Automated observations — not loan approval advice.</p>
      ${coachingHtml}
      <footer>
        Ben Hulshof | Windmill Mortgage | NMLS #216697 | ben@windmillmortgage.com | 614-327-2213<br />
        Prepared exclusively for ${escapeHtml(p.header.userName)} — Confidential
      </footer>
    </div>
  </div>
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
