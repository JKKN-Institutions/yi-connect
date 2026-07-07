import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";

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

  // 2026-07-07: Vercel PRODUCTION builds deadlock at the "Running TypeScript"
  // step (preview builds of the same commit + cache pass in ~2 min; two prod
  // builds in a row hit the 45-min kill). Skip Vercel's type-check step —
  // `npx tsc --noEmit` on the main tree remains this repo's authoritative
  // type gate before every PR (see CLAUDE.md). REVERT once Vercel prod
  // builders stop hanging.
  typescript: { ignoreBuildErrors: true },

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
        permanent: false,
      },
      {
        source: '/chapter/:path*',
        destination: '/yi-future/chapter/:path*',
        permanent: true,
      },
      {
        source: '/national/:path*',
        destination: '/yi-future/national/:path*',
        permanent: true,
      },
      {
        source: '/host/:path*',
        destination: '/yi-future/host/:path*',
        permanent: true,
      },
      // YIP convenience redirects (2026-05-28) — users typing/bookmarking the
      // bare /dashboard/admin/* paths get sent to /yip/dashboard/admin/*. The
      // yi-connect top-level (dashboard) route group has no /dashboard/admin
      // tree of its own; the YIP admin is the only sensible destination.
      {
        source: '/dashboard/admin/:path*',
        destination: '/yip/dashboard/admin/:path*',
        permanent: true,
      },
      {
        source: '/dashboard/admin',
        destination: '/yip/dashboard/admin',
        permanent: true,
      },
    ];
  },

  // Rewrites configuration
  // Phase E (Agent M, 2026-05-22): Legacy path support for YiFuture API routes.
  // YiFuture standalone used to expose these at /api/*. After the Phase D port
  // they live at /yi-future/api/*. External integrations (cron schedulers,
  // OAuth callbacks, OG image consumers) that hard-coded the old bare paths
  // will silently 404 on the new domain. These rewrites preserve compatibility
  // by mapping the legacy bare paths to the new namespaced paths.
  //
  // Externally addressable (the ones that actually matter):
  //   /api/cron/drain-emails              → vercel.json cron schedule
  //   /api/whitepapers/[id]/pdf           → public whitepaper download links
  //   /api/join/card/[id]/og              → OG image for shared join cards
  //   /api/consent/pdf, /consent/blank-pdf → email links sent to delegates
  //   /api/compendium/[editionSlug]/pdf   → public compendium download links
  //   /api/finalists/[eventId]/csv|pdf    → host-shared roster links
  //   /api/csv/[scope]                    → admin export links bookmarked by users
  //   /api/auth/signout                   → form action target
  //
  // None of these paths conflict with yi-connect's own /api namespaces
  // (yi-connect uses /api/admin, /api/events, /api/whatsapp, /api/yi-creative,
  // /api/verticals, /api/expand-url, /api/bug-reporter, /api/activity-templates).
  async rewrites() {
    return [
      {
        source: '/api/cron/:path*',
        destination: '/yi-future/api/cron/:path*',
      },
      {
        source: '/api/whitepapers/:path*',
        destination: '/yi-future/api/whitepapers/:path*',
      },
      {
        source: '/api/join/card/:path*',
        destination: '/yi-future/api/join/card/:path*',
      },
      {
        source: '/api/consent/:path*',
        destination: '/yi-future/api/consent/:path*',
      },
      {
        source: '/api/compendium/:path*',
        destination: '/yi-future/api/compendium/:path*',
      },
      {
        source: '/api/finalists/:path*',
        destination: '/yi-future/api/finalists/:path*',
      },
      {
        source: '/api/csv/:path*',
        destination: '/yi-future/api/csv/:path*',
      },
      {
        source: '/api/auth/signout',
        destination: '/yi-future/api/auth/signout',
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

// Wrap with Serwist (PWA) first, then Sentry (source map upload + tunnel).
// Sentry options here are deliberately minimal — the SDK auto-instruments
// based on the instrumentation.ts / instrumentation-client.ts files.
// NOTE: source-map upload is disabled in this commit; enable via SENTRY_AUTH_TOKEN
// and a real org/project when production observability is wired up.
const sentryOptions = {
  // Suppress build-time warnings when DSN/auth token are not configured.
  silent: true,
  // Don't upload source maps until org/project/auth are set by the director.
  disableLogger: true,
  widenClientFileUpload: false,
  tunnelRoute: undefined,
};

export default withSentryConfig(withSerwist(nextConfig), sentryOptions);
