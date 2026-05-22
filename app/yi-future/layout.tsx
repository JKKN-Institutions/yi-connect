import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { BugReporterWrapper } from "@/components/yi-future/bug-reporter-wrapper";
import { InstallPrompt } from "@/components/yi-future/pwa/InstallPrompt";
import { UpdatePrompt } from "@/components/yi-future/pwa/UpdatePrompt";

export const viewport: Viewport = {
  themeColor: "#1a1a3e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  manifest: "/yi-future/manifest.json",
  icons: {
    icon: [
      { url: "/yi-future/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/yi-future/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/yi-future/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "YiFuture",
  },
  title: {
    default: "YiFuture — Future 6.0 | Yi YUVA",
    template: "%s · Future 6.0 · Yi YUVA",
  },
  description:
    "A 90-day mentored youth policy & solutions journey. Yi YUVA's flagship program for college students, powered by Young Indians and CII.",
  keywords: [
    "Yi YUVA",
    "Young Indians",
    "CII",
    "Future 6.0",
    "policy",
    "college students",
    "India",
    "youth policy",
  ],
  authors: [{ name: "Yi YUVA" }],
  openGraph: {
    title: "Future 6.0 · Yi YUVA",
    description:
      "A 90-day mentored youth policy & solutions journey. From opinions to impact.",
    type: "website",
    locale: "en_IN",
    siteName: "YiFuture",
  },
  twitter: {
    card: "summary_large_image",
    title: "Future 6.0 · Yi YUVA",
    description: "A 90-day mentored youth policy & solutions journey.",
  },
  robots: {
    index: true,
    follow: true,
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

const splashImages: Array<{ href: string; media: string }> = [
  { href: "/yi-future/splash/apple-splash-2048-2732.png", media: "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  { href: "/yi-future/splash/apple-splash-1668-2388.png", media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  { href: "/yi-future/splash/apple-splash-1536-2048.png", media: "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  { href: "/yi-future/splash/apple-splash-1640-2360.png", media: "(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  { href: "/yi-future/splash/apple-splash-1668-2224.png", media: "(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  { href: "/yi-future/splash/apple-splash-1620-2160.png", media: "(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  { href: "/yi-future/splash/apple-splash-1488-2266.png", media: "(device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  { href: "/yi-future/splash/apple-splash-1320-2868.png", media: "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { href: "/yi-future/splash/apple-splash-1206-2622.png", media: "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { href: "/yi-future/splash/apple-splash-1260-2736.png", media: "(device-width: 420px) and (device-height: 912px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { href: "/yi-future/splash/apple-splash-1290-2796.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { href: "/yi-future/splash/apple-splash-1179-2556.png", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { href: "/yi-future/splash/apple-splash-1170-2532.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { href: "/yi-future/splash/apple-splash-1284-2778.png", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { href: "/yi-future/splash/apple-splash-1125-2436.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { href: "/yi-future/splash/apple-splash-1242-2688.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { href: "/yi-future/splash/apple-splash-828-1792.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  { href: "/yi-future/splash/apple-splash-1242-2208.png", media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { href: "/yi-future/splash/apple-splash-750-1334.png", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  { href: "/yi-future/splash/apple-splash-640-1136.png", media: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
];

/**
 * YiFuture nested layout (Phase D port).
 *
 * Root <html>/<body> live in app/layout.tsx (yi-connect's root). This is a
 * route-segment layout — only wraps children + adds YiFuture-scoped PWA
 * splash <link>s (auto-hoisted to <head> by React 19), the BugReporter,
 * install/update prompts, and the service-worker registration script.
 */
export default function YiFutureLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {/* React 19 hoists <link>/<meta> from anywhere into <head> */}
      <meta name="mobile-web-app-capable" content="yes" />
      {splashImages.map((s) => (
        <link key={s.href} rel="apple-touch-startup-image" href={s.href} media={s.media} />
      ))}
      <a href="#yi-future-main" className="skip-link">
        Skip to main content
      </a>
      <BugReporterWrapper>
        <div id="yi-future-main">{children}</div>
      </BugReporterWrapper>
      <InstallPrompt />
      <UpdatePrompt />
      <Script id="yi-future-sw-reg" strategy="afterInteractive">
        {`if ('serviceWorker' in navigator) {
          window.addEventListener('load', function () {
            navigator.serviceWorker.register('/yi-future/sw.js', { scope: '/yi-future/' }).catch(function () {});
          });
        }`}
      </Script>
    </>
  );
}
