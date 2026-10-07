import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
// sonner is the single toast library for the whole app. Exactly one provider
// is mounted; a second toast library would carry its own independent store, so
// mixing two makes one library's toasts silently no-op.
import { Toaster as SonnerToaster } from 'sonner';
import { Analytics } from '@vercel/analytics/next';
import { ServiceWorkerRegister } from '@/components/pwa/sw-register';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { UpdatePrompt } from '@/components/pwa/update-prompt';
import { MobileNav } from '@/components/mobile-nav';

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
  // These used to be hand-written <meta>/<link> tags in <head> below. As
  // metadata they render identically, and a nested app with its own brand
  // (e.g. /recognitions) can override them; hand-written tags it could not.
  other: {
    'mobile-web-app-capable': 'yes',
    'msapplication-TileColor': '#3b82f6'
  }
  // Manifest is automatically handled by Next.js 16 via app/manifest.ts
  // No need to explicitly declare it here
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
        <MobileNav />
        <SonnerToaster position='top-right' richColors closeButton />
        <ServiceWorkerRegister />
        <InstallPrompt />
        <UpdatePrompt />
        <Analytics />
      </body>
    </html>
  );
}
