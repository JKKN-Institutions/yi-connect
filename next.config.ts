import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable Cache Components and PPR (Partial Prerendering)
  cacheComponents: true,

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
};

export default nextConfig;
