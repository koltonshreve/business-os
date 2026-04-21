// ─── OG Image ─────────────────────────────────────────────────────────────────
// Returns a simple SVG served as image/svg+xml for social previews.
// For production-quality raster OG images, replace with @vercel/og.

import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#060a12"/>
  <rect x="0" y="0" width="1200" height="630" fill="url(#bg)"/>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0d1117"/>
      <stop offset="100%" stop-color="#060a12"/>
    </linearGradient>
    <linearGradient id="bar1" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>
  </defs>

  <!-- Grid lines -->
  <line x1="80" y1="460" x2="1120" y2="460" stroke="#1e293b" stroke-width="1"/>
  <line x1="80" y1="380" x2="1120" y2="380" stroke="#1e293b" stroke-width="1" stroke-dasharray="4 4"/>
  <line x1="80" y1="300" x2="1120" y2="300" stroke="#1e293b" stroke-width="1" stroke-dasharray="4 4"/>

  <!-- Bar chart -->
  <rect x="140" y="360" width="80" height="100" rx="6" fill="#1e3a5f" opacity="0.8"/>
  <rect x="270" y="320" width="80" height="140" rx="6" fill="#1e3a5f" opacity="0.8"/>
  <rect x="400" y="290" width="80" height="170" rx="6" fill="#6366f1" opacity="0.9"/>
  <rect x="530" y="250" width="80" height="210" rx="6" fill="#6366f1"/>
  <rect x="660" y="220" width="80" height="240" rx="6" fill="#6366f1"/>
  <rect x="790" y="190" width="80" height="270" rx="6" fill="#4f46e5"/>
  <rect x="920" y="160" width="80" height="300" rx="6" fill="#4338ca"/>

  <!-- Trend line -->
  <polyline points="180,380 310,340 440,305 570,265 700,232 830,200 960,168"
    fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="960" cy="168" r="6" fill="#10b981"/>

  <!-- Logo mark -->
  <rect x="80" y="80" width="48" height="48" rx="10" fill="#6366f1"/>
  <rect x="92" y="92" width="10" height="10" rx="2" fill="white"/>
  <rect x="106" y="92" width="10" height="10" rx="2" fill="white"/>
  <rect x="92" y="106" width="10" height="10" rx="2" fill="white"/>
  <rect x="106" y="106" width="10" height="10" rx="2" fill="white"/>

  <!-- Title -->
  <text x="144" y="114" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" fill="#f1f5f9">Business OS</text>

  <!-- Tagline -->
  <text x="80" y="530" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="700" fill="#f1f5f9">AI-powered intelligence</text>
  <text x="80" y="572" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="700" fill="#94a3b8">for LMM operators.</text>

  <!-- Stat chips -->
  <rect x="820" y="510" width="140" height="40" rx="8" fill="#1e293b"/>
  <text x="890" y="535" text-anchor="middle" font-family="system-ui, sans-serif" font-size="13" fill="#6366f1" font-weight="600">AI CFO Advisor</text>
  <rect x="975" y="510" width="145" height="40" rx="8" fill="#1e293b"/>
  <text x="1047" y="535" text-anchor="middle" font-family="system-ui, sans-serif" font-size="13" fill="#10b981" font-weight="600">Live Dashboard</text>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  res.status(200).send(svg);
}
