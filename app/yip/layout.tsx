import type { Metadata, Viewport } from "next";
import { Playfair_Display, DM_Sans, JetBrains_Mono } from "next/font/google";
import { PWARegister } from "@/components/yip/pwa-register";

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

export const metadata: Metadata = {
  title: "YIP Platform — Young Indians Parliament",
  description:
    "Empowering youth through democratic engagement. A mock parliament platform for school students by Young Indians (Yi), CII.",
  manifest: "/yip/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "YIP",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FF9933",
};

/**
 * YIP nested layout (Phase D port).
 *
 * Root <html>/<body> live in app/layout.tsx (yi-connect's root). This is a
 * route-segment layout — only wraps children and applies YIP-scoped font
 * CSS variables + the PWA registration script.
 */
export default function YipLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${playfair.variable} ${dmSans.variable} ${jetbrainsMono.variable} min-h-full flex flex-col`}
    >
      {children}
      <PWARegister />
    </div>
  );
}
