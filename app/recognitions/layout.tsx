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
  title: { default: "Yi Recognitions", template: "%s · Yi Recognitions" },
  description: "Take Pride: national chapter awards of Young Indians.",
  applicationName: "Yi Recognitions",
  manifest: "/recognitions-assets/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Yi Recognitions", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/recognitions-assets/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/recognitions-assets/icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    siteName: "Yi Recognitions",
    title: "Yi Recognitions",
    description: "Take Pride: national chapter awards of Young Indians.",
  },
  twitter: { card: "summary", title: "Yi Recognitions", description: "Take Pride: national chapter awards." },
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
