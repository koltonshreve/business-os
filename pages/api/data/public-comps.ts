/**
 * /api/data/public-comps
 *
 * Fetches live public-company comparable data by combining:
 *   1. SEC EDGAR XBRL API — official financial statement data (revenue, EBITDA, debt, cash)
 *   2. Yahoo Finance chart API — current market price / market cap
 *
 * Computes:
 *   EV = market cap + total debt − cash
 *   EV/EBITDA, EV/Revenue, revenue growth YoY, EBITDA margin
 *
 * Result is cached in-process for 24 hours.
 *
 * WHY NOT EDGAR FOR MULTIPLES:
 *   EDGAR contains only financial statement data. Market-derived multiples (EV/EBITDA)
 *   require current stock price × shares outstanding, which EDGAR does not provide.
 *   Yahoo Finance chart API supplies the missing price/marketCap data.
 *
 * WHY NOT EDGAR FOR PRECEDENT TRANSACTIONS:
 *   LMM private deals are not required to file deal terms with the SEC. Precedent
 *   transaction data comes from proprietary databases (GF Data, IBBA, PitchBook).
 */

import type { NextApiRequest, NextApiResponse } from 'next';

export const config = { maxDuration: 30 };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LiveComp {
  ticker: string;
  name: string;
  industry: string;
  evEBITDA: number;
  evRevenue: number;
  revenueGrowthPct: number;
  ebitdaMarginPct: number;
  marketCapB: number;
  secFiling: string; // e.g. "10-K FY2024"
}

export interface PublicCompsResponse {
  comps: LiveComp[];
  asOf: string;        // ISO timestamp of when data was fetched
  successCount: number;
  cached?: boolean;
}

// ── Ticker metadata ───────────────────────────────────────────────────────────

const TICKER_META: Record<string, { industry: string; name: string }> = {
  // Professional Services
  HURN: { industry: 'professional',  name: 'Huron Consulting Group'   },
  FCN:  { industry: 'professional',  name: 'FTI Consulting'            },
  ICFI: { industry: 'professional',  name: 'ICF International'         },
  CRAI: { industry: 'professional',  name: 'Charles River Associates'  },
  // Technology Services
  EPAM: { industry: 'tech-services', name: 'EPAM Systems'              },
  GLOB: { industry: 'tech-services', name: 'Globant'                   },
  KFRC: { industry: 'tech-services', name: 'Kforce Inc.'               },
  NSIT: { industry: 'tech-services', name: 'Insight Enterprises'       },
  // SaaS / Recurring Revenue
  PCTY: { industry: 'saas',          name: 'Paylocity'                 },
  VEEV: { industry: 'saas',          name: 'Veeva Systems'             },
  BSY:  { industry: 'saas',          name: 'Bentley Systems'           },
  BRZE: { industry: 'saas',          name: 'Braze'                     },
  // Manufacturing
  WTS:  { industry: 'manufacturing', name: 'Watts Water Technologies'  },
  HAYN: { industry: 'manufacturing', name: 'Haynes International'      },
  NNBR: { industry: 'manufacturing', name: 'NN Inc.'                   },
  TNC:  { industry: 'manufacturing', name: 'Tennant Company'           },
  // Distribution
  WCC:  { industry: 'distribution',  name: 'WESCO International'       },
  AIT:  { industry: 'distribution',  name: 'Applied Industrial'        },
  DXPE: { industry: 'distribution',  name: 'DXP Enterprises'           },
  // Healthcare Services
  ACHC: { industry: 'healthcare',    name: 'Acadia Healthcare'          },
  ADUS: { industry: 'healthcare',    name: 'Addus HomeCare'            },
  NHC:  { industry: 'healthcare',    name: 'National HealthCare Corp'  },
  // Construction / Trades
  EME:  { industry: 'construction',  name: 'EMCOR Group'               },
  FIX:  { industry: 'construction',  name: 'Comfort Systems USA'       },
  MYRG: { industry: 'construction',  name: 'MYR Group'                 },
};

// ── In-process cache ──────────────────────────────────────────────────────────

let _cache: PublicCompsResponse | null = null;
let _cacheTsMs = 0;
const CACHE_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── HTTP headers ──────────────────────────────────────────────────────────────

