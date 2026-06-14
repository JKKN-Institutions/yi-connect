/**
 * PWA Manifest Configuration
 *
 * Dynamic manifest generation for Yi Connect PWA.
 * This file generates the web app manifest for PWA installation.
 */

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Yi Connect',
    short_name: 'Yi Connect',
    description:
      'Young Indians platform — chapter management, national events, YiFi, YiFuture, YIP. One app for everything Yi.',
    start_url: '/hub',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    theme_color: '#000066',
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
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-192x192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/icons/icon-512x512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        description: 'Chapter dashboard',
        url: '/dashboard'
      },
      {
        name: 'YiFi 2026',
        short_name: 'YiFi',
        description: 'YiFi national summit',
        url: '/yifi'
      },
      {
        name: 'YiFuture',
        short_name: 'YiFuture',
        description: 'Yi YUVA Future 6.0',
        url: '/yi-future'
      },
      {
        name: 'YIP',
        short_name: 'YIP',
        description: 'Young Indians Parliament',
        url: '/yip'
      }
    ]
  };
}
