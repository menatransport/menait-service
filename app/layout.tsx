import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MenaIT Service",
  description: "MenaIT Service Application",
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
  themeColor: "#2563eb",
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
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" sizes="32x32" href="/logonew/ios/32.png" />
        {/* <link rel="icon" type="image/png" sizes="16x16" href="/logonew/ios/16.png" /> */}
        <link rel="shortcut icon" href="/logonew/ios/32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/logonew/ios/180.png" />
        {/* <link rel="apple-touch-icon" sizes="152x152" href="/logonew/ios/152.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/logonew/ios/120.png" /> */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
