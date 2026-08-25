import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";

// MUST stay imported — an unimported per-vertical stylesheet is dead CSS.
import "./yiq.css";

/**
 * YIQ nested layout. PWA registration is handled by the root Yi Connect
 * layout — do not re-register here.
 *
 * The display face is scoped to this route group via a CSS variable so it
 * never leaks into /yip, /yi-future or the main dashboard.
 */
const display = Bricolage_Grotesque({
  variable: "--font-yiq-display",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0A1633",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "YIQ — Young Indians Quiz",
    template: "%s · YIQ",
  },
  description:
    "India's national school quiz championship for Classes 9–12. Chapter Championship to National Grand Finale. A flagship Young Indians programme.",
  keywords: [
    "YIQ",
    "Young Indians Quiz",
    "school quiz",
    "Young Indians",
    "CII",
    "quiz competition",
    "India",
    "Class 9",
    "Class 12",
  ],
  authors: [{ name: "Young Indians" }],
  openGraph: {
    title: "YIQ — Young Indians Quiz",
    description:
      "India's Brightest Minds. One National Stage. Classes 9–12, Chapter to National.",
    type: "website",
    locale: "en_IN",
    siteName: "YIQ",
  },
  twitter: {
    card: "summary_large_image",
    title: "YIQ — Young Indians Quiz",
    description: "India's Brightest Minds. One National Stage.",
  },
  robots: { index: true, follow: true },
};

export default function YiqLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${display.variable} yiq-root`}>
      <a href="#yiq-main" className="yiq-skip">
        Skip to content
      </a>
      {children}
    </div>
  );
}
