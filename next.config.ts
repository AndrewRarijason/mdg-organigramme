import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  // Binaires Chromium (≈ 70 Mo) inclus uniquement dans la fonction d'export PDF
  outputFileTracingIncludes: {
    '/api/export-pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
  },
};

export default nextConfig;
