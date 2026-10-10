import type { Metadata, Viewport } from "next";
import { Figtree, Marcellus, Spline_Sans_Mono } from "next/font/google";

// MUST stay imported: an unimported per-app stylesheet is dead CSS.
import "./recognitions.css";

/**
 * Yi Recognitions has its own identity end to end: own faces, palette,
 * favicon (./icon.svg), manifest and titles. Nothing from the host app's
 * chrome renders here. The faces are scoped to this route via CSS variables
 * so they never leak into any other app on the same deployment.
 */
const display = Marcellus({ weight: "400", subsets: ["latin"], variable: "--font-rx-display", display: "swap" });
const body = Figtree({ subsets: ["latin"], variable: "--font-rx-body", display: "swap" });
const mono = Spline_Sans_Mono({ subsets: ["latin"], variable: "--font-rx-mono", display: "swap" });

export const viewport: Viewport = {
  themeColor: "#12372a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  // Share previews must point at Recognitions' own address, not the shared host.
  metadataBase: new URL("https://yi-recognitions.vercel.app"),
  title: { default: "Yi Recognitions", template: "%s · Yi Recognitions" },
  description: "Take Pride: national chapter awards of Young Indians.",
  applicationName: "Yi Recognitions",
  manifest: "/recognitions-assets/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Yi Recognitions", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/recognitions-assets/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/recognitions-assets/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/recognitions-assets/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: "Yi Recognitions",
    title: "Yi Recognitions",
    description: "Take Pride: national chapter awards of Young Indians.",
    images: [{ url: "/recognitions-assets/og.png", width: 1200, height: 630, alt: "Young Indians logo beside the words Yi Recognitions, Chapter awards 2026" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Yi Recognitions",
    description: "Take Pride: national chapter awards of Young Indians.",
    images: ["/recognitions-assets/og.png"],
  },
  authors: [{ name: "Young Indians" }],
  creator: "Young Indians",
  publisher: "Young Indians",
  other: { "msapplication-TileColor": "#12372a" },
  robots: { index: false, follow: false },
};

export default function RecognitionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`rx-root ${display.variable} ${body.variable} ${mono.variable}`}>{children}</div>
  );
}
