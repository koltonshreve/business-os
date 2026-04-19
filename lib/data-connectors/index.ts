import type { UnifiedBusinessData, GoogleSheetsConfig, CSVUpload } from '../../types';

// ─── Google Sheets Connector ──────────────────────────────────────────────────

export async function connectGoogleSheets(
  config: GoogleSheetsConfig
): Promise<UnifiedBusinessData> {
  const baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  const headers = { Authorization: `Bearer ${config.accessToken}` };

  async function getSheetData(sheetName: string): Promise<string[][]> {
    const url = `${baseUrl}/${config.spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);
    const data = await res.json() as { values?: string[][] };
    return data.values ?? [];
  }

  const [revenueRows, costRows, customerRows] = await Promise.all([
    getSheetData(config.sheets.revenue),
    getSheetData(config.sheets.costs),
    getSheetData(config.sheets.customers),
  ]);

  const revenue = parseRevenueSheet(revenueRows);
  const costs = parseCostSheet(costRows);
  const customers = parseCustomerSheet(customerRows);

  return {
    revenue,
    costs,
    customers,
    operations: {},
    metadata: {
      sources: ['Google Sheets'],
      asOf: new Date().toISOString(),
      coveragePeriod: detectCoveragePeriod(revenue),
      completeness: calculateCompleteness({ revenue, costs, customers }),
      warnings: detectWarnings({ revenue, costs, customers }),
    },
  };
}

// ─── CSV Connector ────────────────────────────────────────────────────────────

export function parseCSVUpload(upload: CSVUpload): Partial<UnifiedBusinessData> {
  const rows = parseCSV(upload.content);
  if (!rows.length) throw new Error('Empty CSV file');

  switch (upload.type) {
    case 'revenue':    return { revenue: parseRevenueCSV(rows) };
    case 'costs':      return { costs: parseCostCSV(rows) };
    case 'customers':  return { customers: parseCustomerCSV(rows) };
    case 'operations': return { operations: parseOperationsCSV(rows) };
    case 'pipeline':   return { pipeline: parsePipelineDeals(rows), operations: parsePipelineSummary(rows) };
    case 'payroll':    return { payrollByDept: parsePayrollDepts(rows), operations: parsePayrollCSV(rows), costs: parsePayrollCostCSV(rows) };
    case 'cashflow':   return { cashFlow: parseCashFlowData(rows) };
    case 'ar_aging':      return { arAging: parseARAgingData(rows) };
    case 'transactions':  return { transactions: parseTransactionsData(rows) };
    default: throw new Error(`Unknown upload type: ${upload.type}`);
  }
}

export function mergeDataSources(
  sources: Partial<UnifiedBusinessData>[]
): UnifiedBusinessData {
  const merged: UnifiedBusinessData = {
    revenue: { total: 0, byPeriod: [], currency: 'USD' },
    costs: { totalCOGS: 0, totalOpEx: 0, byCategory: [] },
    customers: { totalCount: 0, newThisPeriod: 0, churned: 0, topCustomers: [], avgRevenuePerCustomer: 0 },
    operations: {},
    metadata: {
      sources: [],
      asOf: new Date().toISOString(),
      coveragePeriod: { start: '', end: '' },
      completeness: 0,
      warnings: [],
    },
  };

  for (const source of sources) {
    if (source.revenue) merged.revenue = { ...merged.revenue, ...source.revenue };
    if (source.costs) {
      // Merge cost categories (replace if same category name, append new ones)
      const existing = merged.costs.byCategory;
      const incoming = source.costs.byCategory ?? [];
      const merged_cats = [...existing];
      for (const cat of incoming) {
        const idx = merged_cats.findIndex(c => c.category === cat.category);
        if (idx >= 0) merged_cats[idx] = cat; else merged_cats.push(cat);
      }
      merged.costs = { ...merged.costs, ...source.costs, byCategory: merged_cats };
    }
    if (source.customers) merged.customers = { ...merged.customers, ...source.customers };
    if (source.operations) merged.operations = { ...merged.operations, ...source.operations };
    if (source.metadata) merged.metadata.sources.push(...(source.metadata.sources || []));
    if (source.pipeline) merged.pipeline = source.pipeline;
    if (source.payrollByDept) merged.payrollByDept = source.payrollByDept;
    if (source.cashFlow) merged.cashFlow = source.cashFlow;
    if (source.arAging) merged.arAging = source.arAging;
    if (source.transactions) merged.transactions = source.transactions;
  }

  merged.metadata.completeness = calculateCompleteness(merged);
  merged.metadata.warnings = detectWarnings(merged);

  return merged;
}

// ─── Sheet Parsers ────────────────────────────────────────────────────────────

function parseRevenueSheet(rows: string[][]): UnifiedBusinessData['revenue'] {
  if (!rows.length) return { total: 0, byPeriod: [], currency: 'USD' };

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const data = rows.slice(1);

  const periodIdx = headers.findIndex(h => h.includes('period') || h.includes('date') || h.includes('month') || h.includes('week'));
  const revenueIdx = headers.findIndex(h => h.includes('revenue') || h.includes('sales'));
  const cogsIdx = headers.findIndex(h => h.includes('cogs') || h.includes('cost of'));

  if (revenueIdx === -1) return { total: 0, byPeriod: [], currency: 'USD' };

  const byPeriod = data
    .filter(row => row[revenueIdx] && !isNaN(parseNum(row[revenueIdx])))
    .map(row => ({
      period: periodIdx >= 0 ? row[periodIdx] : 'Unknown',
      periodType: detectPeriodType(periodIdx >= 0 ? row[periodIdx] : '') as 'weekly' | 'monthly' | 'quarterly' | 'annual',
      revenue: parseNum(row[revenueIdx]),
      cogs: cogsIdx >= 0 ? parseNum(row[cogsIdx]) : undefined,
      grossProfit: cogsIdx >= 0 ? parseNum(row[revenueIdx]) - parseNum(row[cogsIdx]) : undefined,
    }));

  const total = byPeriod.length > 0
    ? byPeriod[byPeriod.length - 1].revenue // Most recent period
    : 0;

  return { total, byPeriod, currency: 'USD' };
}

function parseCostSheet(rows: string[][]): UnifiedBusinessData['costs'] {
  if (!rows.length) return { totalCOGS: 0, totalOpEx: 0, byCategory: [] };

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const data = rows.slice(1);

  const categoryIdx = headers.findIndex(h => h.includes('category') || h.includes('type'));
  const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('cost') || h.includes('expense'));

  if (amountIdx === -1) return { totalCOGS: 0, totalOpEx: 0, byCategory: [] };

  const categories = data
    .filter(row => row[amountIdx])
    .map(row => ({
      category: categoryIdx >= 0 ? row[categoryIdx] : 'Unknown',
      amount: parseNum(row[amountIdx]),
      percentOfRevenue: 0, // Calculated after
    }));

  const totalCOGS = categories
    .filter(c => isCOGS(c.category))
    .reduce((sum, c) => sum + c.amount, 0);

  const totalOpEx = categories
    .filter(c => !isCOGS(c.category))
    .reduce((sum, c) => sum + c.amount, 0);

  return { totalCOGS, totalOpEx, byCategory: categories };
}

function parseCustomerSheet(rows: string[][]): UnifiedBusinessData['customers'] {
  if (!rows.length) return { totalCount: 0, newThisPeriod: 0, churned: 0, topCustomers: [], avgRevenuePerCustomer: 0 };

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const data = rows.slice(1).filter(row => row.some(cell => cell.trim()));

  const nameIdx = headers.findIndex(h => h.includes('customer') || h.includes('name') || h.includes('client'));
  const revenueIdx = headers.findIndex(h => h.includes('revenue') || h.includes('amount') || h.includes('sales'));
  const statusIdx = headers.findIndex(h => h.includes('status') || h.includes('type'));

  const customers = data
    .filter(row => nameIdx >= 0 && row[nameIdx])
    .map(row => ({
      id: row[nameIdx]?.toLowerCase().replace(/\s+/g, '-') ?? 'unknown',
      name: row[nameIdx] ?? 'Unknown',
      revenue: revenueIdx >= 0 ? parseNum(row[revenueIdx]) : 0,
      status: statusIdx >= 0 ? row[statusIdx]?.toLowerCase() : 'active',
    }));

  const totalRevenue = customers.reduce((s, c) => s + c.revenue, 0);
  const topCustomers = customers
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map(c => ({
      ...c,
      percentOfTotal: totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0,
    }));

  const newThisPeriod = customers.filter(c => c.status === 'new').length;
  const churned = customers.filter(c => c.status === 'churned' || c.status === 'inactive').length;

  return {
    totalCount: customers.length,
    newThisPeriod,
    churned,
    topCustomers,
    avgRevenuePerCustomer: customers.length > 0 ? totalRevenue / customers.length : 0,
  };
}

// ─── CSV Parsers ──────────────────────────────────────────────────────────────

function parseRevenueCSV(rows: string[][]): UnifiedBusinessData['revenue'] {
  return parseRevenueSheet(rows);
}

function parseCostCSV(rows: string[][]): UnifiedBusinessData['costs'] {
  return parseCostSheet(rows);
}

function parseCustomerCSV(rows: string[][]): UnifiedBusinessData['customers'] {
  return parseCustomerSheet(rows);
}

function parseOperationsCSV(rows: string[][]): UnifiedBusinessData['operations'] {
  const headers = rows[0]?.map(h => h.toLowerCase().trim()) ?? [];
  const data = rows[1] ?? [];

  const result: UnifiedBusinessData['operations'] = {};

  const headcountIdx = headers.findIndex(h => h.includes('headcount') || h.includes('employee'));
  if (headcountIdx >= 0) result.headcount = parseNum(data[headcountIdx]);

  const utilizationIdx = headers.findIndex(h => h.includes('utilization'));
  if (utilizationIdx >= 0) result.utilizationRate = parseNum(data[utilizationIdx]);

  return result;
}

// ─── Extended Parsers ────────────────────────────────────────────────────────

import type { PipelineDeal, PayrollRecord, CashFlowPeriod, ARAgingBucket } from '../../types';

function parsePipelineDeals(rows: string[][]): PipelineDeal[] {
  const headers = rows[0]?.map(h => h.toLowerCase().trim()) ?? [];
  const data = rows.slice(1).filter(r => r.some(c => c.trim()));

  const nameIdx    = headers.findIndex(h => h.includes('deal') || h.includes('name') || h.includes('opportunity'));
  const stageIdx   = headers.findIndex(h => h.includes('stage') || h.includes('status'));
  const valueIdx   = headers.findIndex(h => h.includes('value') || h.includes('amount') || h.includes('size'));
  const probIdx    = headers.findIndex(h => h.includes('prob') || h.includes('likelihood') || h.includes('%'));
  const closeDateIdx = headers.findIndex(h => h.includes('close') || h.includes('date'));
  const ownerIdx   = headers.findIndex(h => h.includes('owner') || h.includes('rep') || h.includes('assigned'));

  return data.map(r => ({
    name:      nameIdx >= 0    ? (r[nameIdx] ?? 'Unnamed Deal')  : 'Unnamed Deal',
    stage:     stageIdx >= 0   ? (r[stageIdx] ?? 'Unknown')      : 'Unknown',
    value:     valueIdx >= 0   ? parseNum(r[valueIdx])           : 0,
    probability: probIdx >= 0  ? parseNum(r[probIdx])            : 50,
    closeDate: closeDateIdx >= 0 ? r[closeDateIdx]               : undefined,
    owner:     ownerIdx >= 0   ? r[ownerIdx]                     : undefined,
  }));
}

function parsePipelineSummary(rows: string[][]): UnifiedBusinessData['operations'] {
  const headers = rows[0]?.map(h => h.toLowerCase().trim()) ?? [];
  const data = rows.slice(1).filter(r => r.some(c => c.trim()));
  const valueIdx = headers.findIndex(h => h.includes('value') || h.includes('amount'));
  const probIdx  = headers.findIndex(h => h.includes('prob') || h.includes('likelihood'));

  const totalPipeline = data.reduce((s, r) => {
    const val  = valueIdx >= 0 ? parseNum(r[valueIdx]) : 0;
    const prob = probIdx  >= 0 ? parseNum(r[probIdx]) / 100 : 0.5;
    return s + val * prob;
  }, 0);

  return {
    projectCount:    data.length,
    avgProjectValue: data.length > 0 && valueIdx >= 0
      ? data.reduce((s, r) => s + parseNum(r[valueIdx]), 0) / data.length : 0,
    revenuePerEmployee: totalPipeline, // weighted pipeline total
  };
}

function parsePayrollDepts(rows: string[][]): PayrollRecord[] {
  const headers = rows[0]?.map(h => h.toLowerCase().trim()) ?? [];
  const data = rows.slice(1).filter(r => r.some(c => c.trim()));

  const deptIdx    = headers.findIndex(h => h.includes('dept') || h.includes('team') || h.includes('department'));
  const headcountIdx = headers.findIndex(h => h.includes('headcount') || h.includes('count') || h.includes('employee') || h.includes('fte'));
  const salaryIdx  = headers.findIndex(h => h.includes('total') || h.includes('salary') || h.includes('compensation'));
  const avgIdx     = headers.findIndex(h => h.includes('avg') || h.includes('average'));

  return data.map(r => ({
    department:        deptIdx >= 0      ? (r[deptIdx] ?? 'Unknown')   : 'Unknown',
    headcount:         headcountIdx >= 0 ? parseNum(r[headcountIdx])   : 1,
    totalCompensation: salaryIdx >= 0    ? parseNum(r[salaryIdx])      : 0,
    avgSalary:         avgIdx >= 0       ? parseNum(r[avgIdx])         : undefined,
  }));
}

function parsePayrollCSV(rows: string[][]): UnifiedBusinessData['operations'] {
  const headers = rows[0]?.map(h => h.toLowerCase().trim()) ?? [];
  const data = rows.slice(1).filter(r => r.some(c => c.trim()));
  const headcountIdx = headers.findIndex(h => h.includes('headcount') || h.includes('count') || h.includes('employee') || h.includes('fte'));
  const totalHeadcount = headcountIdx >= 0
    ? data.reduce((s, r) => s + parseNum(r[headcountIdx]), 0)
    : data.length;
  return { headcount: totalHeadcount || undefined };
}

function parsePayrollCostCSV(rows: string[][]): UnifiedBusinessData['costs'] {
  const headers = rows[0]?.map(h => h.toLowerCase().trim()) ?? [];
  const data = rows.slice(1).filter(r => r.some(c => c.trim()));
  const salaryIdx = headers.findIndex(h => h.includes('salary') || h.includes('compensation') || h.includes('total'));
  if (salaryIdx < 0) return { totalCOGS: 0, totalOpEx: 0, byCategory: [] };
  const totalLabor = data.reduce((s, r) => s + parseNum(r[salaryIdx]), 0);
  if (!totalLabor) return { totalCOGS: 0, totalOpEx: 0, byCategory: [] };
  return {
    totalCOGS: 0,
    totalOpEx: totalLabor,
    byCategory: [{ category: 'Labor', amount: totalLabor, percentOfRevenue: 0 }],
  };
}

function parseCashFlowData(rows: string[][]): CashFlowPeriod[] {
  const headers = rows[0]?.map(h => h.toLowerCase().trim()) ?? [];
  const data = rows.slice(1).filter(r => r.some(c => c.trim()));

  const periodIdx    = headers.findIndex(h => h.includes('period') || h.includes('month') || h.includes('date'));
  const openingIdx   = headers.findIndex(h => h.includes('opening') || h.includes('begin'));
  const receiptsIdx  = headers.findIndex(h => h.includes('receipt') || h.includes('inflow') || h.includes('cash in'));
  const paymentsIdx  = headers.findIndex(h => h.includes('payment') || h.includes('outflow') || h.includes('cash out'));
  const closingIdx   = headers.findIndex(h => h.includes('closing') || h.includes('ending') || h.includes('balance'));

  return data.map(r => {
    const opening  = openingIdx  >= 0 ? parseNum(r[openingIdx])  : 0;
    const receipts = receiptsIdx >= 0 ? parseNum(r[receiptsIdx]) : 0;
    const payments = paymentsIdx >= 0 ? parseNum(r[paymentsIdx]) : 0;
    const closing  = closingIdx  >= 0 ? parseNum(r[closingIdx])  : opening + receipts - payments;
    return {
      period:         periodIdx >= 0 ? (r[periodIdx] ?? 'Unknown') : 'Unknown',
      openingBalance: opening,
      receipts,
      payments,
      closingBalance: closing,
      netCashFlow:    closing - opening,
    };
  });
}

function parseARAgingData(rows: string[][]): ARAgingBucket[] {
  const headers = rows[0]?.map(h => h.toLowerCase().trim()) ?? [];
  const data = rows.slice(1).filter(r => r.some(c => c.trim()));

  const customerIdx = headers.findIndex(h => h.includes('customer') || h.includes('client') || h.includes('name'));
  const currentIdx  = headers.findIndex(h => h === 'current' || h.includes('current'));
  const d30Idx      = headers.findIndex(h => h.includes('30') || h.includes('1-30'));
  const d60Idx      = headers.findIndex(h => h.includes('60') || h.includes('31-60'));
  const d90Idx      = headers.findIndex(h => h.includes('90') || (h.includes('61') && !h.includes('over')));
  const over90Idx   = headers.findIndex(h => h.includes('over') || h.includes('90+') || h.includes('>90'));

  return data.map(r => {
    const current = currentIdx >= 0 ? parseNum(r[currentIdx]) : 0;
    const d30     = d30Idx    >= 0 ? parseNum(r[d30Idx])      : 0;
    const d60     = d60Idx    >= 0 ? parseNum(r[d60Idx])      : 0;
    const d90     = d90Idx    >= 0 ? parseNum(r[d90Idx])      : 0;
    const over90  = over90Idx >= 0 ? parseNum(r[over90Idx])   : 0;
    return {
      customer: customerIdx >= 0 ? (r[customerIdx] ?? 'Unknown') : 'Unknown',
      current, days30: d30, days60: d60, days90: d90, over90,
      total: current + d30 + d60 + d90 + over90,
    };
  });
}

// ─── Utility Functions ────────────────────────────────────────────────────────

function parseCSV(content: string): string[][] {
  return content.trim().split('\n').map(line =>
    line.split(',').map(cell => cell.replace(/^"(.*)"$/, '$1').trim())
  );
}

function parseNum(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[$,%\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function isCOGS(category: string): boolean {
  const cogsKeywords = ['cogs', 'cost of goods', 'cost of sales', 'materials', 'labor', 'direct'];
  return cogsKeywords.some(k => category.toLowerCase().includes(k));
}

function detectPeriodType(period: string): string {
  if (period.match(/W\d+/i) || period.includes('week')) return 'weekly';
  if (period.match(/Q[1-4]/i) || period.includes('quarter')) return 'quarterly';
  if (period.match(/^\d{4}$/)) return 'annual';
  return 'monthly';
}

function detectCoveragePeriod(revenue: UnifiedBusinessData['revenue']): { start: string; end: string } {
  if (!revenue.byPeriod.length) return { start: '', end: '' };
  return {
    start: revenue.byPeriod[0].period,
    end: revenue.byPeriod[revenue.byPeriod.length - 1].period,
  };
}

function calculateCompleteness(data: Partial<UnifiedBusinessData>): number {
  let score = 0;
  if (data.revenue?.total) score += 0.3;
  if (data.revenue?.byPeriod?.length) score += 0.1;
  if (data.costs?.totalCOGS) score += 0.2;
  if (data.costs?.totalOpEx) score += 0.1;
  if (data.customers?.totalCount) score += 0.2;
  if (data.customers?.topCustomers?.length) score += 0.1;
  return score;
}

function parseTransactionsData(rows: string[][]): import('../../types').Transaction[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.toLowerCase().trim());
  const col = (...keys: string[]) => {
    for (const k of keys) {
      const idx = headers.indexOf(k.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };
  const dateIdx  = col('date', 'transaction_date', 'trans_date');
  const descIdx  = col('description', 'memo', 'name', 'narrative');
  const amtIdx   = col('amount', 'debit', 'credit', 'value');
  const typeIdx  = col('type', 'transaction_type', 'trans_type');
  const catIdx   = col('category', 'account_category', 'class');
  const custIdx  = col('customer', 'client');
  const vendIdx  = col('vendor', 'payee', 'supplier');
  const invIdx   = col('invoiceid', 'invoice_id', 'invoice', 'ref', 'reference');
  const accIdx   = col('account', 'bank_account', 'account_name');

  return rows.slice(1)
    .filter(r => dateIdx >= 0 && r[dateIdx])
    .map(r => {
      const g = (idx: number) => (idx >= 0 ? r[idx] ?? '' : '');
      const rawAmt = parseFloat(g(amtIdx).replace(/[$,]/g, ''));
      const amt    = isNaN(rawAmt) ? 0 : rawAmt;
      const typeRaw = g(typeIdx).toLowerCase();
      const type: import('../../types').Transaction['type'] =
        typeRaw.includes('revenue') || typeRaw.includes('income') || typeRaw.includes('receipt') ? 'revenue'
        : typeRaw.includes('expense') || typeRaw.includes('payment') || typeRaw.includes('debit') ? 'expense'
        : typeRaw.includes('transfer') ? 'transfer'
        : amt > 0 ? 'revenue' : amt < 0 ? 'expense' : 'other';
      return {
        date:        g(dateIdx),
        description: g(descIdx) || '(no description)',
        amount:      amt,
        type,
        category:    g(catIdx) || 'Uncategorized',
        customer:    g(custIdx) || undefined,
        vendor:      g(vendIdx) || undefined,
        invoiceId:   g(invIdx) || undefined,
        account:     g(accIdx) || undefined,
      };
    })
    .filter(t => t.date);
}

function detectWarnings(data: Partial<UnifiedBusinessData>): string[] {
  const warnings: string[] = [];
  if (!data.revenue?.total) warnings.push('Revenue data missing or zero');
  if (!data.costs?.totalCOGS) warnings.push('COGS data not available — gross margin cannot be computed');
  if (!data.customers?.totalCount) warnings.push('Customer data missing — concentration risk cannot be assessed');
  if (data.revenue?.total && !data.costs?.totalOpEx) warnings.push('OpEx data missing — EBITDA estimate may be incomplete');
  return warnings;
}
