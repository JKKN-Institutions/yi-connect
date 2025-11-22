/**
 * PWA Manifest Configuration
 *
 * Dynamic manifest generation for Yi Connect PWA.
 * This file generates the web app manifest for PWA installation.
 */

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
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
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any'
      },
      {
        src: '/icons/icon-192x192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any'
      },
      {
        src: '/icons/icon-512x512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any'
      }
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        description: 'Go to dashboard',
        url: '/m'
      },
      {
        name: 'Events',
        short_name: 'Events',
        description: 'View upcoming events',
        url: '/m/events'
      },
      {
        name: 'Check-in',
        short_name: 'Check-in',
        description: 'Quick event check-in',
        url: '/m/checkin'
      },
      {
        name: 'Profile',
        short_name: 'Profile',
        description: 'View your profile',
        url: '/m/profile'
      }
    ]
  };
}
