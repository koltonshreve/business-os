import type {
  UnifiedBusinessData, KPIResult, KPIDashboard, AnomalyAlert
} from '../../types';

// ─── KPI Computation Engine ───────────────────────────────────────────────────

export class KPIEngine {
  private data: UnifiedBusinessData;
  private previousData?: UnifiedBusinessData;

  constructor(data: UnifiedBusinessData, previousData?: UnifiedBusinessData) {
    this.data = data;
    this.previousData = previousData;
  }

  // ── Revenue KPIs ────────────────────────────────────────────────────────────

  revenueGrowth(): KPIResult {
    const current = this.data.revenue.total;
    const previous = this.previousData?.revenue.total;
    const change = previous ? ((current - previous) / previous) * 100 : undefined;

    return this.buildKPI({
      id: 'revenue-growth',
      name: 'Revenue Growth',
      value: change ?? 0,
      unit: '%',
      description: 'Period-over-period revenue growth rate',
      formula: '(Current Revenue - Prior Revenue) / Prior Revenue × 100',
      category: 'revenue',
      changePercent: change,
      status: this.thresholds(change ?? 0, 10, 5, 0),
      trend: change ? (change > 0 ? 'up' : 'down') : 'unknown',
      previousValue: previous,
    });
  }

  totalRevenue(): KPIResult {
    return this.buildKPI({
      id: 'total-revenue',
      name: 'Total Revenue',
      value: this.data.revenue.total,
      unit: '$',
      description: 'Total revenue for the period',
      formula: 'Sum of all recognized revenue',
      category: 'revenue',
      previousValue: this.previousData?.revenue.total,
      changePercent: this.pctChange(this.data.revenue.total, this.previousData?.revenue.total),
      status: 'neutral',
      trend: this.trendFromChange(this.data.revenue.total, this.previousData?.revenue.total),
    });
  }

  grossMargin(): KPIResult {
    const revenue = this.data.revenue.total;
    const cogs = this.data.costs.totalCOGS;
    const grossProfit = revenue - cogs;
    const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    const prevRevenue = this.previousData?.revenue.total ?? 0;
    const prevCOGS = this.previousData?.costs.totalCOGS ?? 0;
    const prevMargin = prevRevenue > 0 ? ((prevRevenue - prevCOGS) / prevRevenue) * 100 : undefined;

    return this.buildKPI({
      id: 'gross-margin',
      name: 'Gross Margin',
      value: margin,
      unit: '%',
      description: 'Gross profit as a percentage of revenue',
      formula: '(Revenue - COGS) / Revenue × 100',
      category: 'profitability',
      previousValue: prevMargin,
      changePercent: prevMargin ? margin - prevMargin : undefined,
      status: this.thresholds(margin, 50, 30, 15),
      trend: this.trendFromChange(margin, prevMargin),
    });
  }

  ebitda(): KPIResult {
    const ebitda = this.data.revenue.total - this.data.costs.totalCOGS - this.data.costs.totalOpEx;
    const prevEBITDA = this.previousData
      ? this.previousData.revenue.total - this.previousData.costs.totalCOGS - this.previousData.costs.totalOpEx
      : undefined;

    return this.buildKPI({
      id: 'ebitda',
      name: 'EBITDA',
      value: ebitda,
      unit: '$',
      description: 'Earnings before interest, taxes, depreciation, and amortization',
      formula: 'Revenue - COGS - Operating Expenses',
      category: 'profitability',
      previousValue: prevEBITDA,
      changePercent: this.pctChange(ebitda, prevEBITDA),
      status: ebitda > 0 ? 'green' : ebitda > -this.data.revenue.total * 0.1 ? 'yellow' : 'red',
      trend: this.trendFromChange(ebitda, prevEBITDA),
    });
  }

  ebitdaMargin(): KPIResult {
    const revenue = this.data.revenue.total;
    const ebitda = revenue - this.data.costs.totalCOGS - this.data.costs.totalOpEx;
    const margin = revenue > 0 ? (ebitda / revenue) * 100 : 0;

    const prevRev = this.previousData?.revenue.total ?? 0;
    const prevEBITDA = prevRev > 0
      ? prevRev - (this.previousData?.costs.totalCOGS ?? 0) - (this.previousData?.costs.totalOpEx ?? 0)
      : undefined;
    const prevMargin = prevRev > 0 && prevEBITDA !== undefined ? (prevEBITDA / prevRev) * 100 : undefined;

    return this.buildKPI({
      id: 'ebitda-margin',
      name: 'EBITDA Margin',
      value: margin,
      unit: '%',
      description: 'EBITDA as a percentage of revenue',
      formula: 'EBITDA / Revenue × 100',
      category: 'profitability',
      previousValue: prevMargin,
      changePercent: prevMargin !== undefined ? margin - prevMargin : undefined,
      status: this.thresholds(margin, 20, 10, 0),
      trend: this.trendFromChange(margin, prevMargin),
    });
  }

