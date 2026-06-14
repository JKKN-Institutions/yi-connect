import type { Metadata, Viewport } from "next";
import { Playfair_Display, DM_Sans, JetBrains_Mono } from "next/font/google";
import { YipBrandHeader } from "@/components/yip/brand/Header";
import { YipBrandFooter } from "@/components/yip/brand/Footer";
import { YipBugReporterWrapper } from "@/components/yip/bug-reporter-wrapper";
import { YipOfflineBanner } from "@/app/yip/_components/YipOfflineBanner";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const playfair = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const viewport: Viewport = {
  themeColor: "#FF9933",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "YIP — Young Indians Parliament",
    template: "%s · YIP",
  },
  description:
    "Empowering youth through democratic engagement. A mock parliament platform for school students (Classes 9-12) by Young Indians (Yi), CII.",
  keywords: [
    "Young Indians",
    "Yi",
    "CII",
    "YIP",
    "Young Indians Parliament",
    "mock parliament",
    "school students",
    "India",
    "Thalir",
    "Bharat Rising",
  ],
  authors: [{ name: "Young Indians (Yi), CII" }],
  openGraph: {
    title: "YIP — Young Indians Parliament",
    description:
      "Empowering youth through democratic engagement. A mock parliament platform for school students.",
    type: "website",
    locale: "en_IN",
    siteName: "YIP",
  },
  twitter: {
    card: "summary_large_image",
    title: "YIP — Young Indians Parliament",
    description: "Mock parliament platform for school students by Yi · CII.",
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
 * YIP nested layout — brand takeover for the /yip module.
 *
 * Root <html>/<body> live in app/layout.tsx (yi-connect's root). This is a
 * route-segment layout — wraps children with:
 *   - YIP-scoped PWA metadata (manifest, theme color, icons)
 *   - Font CSS variables (Playfair / DM Sans / JetBrains Mono)
 *   - Brand header + footer (saffron/white/green)
 *   - Service-worker registration (scoped to /yip/)
 *
 * Pattern mirrors app/yi-future/layout.tsx (Phase D nested-mount pattern).
 */
export default async function YipLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Staff (Supabase session) → header logo returns to the cross-app /hub.
  // Participants (jury/speaker via access-code cookie, no Supabase user) keep /yip.
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const homeHref = user ? "/hub" : "/yip";
  return (
    <>
      {/* React 19 hoists <meta>/<link> into <head> from anywhere */}
      <meta name="mobile-web-app-capable" content="yes" />
      <a href="#yip-main" className="skip-link sr-only focus:not-sr-only">
        Skip to main content
      </a>
      {/* Connection status — scoped to the YIP dashboards (student/volunteer/jury/
          organiser); hidden on the projector display + login/landing. Reconnecting
          auto-syncs (jury keeps its own score-sync badge). */}
      <YipOfflineBanner />
      <YipBugReporterWrapper>
        <div
          className={`${playfair.variable} ${dmSans.variable} ${jetbrainsMono.variable} flex min-h-screen flex-col bg-white antialiased`}
        >
          <YipBrandHeader homeHref={homeHref} />
          <main id="yip-main" className="flex-1">
            {children}
          </main>
          <YipBrandFooter />
        </div>
      </YipBugReporterWrapper>
    </>
  );
}
