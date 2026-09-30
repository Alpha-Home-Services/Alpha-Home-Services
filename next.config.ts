import type { NextConfig } from 'next';
// Photos are shrunk on the device first; this leaves room for a full-size 5 MB photo if shrinking fails.
const config: NextConfig = { poweredByHeader: false, experimental: { serverActions: { bodySizeLimit: '6mb' } } };
export default config;