  // ── Customer KPIs ────────────────────────────────────────────────────────────

  customerConcentration(): KPIResult {
    const top3 = this.data.customers.topCustomers
      .slice(0, 3)
      .reduce((sum, c) => sum + c.percentOfTotal, 0);

    return this.buildKPI({
      id: 'customer-concentration',
      name: 'Top 3 Customer Concentration',
      value: top3,
      unit: '%',
      description: 'Revenue percentage from top 3 customers — concentration risk indicator',
      formula: 'Sum(Top 3 Customer Revenue) / Total Revenue × 100',
      category: 'customers',
      status: top3 > 60 ? 'red' : top3 > 40 ? 'yellow' : 'green',
      trend: 'unknown',
    });
  }

  customerRetention(): KPIResult {
    const retention = this.data.customers.retentionRate ?? this.calculateRetention();
    const prevRetention = this.previousData?.customers.retentionRate;

    return this.buildKPI({
      id: 'retention-rate',
      name: 'Customer Retention Rate',
      value: retention * 100,
      unit: '%',
      description: 'Percentage of customers retained from prior period',
      formula: '(Customers End - New Customers) / Customers Start × 100',
      category: 'customers',
      previousValue: prevRetention ? prevRetention * 100 : undefined,
      changePercent: prevRetention ? (retention - prevRetention) * 100 : undefined,
      status: this.thresholds(retention * 100, 90, 80, 70),
      trend: this.trendFromChange(retention, prevRetention),
    });
  }

  netNewCustomers(): KPIResult {
    const net = this.data.customers.newThisPeriod - this.data.customers.churned;
    return this.buildKPI({
      id: 'net-new-customers',
      name: 'Net New Customers',
      value: net,
      unit: '',
      description: 'New customers acquired minus customers lost in the period',
      formula: 'New Customers - Churned Customers',
      category: 'customers',
      status: net > 0 ? 'green' : net === 0 ? 'yellow' : 'red',
      trend: net > 0 ? 'up' : net < 0 ? 'down' : 'flat',
    });
  }

  // ── Operations KPIs ──────────────────────────────────────────────────────────

  revenuePerEmployee(): KPIResult {
    const headcount = this.data.operations.headcount;
    if (!headcount) return this.buildKPI({
      id: 'rev-per-employee', name: 'Revenue Per Employee',
      value: 0, unit: '$', description: 'Headcount not available',
      formula: 'Revenue / Headcount', category: 'operations',
      status: 'neutral', trend: 'unknown',
    });

    const value = this.data.revenue.total / headcount;
    const prevValue = this.previousData?.operations.headcount
      ? (this.previousData.revenue.total / this.previousData.operations.headcount)
      : undefined;

    return this.buildKPI({
      id: 'rev-per-employee',
      name: 'Revenue Per Employee',
      value,
      unit: '$',
      description: 'Revenue efficiency per full-time employee',
      formula: 'Total Revenue / Headcount',
      category: 'operations',
      previousValue: prevValue,
      changePercent: this.pctChange(value, prevValue),
      status: 'neutral',
      trend: this.trendFromChange(value, prevValue),
    });
  }

  // ── Compute All KPIs ──────────────────────────────────────────────────────────

  computeAll(): KPIResult[] {
    const kpis = [
      this.totalRevenue(),
      this.revenueGrowth(),
      this.grossMargin(),
      this.ebitda(),
      this.ebitdaMargin(),
      this.customerConcentration(),
      this.customerRetention(),
      this.netNewCustomers(),
      this.revenuePerEmployee(),
    ];

    // Run anomaly detection on each
    return kpis.map(kpi => this.detectAnomaly(kpi));
  }

