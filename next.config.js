/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Prevent clickjacking
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // XSS protection for older browsers
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Restrict referrer info
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Limit browser feature access
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  // Force HTTPS for 1 year (only active in production)
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Scripts: self + inline (needed for Next.js hydration) + PostHog
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.posthog.com https://cdn.posthog.com",
      // Styles: self + inline (Tailwind applies inline styles)
      "style-src 'self' 'unsafe-inline'",
      // Images: self + data URIs (for SVG/chart thumbnails)
      "img-src 'self' data: blob: https:",
      // Fonts: self
      "font-src 'self'",
      // Connect: self + Anthropic API (server-side only, but SSE hits the same origin) + Neon + PostHog
      "connect-src 'self' https://api.anthropic.com https://app.posthog.com",
      // Workers: self (for any web-worker future use)
      "worker-src 'self' blob:",
      // Frames: none
      "frame-src 'none'",
      // Objects: none
      "object-src 'none'",
      // Base: self
      "base-uri 'self'",
      // Form action: self
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig = {
  reactStrictMode: true,
  experimental: { serverComponentsExternalPackages: ['@anthropic-ai/sdk'] },

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },

  async rewrites() {
    return [
      { source: '/sitemap.xml', destination: '/api/sitemap' },
    ];
  },
};

module.exports = nextConfig;
