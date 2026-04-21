import type { NextApiRequest, NextApiResponse } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://business-os-three-sand.vercel.app';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const urls = ['/', '/auth'];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${BASE}${u}</loc></url>`).join('\n')}
</urlset>`;
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, s-maxage=3600');
  res.status(200).send(xml);
}
