import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#000066",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "YiFi 2026 — Built for Generations",
    template: "%s · YiFi 2026",
  },
  description:
    "Young Indians' national Entrepreneurship & Finance Summit. 500 founders, personalised routing, one room — 500 different summits.",
  keywords: [
    "YiFi",
    "Young Indians",
    "CII",
    "entrepreneurship",
    "finance",
    "summit",
    "Madurai",
    "Built for Generations",
  ],
  authors: [{ name: "Yi Erode" }],
  openGraph: {
    title: "YiFi 2026 — Built for Generations",
    description:
      "500 founders. Personalised routing. One room — 500 different summits.",
    type: "website",
    locale: "en_IN",
    siteName: "YiFi",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function YiFiLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <a href="#yifi-main" className="skip-link">
        Skip to main content
      </a>
      <div id="yifi-main">{children}</div>
    </>
  );
}
