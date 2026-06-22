import type { Metadata, Viewport } from "next";
import { Baloo_Thambi_2, Mukta_Malar } from "next/font/google";
import { VarnamHeader } from "@/app/varnam-vizha/_components/BrandHeader";
import { VarnamFooter } from "@/app/varnam-vizha/_components/BrandFooter";

// Bilingual (Tamil + English) display + body faces. Both expose the `tamil`
// subset so festival copy renders natively. Tamil strings are kept minimal in
// P0 and flagged for native review before launch.
const display = Baloo_Thambi_2({
  variable: "--font-vv-display",
  subsets: ["latin", "tamil"],
  weight: ["400", "500", "600", "700", "800"],
});

const body = Mukta_Malar({
  variable: "--font-vv-body",
  subsets: ["latin", "tamil"],
  weight: ["300", "400", "500", "600", "700"],
});

export const viewport: Viewport = {
  themeColor: "#3B0A45",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "Varnam Vizha — Erode's Festival of Colour",
    template: "%s · Varnam Vizha",
  },
  description:
    "Erode Varnam Vizha — Yi Erode's flagship cultural festival celebrating colour, art, sport and the spirit of Erode, every September.",
  keywords: [
    "Varnam Vizha",
    "Erode Varnam Vizha",
    "Yi Erode",
    "Young Indians",
    "Erode festival",
    "வர்ணம் விழா",
  ],
  authors: [{ name: "Yi Erode — Varnam Vizha" }],
  openGraph: {
    title: "Varnam Vizha — Erode's Festival of Colour",
    description:
      "Yi Erode's flagship cultural festival — eleven days of colour, art, sport and community, every September.",
    type: "website",
    locale: "en_IN",
    siteName: "Varnam Vizha",
  },
  robots: { index: true, follow: true },
};

/**
 * Varnam Vizha nested layout — brand takeover for the /varnam-vizha vertical.
 *
 * Root <html>/<body> live in app/layout.tsx. This route-segment layout wraps
 * children with the festival's own fonts, colours, header and footer. Mirrors
 * the app/yip/layout.tsx pattern.
 */
export default function VarnamLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <meta name="mobile-web-app-capable" content="yes" />
      <a href="#vv-main" className="sr-only focus:not-sr-only">
        Skip to main content
      </a>
      <div
        className={`${display.variable} ${body.variable} flex min-h-screen flex-col bg-[#FFF9F0] font-[family-name:var(--font-vv-body)] text-[#2B0A33] antialiased`}
      >
        <VarnamHeader />
        <main id="vv-main" className="flex-1">
          {children}
        </main>
        <VarnamFooter />
      </div>
    </>
  );
}
