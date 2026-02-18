import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
})({
  turbopack: {},
  // Performance optimizations
  reactStrictMode: true,
  compress: true,
  // bundle-barrel-imports: Tree-shake heavy packages
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-label',
      '@radix-ui/react-separator',
      '@radix-ui/react-tabs',
      '@radix-ui/react-switch',
    ],
  },
});

export default nextConfig;
