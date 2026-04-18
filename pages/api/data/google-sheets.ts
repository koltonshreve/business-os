import type { NextApiRequest, NextApiResponse } from 'next';
import { connectGoogleSheets } from '../../../lib/data-connectors';
import type { GoogleSheetsConfig } from '../../../types';

// ─── Google OAuth helpers ──────────────────────────────────────────────────────

function getOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  });
  const data = await res.json() as { access_token: string; refresh_token?: string; expires_in: number; error?: string };
  if (data.error) throw new Error(`OAuth error: ${data.error}`);
  return data;
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json() as { access_token: string; error?: string };
  if (data.error) throw new Error(`Token refresh error: ${data.error}`);
  return data.access_token;
}

// ─── List spreadsheets ────────────────────────────────────────────────────────

async function listSpreadsheets(accessToken: string): Promise<{
  id: string; name: string; modifiedTime: string;
}[]> {
  const res = await fetch(
    'https://www.googleapis.com/drive/v3/files?q=mimeType%3D%27application%2Fvnd.google-apps.spreadsheet%27&fields=files(id,name,modifiedTime)&orderBy=modifiedTime+desc&pageSize=20',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json() as { files?: { id: string; name: string; modifiedTime: string }[] };
  return data.files ?? [];
}

async function getSheetNames(accessToken: string, spreadsheetId: string): Promise<string[]> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json() as { sheets?: { properties: { title: string } }[] };
  return data.sheets?.map(s => s.properties.title) ?? [];
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { action } = req.query;

  // Check if Google is configured
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(200).json({
      configured: false,
      message: 'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google Sheets integration',
    });
  }

  try {
    // ── Get OAuth URL ────────────────────────────────────────────────────────
    if (action === 'auth-url') {
      const state = Math.random().toString(36).slice(2);
      const url = getOAuthUrl(state);
      return res.status(200).json({ url, state, configured: true });
    }

    // ── Exchange code for token ──────────────────────────────────────────────
    if (action === 'callback' && req.method === 'POST') {
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: 'Missing code' });
      const tokens = await exchangeCodeForToken(code as string);
      return res.status(200).json({ tokens, configured: true });
    }

    // ── Refresh token ────────────────────────────────────────────────────────
    if (action === 'refresh' && req.method === 'POST') {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(400).json({ error: 'Missing refreshToken' });
      const accessToken = await refreshAccessToken(refreshToken as string);
      return res.status(200).json({ accessToken });
    }

    // ── List spreadsheets ────────────────────────────────────────────────────
    if (action === 'list-sheets' && req.method === 'POST') {
      const { accessToken } = req.body;
      if (!accessToken) return res.status(400).json({ error: 'Missing accessToken' });
      const sheets = await listSpreadsheets(accessToken as string);
      return res.status(200).json({ sheets });
    }

    // ── Get sheet names from a spreadsheet ───────────────────────────────────
    if (action === 'sheet-names' && req.method === 'POST') {
      const { accessToken, spreadsheetId } = req.body;
      if (!accessToken || !spreadsheetId) return res.status(400).json({ error: 'Missing params' });
      const names = await getSheetNames(accessToken as string, spreadsheetId as string);
      return res.status(200).json({ names });
    }

    // ── Fetch and parse data from a spreadsheet ───────────────────────────────
    if (action === 'fetch-data' && req.method === 'POST') {
      const { accessToken, spreadsheetId, sheets } = req.body as {
        accessToken: string;
        spreadsheetId: string;
        sheets: { revenue: string; costs: string; customers: string; operations?: string };
      };

      if (!accessToken || !spreadsheetId || !sheets) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      const config: GoogleSheetsConfig = {
        spreadsheetId,
        sheets: {
          revenue: sheets.revenue,
          costs: sheets.costs,
          customers: sheets.customers,
          operations: sheets.operations,
        },
        accessToken,
      };

      const data = await connectGoogleSheets(config);
      return res.status(200).json({ data, configured: true });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('Google Sheets API error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
