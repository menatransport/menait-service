import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/404notfound",
  },
  workboxOptions: {
    disableDevLogs: true,
  },
})({
  turbopack: {},
});

export default nextConfig;
