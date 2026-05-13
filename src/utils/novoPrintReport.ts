export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export type HomeReadySnapshotRow = { label: string; value: string };

export interface NovoPrintReportPayload {
  userDisplayName: string;
  generatedAt: string;
  grossMonthlyIncome: string;
  monthlyExpenses: string;
  monthlySurplus: string;
  financialProfileNote: string;
  debtRows: { cells: string[] }[];
  totalStartingDebt: string;
  totalCurrentDebt: string;
  totalPaidOff: string;
  projectedDebtFreeDate: string;
  progressNote: string;
  homeReadyRows: HomeReadySnapshotRow[] | null;
  homeReadyTitle: string;
}

export function buildNovoPrintReportHtml(p: NovoPrintReportPayload): string {
  const debtHeader = ['Account name', 'Category', 'Current balance', 'Interest rate', 'Minimum payment', 'Status'];
  const debtHeadHtml = debtHeader.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const debtBodyHtml =
    p.debtRows.length === 0
      ? `<tr><td colspan="6" class="muted">No debts recorded in NOVO.</td></tr>`
      : p.debtRows
          .map(
            (row) =>
              `<tr>${row.cells.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`
          )
          .join('');

  const homeReadySection =
    p.homeReadyRows && p.homeReadyRows.length > 0
      ? `
    <section class="section">
      <h2>${escapeHtml(p.homeReadyTitle)}</h2>
      <p class="fine-print">${escapeHtml(
        'Uses the same default mortgage scenario as the Home Ready tab (e.g. $300k home, $15k down).'
      )}</p>
      <table class="kv">
        ${p.homeReadyRows.map((r) => `<tr><th>${escapeHtml(r.label)}</th><td>${escapeHtml(r.value)}</td></tr>`).join('')}
      </table>
    </section>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NOVO Report — ${escapeHtml(p.generatedAt)}</title>
  <style>
    @page { margin: 0.6in; size: letter; }
    * { box-sizing: border-box; }
    html { font-size: 11pt; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
      color: #1a1a1a;
      line-height: 1.45;
      margin: 0;
      padding: 0.35in 0.5in 0.6in;
      background: #fff;
    }
    .brand {
      font-size: 1.75rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: #FF6B35;
      margin: 0 0 0.15rem;
    }
    .tagline { font-size: 0.85rem; color: #4a5568; margin: 0 0 1rem; }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1.5rem;
      font-size: 0.9rem;
      color: #2d3748;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 0.75rem;
      margin-bottom: 1.1rem;
    }
    .meta strong { color: #1a202c; }
    h2 {
      font-size: 0.95rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #1E3A5F;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 0.25rem;
      margin: 1.15rem 0 0.65rem;
    }
    .section:first-of-type h2 { margin-top: 0.25rem; }
    table.data {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
    }
    table.data th, table.data td {
      border: 1px solid #cbd5e1;
      padding: 0.35rem 0.45rem;
      text-align: left;
      vertical-align: top;
    }
    table.data th {
      background: #f1f5f9;
      font-weight: 600;
      color: #1e293b;
    }
    table.data td.num, table.data th:nth-child(3), table.data th:nth-child(4), table.data th:nth-child(5) {
      text-align: right;
    }
    table.data td:nth-child(3), table.data td:nth-child(4), table.data td:nth-child(5) {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    table.kv { width: 100%; border-collapse: collapse; font-size: 0.88rem; margin-top: 0.35rem; }
    table.kv th {
      text-align: left;
      font-weight: 600;
      color: #334155;
      width: 42%;
      padding: 0.3rem 0.5rem 0.3rem 0;
      vertical-align: top;
      border-bottom: 1px solid #e2e8f0;
    }
    table.kv td {
      padding: 0.3rem 0;
      border-bottom: 1px solid #e2e8f0;
      font-variant-numeric: tabular-nums;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem 1.25rem;
    }
    @media print {
      body { padding: 0; }
      h2 { break-after: avoid; }
      table.data, table.kv, .section { break-inside: avoid; }
    }
    .muted { color: #64748b; font-style: italic; }
    .fine-print { font-size: 0.78rem; color: #64748b; margin: 0 0 0.5rem; }
    footer {
      margin-top: 1.5rem;
      padding-top: 0.75rem;
      border-top: 2px solid #FF6B35;
      font-size: 0.78rem;
      color: #475569;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <header>
    <p class="brand">NOVO</p>
    <p class="tagline">Debt Free. Home Ready.</p>
    <div class="meta">
      <span><strong>Prepared for</strong> ${escapeHtml(p.userDisplayName)}</span>
      <span><strong>Generated</strong> ${escapeHtml(p.generatedAt)}</span>
    </div>
  </header>

  <section class="section">
    <h2>Financial profile</h2>
    <div class="grid-2">
      <table class="kv">
        <tr><th>Gross monthly income</th><td>${escapeHtml(p.grossMonthlyIncome)}</td></tr>
        <tr><th>Monthly expenses</th><td>${escapeHtml(p.monthlyExpenses)}</td></tr>
        <tr><th>Monthly surplus</th><td>${escapeHtml(p.monthlySurplus)}</td></tr>
      </table>
    </div>
    <p class="fine-print">${escapeHtml(p.financialProfileNote)}</p>
  </section>

  <section class="section">
    <h2>Debt summary</h2>
    <table class="data">
      <thead><tr>${debtHeadHtml}</tr></thead>
      <tbody>${debtBodyHtml}</tbody>
    </table>
  </section>

  <section class="section">
    <h2>Progress summary</h2>
    <table class="kv">
      <tr><th>Total starting debt</th><td>${escapeHtml(p.totalStartingDebt)}</td></tr>
      <tr><th>Current debt</th><td>${escapeHtml(p.totalCurrentDebt)}</td></tr>
      <tr><th>Amount paid off</th><td>${escapeHtml(p.totalPaidOff)}</td></tr>
      <tr><th>Projected debt-free date</th><td>${escapeHtml(p.projectedDebtFreeDate)}</td></tr>
    </table>
    <p class="fine-print">${escapeHtml(p.progressNote)}</p>
  </section>
  ${homeReadySection}
  <footer>
    Ben Hulshof | Windmill Mortgage | NMLS #216697 | ben@windmillmortgage.com | 614-327-2213
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
