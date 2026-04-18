// ─── Unified Data Schema ─────────────────────────────────────────────────────

export interface UnifiedBusinessData {
  revenue: RevenueData;
  costs: CostData;
  customers: CustomerData;
  operations: OperationsData;
  metadata: DataMetadata;
  // Extended — populated from CSV uploads
  pipeline?: PipelineDeal[];
  payrollByDept?: PayrollRecord[];
  cashFlow?: CashFlowPeriod[];
  arAging?: ARAgingBucket[];
}

export interface RevenueData {
  total: number;
  byPeriod: PeriodData[];
  byProduct?: { name: string; amount: number; margin?: number }[];
  byCustomer?: { id: string; name: string; amount: number; percent: number }[];
  recurring?: number;
  oneTime?: number;
  currency: string;
}

export interface PeriodData {
  period: string; // "2024-W01", "2024-01", "2024-Q1"
  periodType: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  revenue: number;
  cogs?: number;
  grossProfit?: number;
  ebitda?: number;
  cashCollected?: number;
}

export interface CostData {
  totalCOGS: number;
  totalOpEx: number;
  byCategory: { category: string; amount: number; percentOfRevenue: number }[];
  laborCost?: number;
  materialsCost?: number;
  overheadCost?: number;
}

export interface CustomerData {
  totalCount: number;
  newThisPeriod: number;
  churned: number;
  topCustomers: { id: string; name: string; revenue: number; percentOfTotal: number }[];
  avgRevenuePerCustomer: number;
  retentionRate?: number;
  nps?: number;
}

export interface OperationsData {
  headcount?: number;
  revenuePerEmployee?: number;
  openPositions?: number;
  projectCount?: number;
  avgProjectValue?: number;
  utilizationRate?: number;
}

export interface DataMetadata {
  sources: string[];
  asOf: string;
  coveragePeriod: { start: string; end: string };
  completeness: number; // 0-1
  warnings: string[];
}

// ─── KPI Types ───────────────────────────────────────────────────────────────

export interface KPIResult {
  id: string;
  name: string;
  value: number;
  formattedValue: string;
  previousValue?: number;
  change?: number; // absolute
  changePercent?: number;
  trend: 'up' | 'down' | 'flat' | 'unknown';
  status: 'green' | 'yellow' | 'red' | 'neutral';
  unit: string;
  description: string;
  formula: string;
  category: 'revenue' | 'profitability' | 'customers' | 'operations' | 'cash';
  isAnomalous?: boolean;
  anomalyNote?: string;
  /** Period-level values for sparkline rendering */
  sparkline?: number[];
}

/** User-defined custom KPI metric, persisted in localStorage */
export interface CustomKPI {
  id: string;
  name: string;
  value: number;
  unit: '$' | '%' | 'x' | 'days' | 'custom';
  customUnit?: string;
  target?: number;
  higherIsBetter: boolean;
  notes?: string;
}

/** User-defined budget targets, persisted in localStorage */
export interface Budget {
  revenue?: number;
  cogs?: number;
  opex?: number;
  /** Optional per-category budget amounts keyed by category name */
  byCategory?: Record<string, number>;
}

/** User-defined performance targets, persisted in localStorage */
export interface Goals {
  revenue?: number;
  ebitdaMargin?: number;
  grossMargin?: number;
  retentionRate?: number;
  revenueGrowth?: number;
  revPerEmployee?: number;
  netNewCustomers?: number;
}

export interface KPIDashboard {
  generatedAt: string;
  period: string;
  kpis: KPIResult[];
  anomalies: AnomalyAlert[];
  summary: string;
}

// ─── Insight Types ────────────────────────────────────────────────────────────

export interface WeeklyInsight {
  weekOf: string;
  headline: string;
  executiveSummary: string;
  whatChanged: InsightPoint[];
  whyItMatters: InsightPoint[];
  whatToDoNext: ActionItem[];
  metricsSnapshot: Record<string, string>;
}

export interface InsightPoint {
  area: string;
  observation: string;
  magnitude: string;
  context: string;
}

export interface ActionItem {
  priority: 'URGENT' | 'HIGH' | 'MEDIUM';
  action: string;
  owner: string;
  deadline: string;
  expectedImpact: string;
}

export interface AnomalyAlert {
  metric: string;
  currentValue: number;
  expectedRange: { min: number; max: number };
  deviation: number; // sigma
  direction: 'spike' | 'drop' | 'trend-break';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  hypothesis: string;
  recommendedAction: string;
}

// ─── Board Deck Types ─────────────────────────────────────────────────────────

export interface BoardDeck {
  month: string;
  executiveSummary: string;
  financialPerformance: string;
  operationalHighlights: string;
  customerUpdate: string;
  lookAhead: string;
  keyDecisions: { decision: string; recommendation: string; rationale: string }[];
  risks: { risk: string; mitigation: string; owner: string }[];
}

// ─── Data Connector Types ─────────────────────────────────────────────────────

export interface DataConnector {
  name: string;
  type: 'google-sheets' | 'quickbooks' | 'stripe' | 'csv';
  connected: boolean;
  lastSync?: string;
  config: Record<string, unknown>;
}

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheets: {
    revenue: string;
    costs: string;
    customers: string;
    operations?: string;
  };
  accessToken: string;
}

export interface CSVUpload {
  type: 'revenue' | 'costs' | 'customers' | 'operations' | 'pipeline' | 'payroll' | 'cashflow' | 'ar_aging';
  filename: string;
  content: string; // CSV text
}

// Extended fields on UnifiedBusinessData (optional, populated when uploaded)
export interface PipelineDeal {
  name: string;
  stage: string;
  value: number;
  probability: number; // 0-100
  closeDate?: string;
  owner?: string;
}

export interface PayrollRecord {
  department: string;
  headcount: number;
  totalCompensation: number;
  avgSalary?: number;
}

export interface CashFlowPeriod {
  period: string;
  openingBalance: number;
  receipts: number;
  payments: number;
  closingBalance: number;
  netCashFlow?: number;
}

export interface ARAgingBucket {
  customer: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}
