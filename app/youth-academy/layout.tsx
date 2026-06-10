import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#0f2557",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "Yi Youth Academy | Yi YUVA",
    template: "%s · Yi Youth Academy",
  },
  description:
    "Cohort-based certificate programs in Entrepreneurship, Innovation & Learning for students in the Yi YUVA network — powered by Young Indians and CII.",
  keywords: [
    "Yi Youth Academy",
    "Yi YUVA",
    "Young Indians",
    "CII",
    "certificate programs",
    "college students",
    "India",
  ],
  authors: [{ name: "Yi YUVA" }],
  openGraph: {
    title: "Yi Youth Academy · Yi YUVA",
    description:
      "Cohort-based certificate programs for students in the Yi YUVA network.",
    type: "website",
    locale: "en_IN",
    siteName: "Yi Youth Academy",
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
 * Yi Youth Academy nested layout (vertical root).
 * PWA registration handled by root Yi Connect layout.
 */
export default function YouthAcademyLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <a
        href="#youth-academy-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-1 focus:bg-slate-900 focus:text-white focus:rounded"
      >
        Skip to main content
      </a>
      <div id="youth-academy-main">{children}</div>
    </>
  );
}
