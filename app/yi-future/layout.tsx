import type { Metadata, Viewport } from "next";
import { BugReporterWrapper } from "@/components/yi-future/bug-reporter-wrapper";

export const viewport: Viewport = {
  themeColor: "#1a1a3e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
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

/**
 * YiFuture nested layout.
 * PWA registration handled by root Yi Connect layout.
 */
export default function YiFutureLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <a href="#yi-future-main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-1 focus:bg-navy focus:text-ivory focus:rounded">
        Skip to main content
      </a>
      <BugReporterWrapper>
        <div id="yi-future-main">{children}</div>
      </BugReporterWrapper>
    </>
  );
}