// SEC EDGAR requires a descriptive User-Agent: https://www.sec.gov/developer
const SEC_UA  = 'BusinessOS/1.0 (info@businessos.app)';
const YF_UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── EDGAR helpers ─────────────────────────────────────────────────────────────

/** Fetch ticker→CIK mapping from SEC EDGAR. */
async function getTickerCIKMap(): Promise<Record<string, number>> {
  const resp = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': SEC_UA },
    signal: AbortSignal.timeout(12_000),
  });
  if (!resp.ok) throw new Error(`SEC tickers: ${resp.status}`);
  const data = await resp.json();
  const map: Record<string, number> = {};
  for (const v of Object.values(data) as any[]) {
    map[String(v.ticker).toUpperCase()] = v.cik_str;
  }
  return map;
}

/** Fetch all XBRL company facts for a CIK from EDGAR. Returns null on failure. */
async function fetchEdgarFacts(cik: number): Promise<any | null> {
  try {
    const padded = String(cik).padStart(10, '0');
    const resp = await fetch(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`,
      { headers: { 'User-Agent': SEC_UA }, signal: AbortSignal.timeout(15_000) }
    );
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

interface AnnualPoint { val: number; fy: number; form: string; end: string }

/**
 * From a us-gaap concept entry array, return the N most recent annual filing values.
 * Handles both 10-K (domestic) and 20-F (foreign private issuer) filers.
 */
function annualValues(usgaap: any, key: string, count = 2): AnnualPoint[] {
  const entries: any[] = usgaap?.[key]?.units?.USD ?? [];
  return entries
    .filter(d => d.form === '10-K' || d.form === '20-F')
    .sort((a, b) => new Date(b.end).getTime() - new Date(a.end).getTime())
    .slice(0, count)
    .map(d => ({ val: d.val, fy: d.fy ?? new Date(d.end).getFullYear(), form: d.form, end: d.end }));
}

/** Try a list of concept keys; return latest annual point from the first key with data. */
function tryKeys(usgaap: any, keys: string[], count = 2): AnnualPoint[] {
  for (const k of keys) {
    const pts = annualValues(usgaap, k, count);
    if (pts.length > 0) return pts;
  }
  return [];
}

// us-gaap concept keys to try for each line item (in priority order)
const REV_KEYS  = [
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'Revenues',
  'SalesRevenueNet',
  'RevenueFromContractWithCustomerIncludingAssessedTax',
];
const DA_KEYS   = [
  'DepreciationDepletionAndAmortization',
  'DepreciationAndAmortization',
  'Depreciation',
];
const DEBT_KEYS = [
  'LongTermDebtAndCapitalLeaseObligations',
  'LongTermDebt',
  'LongTermDebtNoncurrent',
  'DebtAndCapitalLeaseObligations',
];
const CASH_KEYS = [
  'CashCashEquivalentsAndShortTermInvestments',
  'CashAndCashEquivalentsAtCarryingValue',
  'Cash',
];

// ── Yahoo Finance helpers ─────────────────────────────────────────────────────

interface YFPrice { price: number; marketCapB: number | null }

/** Fetch current price and market cap from Yahoo Finance chart API (no API key required). */
async function fetchYFPrice(ticker: string): Promise<YFPrice | null> {
  try {
    const resp = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`,
      { headers: { 'User-Agent': YF_UA }, signal: AbortSignal.timeout(10_000) }
    );
    if (!resp.ok) return null;
    const json = await resp.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    return {
      price:      meta.regularMarketPrice as number,
      marketCapB: meta.marketCap ? (meta.marketCap as number) / 1e9 : null,
    };
  } catch {
    return null;
  }
}

// ── Build one comp ────────────────────────────────────────────────────────────

