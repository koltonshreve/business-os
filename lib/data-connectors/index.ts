import type { UnifiedBusinessData, GoogleSheetsConfig, CSVUpload, SupplierRecord, SupplierData, SupplierCategoryRollup, SupplierRedundancy, CapacityResource, CapacityData, CapacitySummary } from '../../types';

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
    case 'suppliers':     return { suppliers: parseSuppliersCSV(rows) };
    case 'capacity':      return { capacity: parseCapacityCSV(rows) };
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
    if (source.suppliers) merged.suppliers = source.suppliers;
    if (source.capacity) merged.capacity = source.capacity;
  }

  merged.metadata.completeness = calculateCompleteness(merged);
  merged.metadata.warnings = detectWarnings(merged);

  // Backfill percentOfRevenue for cost categories now that revenue is known
  const rev = merged.revenue.total;
  if (rev > 0 && merged.costs.byCategory.length > 0) {
    merged.costs = {
      ...merged.costs,
      byCategory: merged.costs.byCategory.map(c =>
        c.percentOfRevenue === 0
          ? { ...c, percentOfRevenue: (c.amount / rev) * 100 }
          : c
      ),
    };
  }

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

  const headcountIdx    = headers.findIndex(h => h.includes('headcount') || h.includes('employee'));
  if (headcountIdx >= 0) result.headcount = parseNum(data[headcountIdx]);

  const openPosIdx      = headers.findIndex(h => h.includes('open') && h.includes('position'));
  if (openPosIdx >= 0) result.openPositions = parseNum(data[openPosIdx]);

  const billableIdx     = headers.findIndex(h => h.includes('billable'));
  if (billableIdx >= 0) result.billableHours = parseNum(data[billableIdx]);

  const totalHrsIdx     = headers.findIndex(h => h === 'totalhours' || h === 'total_hours' || h === 'total hours' || (h.includes('total') && h.includes('hour')));
  if (totalHrsIdx >= 0) result.totalHours = parseNum(data[totalHrsIdx]);

  // Compute employee utilization from hours if both provided; otherwise look for direct column
  if (result.billableHours && result.totalHours && result.totalHours > 0) {
    result.employeeUtilization = result.billableHours / result.totalHours;
  } else {
    const empUtilIdx  = headers.findIndex(h => (h.includes('employee') || h.includes('staff')) && h.includes('util'));
    if (empUtilIdx >= 0) result.employeeUtilization = parseNum(data[empUtilIdx]);
  }

  // Legacy column name still supported
  const utilizationIdx  = headers.findIndex(h => h === 'utilization' || h === 'utilizationrate' || h === 'utilization rate');
  if (utilizationIdx >= 0) result.utilizationRate = parseNum(data[utilizationIdx]);

  const capUtilIdx      = headers.findIndex(h => h.includes('capacity'));
  if (capUtilIdx >= 0) result.capacityUtilization = parseNum(data[capUtilIdx]);

  const assetUtilIdx    = headers.findIndex(h => h.includes('asset'));
  if (assetUtilIdx >= 0) result.assetUtilization = parseNum(data[assetUtilIdx]);

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

  return {
    projectCount:    data.length,
    avgProjectValue: data.length > 0 && valueIdx >= 0
      ? data.reduce((s, r) => s + parseNum(r[valueIdx]), 0) / data.length : 0,
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

/** RFC 4180-compliant CSV parser — handles quoted fields containing commas and newlines. */
function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;

  while (i < normalized.length) {
    const ch = normalized[i];

    if (inQuotes) {
      if (ch === '"') {
        // Peek ahead for escaped quote ("")
        if (normalized[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        cell += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        row.push(cell.trim());
        cell = '';
        i++;
      } else if (ch === '\n') {
        row.push(cell.trim());
        if (row.some(c => c !== '')) rows.push(row);
        row = [];
        cell = '';
        i++;
      } else {
        cell += ch;
        i++;
      }
    }
  }

  // Flush last cell/row
  row.push(cell.trim());
  if (row.some(c => c !== '')) rows.push(row);

  return rows;
}

function parseNum(val: string | undefined): number {
  if (!val) return 0;
  const trimmed = val.trim();
  // Handle parenthetical negatives: (1,234) → -1234
  const isNegParen = /^\([\d,.$\s]+\)$/.test(trimmed);
  const cleaned = trimmed.replace(/[$,%\s()]/g, '').replace(/,/g, '');
  // Handle shorthand suffixes: 1.5M, 2.3k
  const suffixMatch = cleaned.match(/^(-?[\d.]+)([kmb])$/i);
  if (suffixMatch) {
    const n = parseFloat(suffixMatch[1]);
    const s = suffixMatch[2].toLowerCase();
    const mult = s === 'k' ? 1_000 : s === 'm' ? 1_000_000 : 1_000_000_000;
    return isNaN(n) ? 0 : (isNegParen ? -1 : 1) * n * mult;
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : isNegParen ? -num : num;
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

// ─── Supplier / Spend Intelligence Engine ────────────────────────────────────

export function buildSupplierData(suppliers: SupplierRecord[]): SupplierData {
  const total = suppliers.reduce((s, r) => s + (r.spendOverride ?? r.spend), 0);

  // Enrich each record with computed fields
  const enriched: SupplierRecord[] = suppliers.map(s => {
    const spend = s.spendOverride ?? s.spend;
    const pct   = total > 0 ? (spend / total) * 100 : 0;
    return {
      ...s,
      spend,
      spendPct:  parseFloat(pct.toFixed(2)),
      isTail:    pct < 2,
      riskLevel: pct >= 20 ? 'high' : pct >= 10 ? 'medium' : 'low',
    };
  });

  // Mark redundant suppliers (same category has ≥2 suppliers)
  const catCounts: Record<string, number> = {};
  for (const s of enriched) catCounts[s.category] = (catCounts[s.category] ?? 0) + 1;
  const withRedundancy = enriched.map(s => ({ ...s, isRedundant: (catCounts[s.category] ?? 0) >= 2 }));

  // Category rollups
  const catMap: Record<string, { spend: number; names: string[] }> = {};
  for (const s of withRedundancy) {
    if (!catMap[s.category]) catMap[s.category] = { spend: 0, names: [] };
    catMap[s.category].spend += s.spendOverride ?? s.spend;
    catMap[s.category].names.push(s.name);
  }
  const byCategory: SupplierCategoryRollup[] = Object.entries(catMap)
    .map(([cat, { spend, names }]) => ({
      category:       cat,
      spend,
      spendPct:       total > 0 ? parseFloat(((spend / total) * 100).toFixed(2)) : 0,
      supplierCount:  names.length,
      isConcentrated: total > 0 && (spend / total) > 0.35,
      suppliers:      names,
    }))
    .sort((a, b) => b.spend - a.spend);

  // Redundancy analysis
  const redundancies: SupplierRedundancy[] = byCategory
    .filter(c => c.supplierCount >= 2)
    .map(c => ({
      category:        c.category,
      suppliers:       c.suppliers,
      combinedSpend:   c.spend,
      potentialSavings: Math.round(c.spend * 0.15), // 15% consolidation estimate
    }));

  // Tail suppliers
  const tailSuppliers = withRedundancy.filter(s => s.isTail).map(s => s.name);

  // HHI (Herfindahl-Hirschman Index) — supplier-level, 0–10000
  const hhi = total > 0
    ? Math.round(withRedundancy.reduce((s, r) => {
        const share = (r.spendOverride ?? r.spend) / total;
        return s + share * share * 10000;
      }, 0))
    : 0;

  const concentrationRisk: SupplierData['concentrationRisk'] =
    hhi >= 2500 ? 'high' : hhi >= 1500 ? 'medium' : 'low';

  return {
    suppliers:         withRedundancy,
    totalSpend:        total,
    byCategory,
    tailSuppliers,
    redundancies,
    hhi,
    concentrationRisk,
  };
}

function parseSuppliersCSV(rows: string[][]): SupplierData {
  const headers = rows[0]?.map(h => h.toLowerCase().trim()) ?? [];
  const data    = rows.slice(1).filter(r => r.some(c => c.trim()));

  const nameIdx     = headers.findIndex(h => h.includes('supplier') || h.includes('vendor') || h.includes('name'));
  const catIdx      = headers.findIndex(h => h.includes('category') || h.includes('type'));
  const spendIdx    = headers.findIndex(h => h.includes('spend') || h.includes('amount') || h.includes('cost') || h.includes('total'));
  const invoiceIdx  = headers.findIndex(h => h.includes('invoice') && h.includes('count'));
  const dateIdx     = headers.findIndex(h => h.includes('date') || h.includes('last'));
  const contractIdx = headers.findIndex(h => h.includes('contract'));
  const termsIdx    = headers.findIndex(h => h.includes('term') || h.includes('payment'));
  const contactIdx  = headers.findIndex(h => h.includes('contact') || h.includes('email'));
  const notesIdx    = headers.findIndex(h => h.includes('note'));

  const suppliers: SupplierRecord[] = data.map((r, i) => ({
    id:              `s${i + 1}`,
    name:            nameIdx >= 0    ? (r[nameIdx] ?? `Supplier ${i + 1}`).trim() : `Supplier ${i + 1}`,
    category:        catIdx >= 0     ? (r[catIdx]  ?? 'Uncategorized').trim()     : 'Uncategorized',
    spend:           spendIdx >= 0   ? parseNum(r[spendIdx])                      : 0,
    invoiceCount:    invoiceIdx >= 0 ? parseNum(r[invoiceIdx]) || undefined        : undefined,
    lastInvoiceDate: dateIdx >= 0    ? r[dateIdx]                                  : undefined,
    contractValue:   contractIdx >= 0? parseNum(r[contractIdx]) || undefined       : undefined,
    paymentTerms:    termsIdx >= 0   ? r[termsIdx]                                : undefined,
    contact:         contactIdx >= 0 ? r[contactIdx]                              : undefined,
    notes:           notesIdx >= 0   ? r[notesIdx]                                : undefined,
  }));

  return buildSupplierData(suppliers);
}

// ─── Capacity CSV Parser ──────────────────────────────────────────────────────

function buildCapacityFromResources(resources: CapacityResource[]): CapacityData {
  const computed = resources.map(r => {
    const utilization = r.capacity > 0 ? r.actualVolume / r.capacity : 0;
    const totalCost = r.fixedCost + r.variableCostPerUnit * r.actualVolume;
    const costPerUnit = r.actualVolume > 0 ? totalCost / r.actualVolume : 0;
    const costPerUnitAtCapacity = r.capacity > 0
      ? (r.fixedCost + r.variableCostPerUnit * r.capacity) / r.capacity
      : 0;
    const savingsAtCapacity = r.actualVolume > 0 && r.capacity > 0
      ? (costPerUnit - costPerUnitAtCapacity) * r.actualVolume
      : 0;
    return {
      ...r,
      utilization,
      totalCost,
      costPerUnit,
      costPerUnitAtCapacity,
      isBottleneck: utilization >= 0.85,
      isUnderutilized: utilization < 0.50,
      savingsAtCapacity: Math.max(0, savingsAtCapacity),
    };
  });

  const totalFixed = computed.reduce((s, r) => s + r.fixedCost, 0);
  const totalVariable = computed.reduce((s, r) => s + (r.variableCostPerUnit * r.actualVolume), 0);
  const totalCost = totalFixed + totalVariable;

  const totalCapacity = computed.reduce((s, r) => s + r.capacity, 0);
  const totalActual = computed.reduce((s, r) => s + r.actualVolume, 0);
  const weightedUtilization = totalCapacity > 0 ? totalActual / totalCapacity : 0;

  const summary: CapacitySummary = {
    totalFixed,
    totalVariable,
    totalCost,
    weightedUtilization,
    bottlenecks: computed.filter(r => r.isBottleneck).map(r => r.name),
    underutilized: computed.filter(r => r.isUnderutilized).map(r => r.name),
    potentialSavings: computed.reduce((s, r) => s + (r.savingsAtCapacity ?? 0), 0),
  };

  return { resources: computed, summary };
}

export function parseCapacityCSV(rows: string[][]): CapacityData {
  if (rows.length < 2) return { resources: [], summary: { totalFixed: 0, totalVariable: 0, totalCost: 0, weightedUtilization: 0, bottlenecks: [], underutilized: [], potentialSavings: 0 } };

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const data = rows.slice(1);

  const idx = (terms: string[]) =>
    headers.findIndex(h => terms.some(t => h.includes(t)));

  const nameIdx     = idx(['name', 'resource']);
  const catIdx      = idx(['category', 'type']);
  const actualIdx   = idx(['actual', 'volume', 'units']);
  const capacityIdx = idx(['capacity', 'max']);
  const unitIdx     = idx(['unit']);
  const fixedIdx    = idx(['fixed']);
  const varIdx      = idx(['variable', 'variablecost', 'var_cost']);
  const revenueIdx  = idx(['revenue', 'price', 'revenueperunit']);
  const notesIdx    = idx(['note']);

  const resources: CapacityResource[] = data
    .filter(r => r.length > 1)
    .map((r, i) => ({
      id: `cap${i + 1}`,
      name:                nameIdx >= 0     ? (r[nameIdx] ?? `Resource ${i + 1}`).trim() : `Resource ${i + 1}`,
      category:            catIdx >= 0      ? (r[catIdx]  ?? 'Operations').trim()        : 'Operations',
      actualVolume:        actualIdx >= 0   ? parseNum(r[actualIdx])                     : 0,
      capacity:            capacityIdx >= 0 ? parseNum(r[capacityIdx])                   : 0,
      unit:                unitIdx >= 0     ? (r[unitIdx] ?? 'units').trim()             : 'units',
      fixedCost:           fixedIdx >= 0    ? parseNum(r[fixedIdx])                      : 0,
      variableCostPerUnit: varIdx >= 0      ? parseNum(r[varIdx])                        : 0,
      revenuePerUnit:      revenueIdx >= 0  ? parseNum(r[revenueIdx]) || undefined       : undefined,
      notes:               notesIdx >= 0    ? r[notesIdx]                                : undefined,
    }));

  return buildCapacityFromResources(resources);
}
