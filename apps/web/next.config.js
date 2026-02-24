const { resolve } = require('path');

// Load .env from monorepo root so Next.js picks up NEXT_PUBLIC_* vars at build time
require('dotenv').config({ path: resolve(__dirname, '../../.env') });

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@pageforge/shared'],
};

module.exports = nextConfig;
