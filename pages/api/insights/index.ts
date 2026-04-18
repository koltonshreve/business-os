import { NextApiRequest, NextApiResponse } from 'next';
import { KPIEngine } from '../../../lib/kpi-engine';
import {
  generateWeeklyInsight, generateBoardDeck,
  generateAlerts, analyzeAnomalies
} from '../../../lib/ai-insights';
import { parseCSVUpload, mergeDataSources } from '../../../lib/data-connectors';
import type { UnifiedBusinessData, CSVUpload } from '../../../types';

export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { action, data, previousData, csvUploads, reportType } = req.body as {
      action: 'compute-kpis' | 'weekly-insight' | 'board-deck' | 'alerts' | 'full-report';
      data: UnifiedBusinessData;
      previousData?: UnifiedBusinessData;
      csvUploads?: CSVUpload[];
      reportType?: string;
    };

    // Merge CSV uploads if provided
    let businessData = data;
    if (csvUploads?.length) {
      const parsedSources = csvUploads.map(u => parseCSVUpload(u));
      businessData = mergeDataSources([data, ...parsedSources]);
    }

    if (!businessData) return res.status(400).json({ error: 'No data provided' });

    const engine = new KPIEngine(businessData, previousData);
    const dashboard = engine.buildDashboard();

    switch (action) {
      case 'compute-kpis':
        return res.status(200).json({ dashboard });

      case 'weekly-insight': {
        const enrichedAnomalies = dashboard.anomalies.length
          ? await analyzeAnomalies(dashboard.anomalies, businessData)
          : [];
        dashboard.anomalies = enrichedAnomalies;

        const insight = await generateWeeklyInsight(businessData, dashboard, previousData);
        return res.status(200).json({ dashboard, insight });
      }

      case 'alerts': {
        const alertData = await generateAlerts(dashboard);
        return res.status(200).json({ alerts: alertData.alerts, dashboard });
      }

      case 'board-deck': {
        const deck = await generateBoardDeck(businessData, dashboard);
        return res.status(200).json({ deck, dashboard });
      }

      case 'full-report': {
        // Run everything in parallel where possible
        const enrichedAnomalies = dashboard.anomalies.length
          ? await analyzeAnomalies(dashboard.anomalies, businessData)
          : [];
        dashboard.anomalies = enrichedAnomalies;

        const [insight, deck, alertData] = await Promise.all([
          generateWeeklyInsight(businessData, dashboard, previousData),
          generateBoardDeck(businessData, dashboard),
          generateAlerts(dashboard),
        ]);

        return res.status(200).json({
          dashboard,
          insight,
          deck,
          alerts: alertData.alerts,
          metadata: businessData.metadata,
        });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('Business OS API error:', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
