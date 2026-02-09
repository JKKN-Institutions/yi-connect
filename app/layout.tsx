import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
});

// PWA Viewport Configuration
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#3b82f6' },
    { media: '(prefers-color-scheme: dark)', color: '#1d4ed8' }
  ]
};

// Metadata with PWA enhancements
export const metadata: Metadata = {
  title: {
    default: 'Yi Connect',
    template: '%s | Yi Connect'
  },
  description:
    'Comprehensive Yi Chapter Management System for unified member operations, events, finance, communication, and leadership.',
  keywords: [
    'Yi',
    'chapter management',
    'events',
    'members',
    'finance',
    'communication'
  ],
  authors: [{ name: 'Yi Connect Team' }],
  creator: 'Yi Connect',
  publisher: 'Yi Connect',
  formatDetection: {
    email: false,
    address: false,
    telephone: false
  },
  // PWA specific metadata
  applicationName: 'Yi Connect',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Yi Connect'
  },
  // Open Graph
  openGraph: {
    type: 'website',
    siteName: 'Yi Connect',
    title: 'Yi Connect - Chapter Management System',
    description:
      'Comprehensive Yi Chapter Management System for unified member operations, events, finance, communication, and leadership.'
  },
  // Twitter
  twitter: {
    card: 'summary_large_image',
    title: 'Yi Connect',
    description: 'Yi Chapter Management System'
  },
  // Icons - using SVG
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' }
    ],
    apple: [{ url: '/icons/apple-touch-icon.svg', type: 'image/svg+xml' }]
  },
  // Manifest
  manifest: '/manifest.webmanifest'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        {/* PWA Meta Tags */}
        <meta name='mobile-web-app-capable' content='yes' />
        <meta name='apple-mobile-web-app-capable' content='yes' />
        <meta name='apple-mobile-web-app-status-bar-style' content='default' />
        <meta name='apple-mobile-web-app-title' content='Yi Connect' />

        {/* Favicons */}
        <link rel='icon' href='/favicon.svg' type='image/svg+xml' />
        <link
          rel='icon'
          href='/icons/icon.svg'
          type='image/svg+xml'
          sizes='any'
        />

        {/* Apple Touch Icons */}
        <link rel='apple-touch-icon' href='/icons/apple-touch-icon.svg' />

        {/* MS Tile */}
        <meta name='msapplication-TileColor' content='#3b82f6' />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
        <Toaster position='top-right' />
      </body>
    </html>
  );
}
