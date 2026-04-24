import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCSVUpload, mergeDataSources } from '../../../lib/data-connectors';
import type { CSVUpload, UnifiedBusinessData } from '../../../types';
import { getSessionUser } from '../../../lib/session';

export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { uploads, existingData } = req.body as {
      uploads: CSVUpload[];
      existingData?: UnifiedBusinessData;
    };

    if (!uploads?.length) return res.status(400).json({ error: 'No uploads provided' });

    const results: { type: string; filename: string; rowCount: number; warnings: string[] }[] = [];
    const parsed: Partial<UnifiedBusinessData>[] = [];

    const VALID_TYPES = ['revenue', 'costs', 'customers', 'operations', 'pipeline', 'payroll', 'cashflow', 'ar_aging', 'transactions', 'suppliers', 'capacity'];
    for (const upload of uploads) {
      if (!VALID_TYPES.includes(upload.type)) {
        return res.status(400).json({ error: `Invalid upload type: ${upload.type}` });
      }

      const data = parseCSVUpload(upload);
      parsed.push(data);

      // Count rows for feedback
      const rows = upload.content.split('\n').length - 1;
      results.push({
        type: upload.type,
        filename: upload.filename,
        rowCount: rows,
        warnings: [],
      });
    }

    // Merge with existing data if provided
    const sources = existingData ? [existingData, ...parsed] : parsed;
    const merged = mergeDataSources(sources as UnifiedBusinessData[]);

    return res.status(200).json({
      data: merged,
      results,
      summary: {
        totalUploads: uploads.length,
        completeness: merged.metadata.completeness,
        warnings: merged.metadata.warnings,
      },
    });
  } catch (err) {
    console.error('CSV upload error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