async function buildComp(ticker: string, cik: number): Promise<LiveComp | null> {
  const meta = TICKER_META[ticker];
  if (!meta) return null;

  // Fetch EDGAR facts and Yahoo Finance price in parallel
  const [edgar, yf] = await Promise.all([
    fetchEdgarFacts(cik),
    fetchYFPrice(ticker),
  ]);
  if (!edgar || !yf) return null;

  const usgaap = edgar.facts?.['us-gaap'] ?? {};

  // ── Revenue ────────────────────────────────────────────────────────────────
  const revPts     = tryKeys(usgaap, REV_KEYS, 2);
  if (revPts.length === 0) return null;
  const revenue    = revPts[0].val;
  const priorRev   = revPts[1]?.val ?? null;
  const revFiling  = revPts[0];

  // ── Operating Income ───────────────────────────────────────────────────────
  const opIncPts   = tryKeys(usgaap, ['OperatingIncomeLoss'], 1);
  if (opIncPts.length === 0) return null;
  const opInc      = opIncPts[0].val;

  // ── Depreciation & Amortization (cash flow add-back) ──────────────────────
  const daPts      = tryKeys(usgaap, DA_KEYS, 1);
  const da         = daPts[0]?.val ?? 0;

  // EBITDA = Operating Income + D&A
  const ebitda     = opInc + da;

  // ── Balance sheet items for EV ─────────────────────────────────────────────
  const debtPts    = tryKeys(usgaap, DEBT_KEYS, 1);
  const cashPts    = tryKeys(usgaap, CASH_KEYS, 1);
  const debt       = debtPts[0]?.val ?? 0;
  const cash       = cashPts[0]?.val ?? 0;

  // ── Enterprise Value ───────────────────────────────────────────────────────
  const marketCapB = yf.marketCapB ?? 0;
  if (marketCapB <= 0) return null;
  const ev = marketCapB * 1e9 + debt - cash;
  if (ev <= 0) return null;

  // ── Compute multiples ──────────────────────────────────────────────────────
  const evEBITDA        = ebitda > 0 ? ev / ebitda : 99;
  const evRevenue       = revenue > 0 ? ev / revenue : 0;
  const revenueGrowthPct = priorRev && priorRev > 0
    ? Math.round(((revenue - priorRev) / priorRev) * 100)
    : 0;
  const ebitdaMarginPct  = revenue > 0 ? Math.round((ebitda / revenue) * 100) : 0;

  const filing = `${revFiling.form} FY${revFiling.fy}`;

  return {
    ticker,
    name:             meta.name,
    industry:         meta.industry,
    evEBITDA:         parseFloat(Math.min(evEBITDA, 99).toFixed(1)),
    evRevenue:        parseFloat(evRevenue.toFixed(1)),
    revenueGrowthPct,
    ebitdaMarginPct,
    marketCapB:       parseFloat(marketCapB.toFixed(1)),
    secFiling:        filing,
  };
}

// ── API handler ───────────────────────────────────────────────────────────────

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PublicCompsResponse | { error: string }>
) {
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');

  // Serve from in-process cache if still fresh
  if (_cache && Date.now() - _cacheTsMs < CACHE_MS) {
    return res.json({ ..._cache, cached: true });
  }

  try {
    // Step 1: Resolve ticker → CIK mapping from EDGAR
    const cikMap = await getTickerCIKMap();

    const tickers = Object.keys(TICKER_META);
    const results: (LiveComp | null)[] = [];

    // Step 2: Build comps in batches of 5 to respect EDGAR's 10 req/s guideline
    for (let i = 0; i < tickers.length; i += 5) {
      const batch = tickers.slice(i, i + 5);
      const out = await Promise.all(
        batch.map(t => {
          const cik = cikMap[t];
          if (!cik) return Promise.resolve(null);
          return buildComp(t, cik).catch(() => null);
        })
      );
      results.push(...out);
      // Polite delay between batches
      if (i + 5 < tickers.length) {
        await new Promise(r => setTimeout(r, 400));
      }
    }

    const comps = results.filter(Boolean) as LiveComp[];
    const payload: PublicCompsResponse = {
      comps,
      asOf:         new Date().toISOString(),
      successCount: comps.length,
    };

    // Only update cache if we got a reasonable result
    if (comps.length >= 10) {
      _cache     = payload;
      _cacheTsMs = Date.now();
    }

    return res.json(payload);

  } catch (err) {
    console.error('[public-comps]', err);
    return res.status(500).json({ error: 'Market data unavailable — using static fallback.' });
  }
}
