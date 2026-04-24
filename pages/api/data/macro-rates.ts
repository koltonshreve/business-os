/**
 * /api/data/macro-rates
 *
 * Fetches live US Treasury yield data from the St. Louis Fed FRED API (no API key required).
 * Used by the DCF panel to anchor the risk-free rate component of WACC.
 *
 * Series fetched:
 *   DGS10  — 10-Year Treasury Constant Maturity Rate (daily, business days)
 *   DGS2   — 2-Year Treasury Constant Maturity Rate (daily, business days)
 *
 * FRED CSV format (no auth required):
 *   https://fred.stlouisfed.org/graph/fredgraph.csv?id={SERIES_ID}
 *   Returns: DATE,VALUE  — "." indicates no data (weekends/holidays)
 *
 * Cached 6 hours per serverless instance.
 */

import type { NextApiRequest, NextApiResponse } from 'next';

export interface MacroRatesResponse {
  tenYrYield:   number | null;   // 10-year Treasury, %
  twoYrYield:   number | null;   // 2-year Treasury, %
  asOf:         string;          // ISO timestamp of fetch
  rateDate?:    string;          // Most recent FRED data date (last business day)
  cached?:      boolean;
}

// ── In-process cache ──────────────────────────────────────────────────────────

let _cache:   MacroRatesResponse | null = null;
let _cacheTs: number = 0;
const CACHE_MS = 6 * 60 * 60 * 1000; // 6 hours

const UA = 'BusinessOS/1.0 (info@businessos.app)';

// ── FRED helpers ──────────────────────────────────────────────────────────────

interface FREDPoint { date: string; value: number }

/**
 * Fetch a FRED CSV series and return the most recent valid data point.
 * FRED uses "." to denote missing values (weekends, holidays).
 */
async function fetchFRED(seriesId: string): Promise<FREDPoint | null> {
  try {
    const resp = await fetch(
      `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8_000) }
    );
    if (!resp.ok) return null;
    const text = await resp.text();
    const lines = text.trim().split('\n');

    // Scan from the bottom (most recent) upward, skip empty/dot values
    for (let i = lines.length - 1; i >= 1; i--) {
      const [date, raw] = lines[i].split(',');
      if (!raw || raw.trim() === '.') continue;
      const value = parseFloat(raw.trim());
      if (!isNaN(value)) return { date: date.trim(), value };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(
  req:  NextApiRequest,
  res:  NextApiResponse<MacroRatesResponse | { error: string }>
) {
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=3600');

  if (_cache && Date.now() - _cacheTs < CACHE_MS) {
    return res.json({ ..._cache, cached: true });
  }

  try {
    const [tenYr, twoYr] = await Promise.all([
      fetchFRED('DGS10'),
      fetchFRED('DGS2'),
    ]);

    const payload: MacroRatesResponse = {
      tenYrYield: tenYr?.value  ?? null,
      twoYrYield: twoYr?.value  ?? null,
      rateDate:   tenYr?.date   ?? undefined,
      asOf:       new Date().toISOString(),
    };

    if (payload.tenYrYield !== null) {
      _cache   = payload;
      _cacheTs = Date.now();
    }

    return res.json(payload);

  } catch (err) {
    console.error('[macro-rates]', err);
    return res.status(500).json({ error: 'Could not fetch Treasury rates.' });
  }
}
