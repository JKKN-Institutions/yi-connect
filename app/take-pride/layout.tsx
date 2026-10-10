import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Figtree } from "next/font/google";

// MUST stay imported: an unimported per-app stylesheet is dead CSS.
import "./take-pride.css";

/**
 * Take Pride 2026 has its own identity: the deck's condensed caps, the
 * tricolour base strip and the 1% Shift bars. Faces are scoped to this route
 * via CSS variables so they never leak into other apps on the deployment.
 */
const display = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-tp-display", display: "swap" });
const body = Figtree({ subsets: ["latin"], variable: "--font-tp-body", display: "swap" });

export const viewport: Viewport = {
  themeColor: "#f4f2ee",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: { default: "Take Pride 2026", template: "%s · Take Pride 2026" },
  description: "Take Pride 2026 · The 1% Shift · 18–19 December, Bengaluru.",
  robots: { index: false, follow: false },
};

export default function TakePrideLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`tp-root ${display.variable} ${body.variable}`}>
      {children}
      <div className="tp-strip" aria-hidden="true">
        <i /> <i /> <i />
      </div>
    </div>
  );
}
