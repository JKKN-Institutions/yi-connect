/**
 * PWA Manifest API Route
 *
 * Serves manifest.json for PWA installation and Bubblewrap TWA initialization.
 * This route ensures the manifest is accessible at /manifest.json
 */

import { NextResponse } from 'next/server'
import type { MetadataRoute } from 'next'

// Import the manifest function from app/manifest.ts
// Note: This is a workaround since Next.js manifest.ts might not generate properly in some deployments
function generateManifest(): MetadataRoute.Manifest {
  return {
    name: 'Yi Connect - Chapter Management System',
    short_name: 'Yi Connect',
    description:
      'Comprehensive Yi Chapter Management System for unified member operations, events, finance, communication, and leadership.',
    start_url: '/m',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    theme_color: '#3b82f6',
    background_color: '#ffffff',
    categories: ['productivity', 'business', 'social'],
    lang: 'en',
    dir: 'ltr',
    prefer_related_applications: false,
    icons: [
      // SVG icon for modern browsers
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      // PNG icons for Android TWA and older browsers
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      // Maskable icons for Android adaptive icons (with safe area padding)
      {
        src: '/icons/icon-192x192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        description: 'Go to dashboard',
        url: '/m',
      },
      {
        name: 'Events',
        short_name: 'Events',
        description: 'View upcoming events',
        url: '/m/events',
      },
      {
        name: 'Check-in',
        short_name: 'Check-in',
        description: 'Quick event check-in',
        url: '/m/checkin',
      },
      {
        name: 'Profile',
        short_name: 'Profile',
        description: 'View your profile',
        url: '/m/profile',
      },
    ],
  }
}

export async function GET() {
  const manifest = generateManifest()

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  })
}

// Enable Edge Runtime for faster responses
export const runtime = 'edge'
