import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable Cache Components and PPR
  cacheComponents: true,

  // Configure cache lifecycle profiles
  cacheLife: {
    // Predefined profiles
    default: { expire: 3600 },           // 1 hour
    seconds: { expire: 5 },              // 5 seconds
    minutes: { expire: 60 },             // 1 minute
    hours: { expire: 3600 },             // 1 hour
    days: { expire: 86400 },             // 1 day
    weeks: { expire: 604800 },           // 1 week
    months: { expire: 2592000 },         // 30 days
    max: { expire: Number.MAX_SAFE_INTEGER },

    // Custom profiles for your application
    realtime: { expire: 1 },             // Real-time data (1 second)
    frequent: { expire: 30 },            // Frequently changing (30 seconds)
    moderate: { expire: 300 },           // Moderate updates (5 minutes)
    stable: { expire: 3600 },            // Stable data (1 hour)
    static: { expire: 31536000 },        // Static content (1 year)
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      // Add other remote image sources here
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Turbopack configuration (optional)
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },

  // Compiler options
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  },
}

export default nextConfig
