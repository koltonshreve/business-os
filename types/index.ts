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
  transactions?: Transaction[];
  suppliers?: SupplierData;
  capacity?: CapacityData;
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
  recurring?: number;   // recurring portion of revenue this period
  oneTime?: number;     // project / one-time portion this period
}

export interface CostData {
  totalCOGS: number;
  totalOpEx: number;
  byCategory: { category: string; amount: number; percentOfRevenue: number }[];
  laborCost?: number;
  materialsCost?: number;
  overheadCost?: number;
}

export type CustomerIndustry =
  | 'professional-services'
  | 'saas-technology'
  | 'manufacturing'
  | 'healthcare'
  | 'construction'
  | 'distribution'
  | 'financial-services'
  | 'retail';

export type CustomerRevenueType = 'recurring' | 'project' | 'mixed';

export interface CustomerRecord {
  id: string;
  name: string;
  revenue: number;
  percentOfTotal: number;
  industry?: CustomerIndustry;
  revenueType?: CustomerRevenueType;
  notes?: string;
}

export interface CustomerData {
  totalCount: number;
  newThisPeriod: number;
  churned: number;
  topCustomers: CustomerRecord[];
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
  // Expanded utilization fields
  billableHours?: number;
  totalHours?: number;
  employeeUtilization?: number;   // billable / total hours (or direct input)
  capacityUtilization?: number;   // capacity used vs available (0-1)
  assetUtilization?: number;      // asset / equipment utilization (0-1)
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
  type: 'revenue' | 'costs' | 'customers' | 'operations' | 'pipeline' | 'payroll' | 'cashflow' | 'ar_aging' | 'transactions' | 'suppliers' | 'capacity';
  filename: string;
  content: string; // CSV text
}

// ─── Supplier / Spend Intelligence ───────────────────────────────────────────

