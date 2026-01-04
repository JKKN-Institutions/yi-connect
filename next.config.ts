import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// Initialize Serwist for PWA support
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  reloadOnOnline: true,
  // Disable Serwist in development mode (Turbopack not supported)
  // See: https://github.com/serwist/serwist/issues/54
  disable: process.env.NODE_ENV !== "production",
});

const nextConfig: NextConfig = {
  // Cache components disabled - project uses React cache() instead
  // Many routes use 'force-dynamic' which conflicts with cacheComponents
  // Auth depends on cookies which is inherently dynamic
  cacheComponents: false,

  // Empty turbopack config to silence the warning about webpack config
  // Serwist uses webpack, but we need this for Next.js 16 compatibility
  turbopack: {},

  // Server-only packages that shouldn't be bundled
  // whatsapp-web.js uses Puppeteer and internal require() calls
  serverExternalPackages: [
    'whatsapp-web.js',
    'puppeteer',
    'puppeteer-core',
  ],

  // Define cache lifetime profiles for optimal performance
  cacheLife: {
    // Predefined profiles
    default: { expire: 3600 }, // 1 hour
    seconds: { expire: 5 },
    minutes: { expire: 60 },
    hours: { expire: 3600 },
    days: { expire: 86400 },
    weeks: { expire: 604800 },
    max: { expire: Number.MAX_SAFE_INTEGER },

    // Custom profiles for Yi Connect
    realtime: { expire: 1 }, // Real-time data (1 second)
    frequent: { expire: 30 }, // Frequently changing (30 seconds)
    moderate: { expire: 300 }, // Moderate updates (5 minutes)
    stable: { expire: 3600 }, // Stable data (1 hour)
  },

  // Experimental features
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Increase limit to handle base64 image uploads
    },
  },

  // Image optimization configuration (if needed for Supabase Storage)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // Redirects configuration
  // Using config redirects instead of page-level redirect() to avoid
  // Turbopack performance measurement errors (Next.js issue #86060)
  async redirects() {
    return [
      {
        source: '/members',
        destination: '/members/table',
        permanent: false, // Use temporary redirect for flexibility
      },
    ];
  },

  // Security headers for PWA
  async headers() {
    return [
      {
        // Service worker headers
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
        ],
      },
      {
        // Digital Asset Links for TWA
        source: "/.well-known/assetlinks.json",
        headers: [
          {
            key: "Content-Type",
            value: "application/json",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
      {
        // Manifest for PWA
        source: "/manifest.json",
        headers: [
          {
            key: "Content-Type",
            value: "application/json",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate",
          },
        ],
      },
      {
        // Security headers for all routes
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