  buildDashboard(): KPIDashboard {
    const kpis = this.computeAll();
    const anomalies = this.detectAllAnomalies(kpis);
    const summary = this.buildNarrativeSummary(kpis);

    return {
      generatedAt: new Date().toISOString(),
      period: this.data.metadata.asOf,
      kpis,
      anomalies,
      summary,
    };
  }

  // ── Anomaly Detection ─────────────────────────────────────────────────────────

  private detectAnomaly(kpi: KPIResult): KPIResult {
    if (!kpi.changePercent) return kpi;

    const absChange = Math.abs(kpi.changePercent);
    const isAnomalous = absChange > 20; // >20% period change = flag

    if (isAnomalous) {
      const direction = kpi.changePercent > 0 ? 'increase' : 'decrease';
      kpi.isAnomalous = true;
      kpi.anomalyNote = `${kpi.name} ${direction}d ${absChange.toFixed(1)}% — investigate driver`;
    }

    return kpi;
  }

  private detectAllAnomalies(kpis: KPIResult[]): AnomalyAlert[] {
    return kpis
      .filter(k => k.isAnomalous && k.changePercent)
      .map(k => ({
        metric: k.name,
        currentValue: k.value,
        expectedRange: {
          min: (k.previousValue ?? k.value) * 0.85,
          max: (k.previousValue ?? k.value) * 1.15,
        },
        deviation: Math.abs(k.changePercent!) / 10, // rough sigma
        direction: (k.changePercent! > 0 ? 'spike' : 'drop') as 'spike' | 'drop' | 'trend-break',
        severity: Math.abs(k.changePercent!) > 30 ? 'HIGH' : 'MEDIUM' as 'HIGH' | 'MEDIUM' | 'LOW',
        hypothesis: `${k.name} moved ${Math.abs(k.changePercent!).toFixed(1)}% — potential ${k.trend === 'down' ? 'deterioration in' : 'acceleration in'} ${k.category}`,
        recommendedAction: `Review ${k.name} drivers vs prior period. Check for one-time items, timing differences, or structural changes.`,
      }));
  }

  private buildNarrativeSummary(kpis: KPIResult[]): string {
    const revenue = kpis.find(k => k.id === 'total-revenue');
    const growth = kpis.find(k => k.id === 'revenue-growth');
    const margin = kpis.find(k => k.id === 'ebitda-margin');
    const anomalies = kpis.filter(k => k.isAnomalous);

    const parts = [];
    if (revenue && growth) {
      parts.push(`Revenue of ${this.fmt(revenue.value, '$')} represents ${growth.changePercent?.toFixed(1) ?? 'N/A'}% period-over-period change.`);
    }
    if (margin) {
      parts.push(`EBITDA margin of ${margin.value.toFixed(1)}% is ${margin.status === 'green' ? 'within' : 'below'} target range.`);
    }
    if (anomalies.length) {
      parts.push(`${anomalies.length} metric${anomalies.length > 1 ? 's require' : ' requires'} attention: ${anomalies.map(a => a.name).join(', ')}.`);
    }

    return parts.join(' ');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private buildKPI(params: Omit<KPIResult, 'formattedValue'>): KPIResult {
    return {
      ...params,
      formattedValue: this.fmt(params.value, params.unit),
    };
  }

  private fmt(value: number, unit: string): string {
    if (unit === '$') {
      if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
      if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
      return `$${value.toFixed(0)}`;
    }
    if (unit === '%') return `${value.toFixed(1)}%`;
    return value.toFixed(0);
  }

  private pctChange(current: number, previous?: number): number | undefined {
    if (!previous || previous === 0) return undefined;
    return ((current - previous) / Math.abs(previous)) * 100;
  }

  private trendFromChange(current: number, previous?: number): KPIResult['trend'] {
    if (!previous) return 'unknown';
    const diff = current - previous;
    if (Math.abs(diff) < 0.01) return 'flat';
    return diff > 0 ? 'up' : 'down';
  }

  private thresholds(
    value: number,
    green: number,
    yellow: number,
    red: number
  ): KPIResult['status'] {
    if (value >= green) return 'green';
    if (value >= yellow) return 'yellow';
    if (value >= red) return 'neutral';
    return 'red';
  }

  private calculateRetention(): number {
    const { totalCount, newThisPeriod, churned } = this.data.customers;
    const startCount = totalCount - newThisPeriod + churned;
    if (startCount <= 0) return 1;
    return (startCount - churned) / startCount;
  }
}