export interface SupplierRecord {
  id: string;
  name: string;
  category: string;
  spend: number;
  spendOverride?: number;   // manual override takes precedence over parsed value
  invoiceCount?: number;
  lastInvoiceDate?: string;
  contractValue?: number;
  paymentTerms?: string;
  contact?: string;
  notes?: string;
  // computed (set by engine)
  spendPct?: number;
  isTail?: boolean;         // spend < 2% of total
  isRedundant?: boolean;    // same category has another supplier
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface SupplierCategoryRollup {
  category: string;
  spend: number;
  spendPct: number;
  supplierCount: number;
  isConcentrated: boolean;  // >35% of total spend in one category
  suppliers: string[];
}

export interface SupplierRedundancy {
  category: string;
  suppliers: string[];
  combinedSpend: number;
  potentialSavings: number; // estimated 10-20% if consolidated
}

export interface SupplierData {
  suppliers: SupplierRecord[];
  totalSpend: number;
  byCategory: SupplierCategoryRollup[];
  tailSuppliers: string[];        // names of tail suppliers (<2%)
  redundancies: SupplierRedundancy[];
  hhi: number;                    // Herfindahl-Hirschman Index (0-10000)
  concentrationRisk: 'low' | 'medium' | 'high';
}

// Extended fields on UnifiedBusinessData (optional, populated when uploaded)
export interface PipelineDeal {
  name: string;
  stage: string;
  value: number;
  probability: number; // 0-100
  closeDate?: string;
  createdDate?: string;
  owner?: string;
  daysInStage?: number;
}

export interface Transaction {
  date: string;
  description: string;
  amount: number;
  /** Positive = inflow (revenue/receipt), negative = outflow (expense) */
  type: 'revenue' | 'expense' | 'transfer' | 'other';
  category: string;
  customer?: string;
  vendor?: string;
  invoiceId?: string;
  account?: string;
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

// ─── Capacity & Cost Analysis ────────────────────────────────────────────────

export interface CapacityResource {
  id: string;
  name: string;
  category: string;        // 'People' | 'Equipment' | 'Facilities' | 'Technology'
  actualVolume: number;    // units currently produced/consumed
  capacity: number;        // max units possible
  unit: string;            // 'hours', 'units', 'sq ft', 'seats'
  fixedCost: number;       // cost regardless of volume (monthly)
  variableCostPerUnit: number; // cost per unit of output
  revenuePerUnit?: number; // optional: revenue per unit (for margin calc)
  notes?: string;
  // computed (set by engine)
  utilization?: number;      // actual / capacity (0-1)
  totalCost?: number;        // fixedCost + variableCostPerUnit * actual
  costPerUnit?: number;      // totalCost / actual
  costPerUnitAtCapacity?: number; // totalCost-at-full / capacity
  isBottleneck?: boolean;    // utilization > 85%
  isUnderutilized?: boolean; // utilization < 50%
  savingsAtCapacity?: number; // cost savings if run at 90% vs current
}

export interface CapacitySummary {
  totalFixed: number;
  totalVariable: number;
  totalCost: number;
  weightedUtilization: number;  // capacity-weighted avg utilization
  bottlenecks: string[];        // names of bottleneck resources
  underutilized: string[];      // names of underutilized resources
  potentialSavings: number;     // if underutilized resources were outsourced
}

export interface CapacityData {
  resources: CapacityResource[];
  summary: CapacitySummary;
}

// ─── CRM / Deal Pipeline ──────────────────────────────────────────────────────

export type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost';

export interface Deal {
  id: string;
  name: string;
  company: string;
  value: number;
  stage: DealStage;
  probability: number;
  closeDate: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  contactName?: string;
  contactEmail?: string;
  tags?: string[];
  lostReason?: string;
  source?: string;
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export type CompanySize = '1-5' | '6-20' | '21-50' | '51-200' | '200+';
export type UserRole = 'founder-ceo' | 'cfo' | 'vp-finance' | 'operations' | 'sales' | 'other';
export type BusinessGoal =
  | 'grow-revenue'
  | 'improve-margins'
  | 'reduce-churn'
  | 'close-more-deals'
  | 'manage-cash'
  | 'hire-and-scale'
  | 'prep-for-fundraise'
  | 'understand-numbers';

export interface OnboardingData {
  companyName: string;
  companySize: CompanySize;
  industry: string;
  role: UserRole;
  goals: BusinessGoal[];
  completedAt: string;
}

// ─── Automations ─────────────────────────────────────────────────────────────

export type TriggerType = 'metric-below' | 'metric-above' | 'weekly' | 'monthly' | 'churn-detected' | 'new-deal-stage';
export type ActionType = 'in-app-alert' | 'generate-report' | 'webhook' | 'add-note';

export interface AutomationTrigger {
  type: TriggerType;
  metric?: 'ebitda-margin' | 'gross-margin' | 'revenue-growth' | 'retention' | 'cash-runway' | 'pipeline-coverage';
  threshold?: number;
  stage?: DealStage;
}

export interface AutomationAction {
  type: ActionType;
  message?: string;
  reportType?: 'weekly-insight' | 'board-deck';
  webhookUrl?: string;
  noteText?: string;
}

export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  action: AutomationAction;
  createdAt: string;
  lastFiredAt?: string;
  fireCount: number;
}

// ─── Plans / Pricing ──────────────────────────────────────────────────────────

export type PlanId = 'starter' | 'growth' | 'pro';

export interface PlanLimits {
  snapshots: number;
  dataConnectors: number;
  aiQueriesPerMonth: number;
  automations: number;
  teamMembers: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  price: number; // monthly USD
  description: string;
  features: string[];
  limits: PlanLimits;
  badge?: string;
}

// ─── User Session ─────────────────────────────────────────────────────────────

export interface AppSession {
  planId: PlanId;
  aiQueriesUsed: number;
  aiQueriesResetAt: string; // ISO date, resets monthly
  onboarded: boolean;
  // Billing
  stripeCustomerId?:    string;
  stripeSubscriptionId?: string;
  customerEmail?:       string;
  billingVerifiedAt?:   string; // ISO timestamp of last verification
}
