import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, IBM_Plex_Sans_Thai, Noto_Sans_Thai, Prompt } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SessionProvider } from "@/app/context/SessionContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

/** Card / list titles: compact, very legible Thai + Latin at small sizes (font-title) */
const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["500", "600"],
});

const promptThai = Prompt({
  variable: "--font-prompt",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "MenaIT Service",
  description: "MenaIT Service — IT, OPS & Finance service hub",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MenaIT Service",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#1c6ef2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <head>
        <link rel="icon" type="image/svg+xml" href="/mascot.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/mascot/32.png" />
        {/* <link rel="icon" type="image/png" sizes="16x16" href="/logonew/ios/16.png" /> */}
        <link rel="shortcut icon" href="/mascot/32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/mascot/180.png" />
        {/* <link rel="apple-touch-icon" sizes="152x152" href="/logonew/ios/152.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/logonew/ios/120.png" /> */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoThai.variable} ${promptThai.variable} ${plexThai.variable} antialiased overflow-hidden`}
      >
        <SessionProvider>
          {children}
        </SessionProvider>
        {/* page views / visitors → Vercel dashboard (enable Analytics on the project first) */}
        <Analytics />
      </body>
    </html>
  );
}
