import type { NextConfig } from 'next';
// Photos are shrunk on the device first; this leaves room for a full-size 5 MB photo if shrinking fails.
// Dev server only: lets a phone on the local Wi-Fi (192.168.x.x) load the app's scripts when testing.
const config: NextConfig = { poweredByHeader: false, allowedDevOrigins: ['192.168.*.*'], experimental: { serverActions: { bodySizeLimit: '6mb' } } };
export default config;
