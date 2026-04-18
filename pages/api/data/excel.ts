import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCSVUpload, mergeDataSources } from '../../../lib/data-connectors';
import type { CSVUpload, UnifiedBusinessData } from '../../../types';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, accessToken, fileId, sheetName, dataType, csvContent, filename, existingData } = req.body;

  // ── CSV content from xlsx client-side conversion ────────────────────────────
  if (action === 'import-csv') {
    if (!csvContent || !dataType) return res.status(400).json({ error: 'Missing csvContent or dataType' });
    try {
      const upload: CSVUpload = { type: dataType as CSVUpload['type'], filename: filename || 'excel.csv', content: csvContent };
      const parsed = parseCSVUpload(upload);
      const merged = mergeDataSources([existingData ?? {}, parsed]) as UnifiedBusinessData;
      merged.metadata.sources = [
        ...(existingData?.metadata?.sources?.filter((s: string) => !s.startsWith('Excel:')) ?? []),
        `Excel: ${filename ?? 'upload'}`,
      ];
      return res.json({ data: merged, rowCount: csvContent.trim().split('\n').length - 1 });
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Parse error' });
    }
  }

  // ── Microsoft OneDrive / Excel Online (Graph API) ──────────────────────────
  if (action === 'list-files') {
    if (!accessToken) return res.status(400).json({ error: 'No access token' });
    try {
      // Search OneDrive for Excel files
      const r = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/search(q='.xlsx')?$select=id,name,lastModifiedDateTime&$top=50`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!r.ok) return res.status(r.status).json({ error: `Graph API error: ${r.statusText}` });
      const body = await r.json() as { value: { id: string; name: string; lastModifiedDateTime: string }[] };
      return res.json({ files: body.value ?? [] });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to list Excel files' });
    }
  }

  if (action === 'list-sheets') {
    if (!accessToken || !fileId) return res.status(400).json({ error: 'Missing accessToken or fileId' });
    try {
      const r = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!r.ok) return res.status(r.status).json({ error: `Graph API error: ${r.statusText}` });
      const body = await r.json() as { value: { id: string; name: string }[] };
      return res.json({ sheets: body.value ?? [] });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to list worksheets' });
    }
  }

  if (action === 'fetch-sheet') {
    if (!accessToken || !fileId || !sheetName || !dataType) {
      return res.status(400).json({ error: 'Missing required params' });
    }
    try {
      // Get used range from the worksheet
      const r = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets/${encodeURIComponent(sheetName)}/usedRange`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!r.ok) return res.status(r.status).json({ error: `Graph API error: ${r.statusText}` });
      const body = await r.json() as { values: string[][] };

      // Convert 2D array to CSV
      const csvContent = (body.values ?? [])
        .map(row => row.map(cell => {
          const s = String(cell ?? '');
          return s.includes(',') ? `"${s}"` : s;
        }).join(','))
        .join('\n');

      const upload: CSVUpload = { type: dataType as CSVUpload['type'], filename: `${sheetName}.csv`, content: csvContent };
      const parsed = parseCSVUpload(upload);
      const merged = mergeDataSources([existingData ?? {}, parsed]) as UnifiedBusinessData;
      merged.metadata.sources = [
        ...(existingData?.metadata?.sources?.filter((s: string) => !s.startsWith('Excel:')) ?? []),
        `Excel Online: ${sheetName}`,
      ];
      return res.json({ data: merged, rowCount: (body.values?.length ?? 1) - 1 });
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch sheet data' });
    }
  }

  // ── Auth URL ────────────────────────────────────────────────────────────────
  if (action === 'auth-url') {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    if (!clientId) return res.json({ configured: false });
    const redirectUri = `${process.env.NEXTAUTH_URL ?? ''}/api/data/excel-callback`;
    const scope = encodeURIComponent('Files.Read offline_access');
    const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_mode=query`;
    return res.json({ url, configured: true });
  }

  if (action === 'callback') {
    const { code } = req.body;
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXTAUTH_URL ?? ''}/api/data/excel-callback`;
    if (!clientId || !clientSecret) return res.status(500).json({ error: 'Microsoft OAuth not configured' });
    const body = new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      code, redirect_uri: redirectUri, grant_type: 'authorization_code',
    });
    const r = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    });
    const tokens = await r.json();
    return res.json({ tokens });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
