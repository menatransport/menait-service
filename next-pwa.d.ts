declare module '@ducanh2912/next-pwa' {
  import { NextConfig } from 'next';

  interface WorkboxOptions {
    disableDevLogs?: boolean;
    [key: string]: unknown;
  }

  interface PWAConfig {
    dest?: string;
    disable?: boolean;
    register?: boolean;
    scope?: string;
    sw?: string;
    skipWaiting?: boolean;
    runtimeCaching?: unknown[];
    publicExcludes?: string[];
    buildExcludes?: (string | RegExp)[];
    cacheOnFrontEndNav?: boolean;
    reloadOnOnline?: boolean;
    fallbacks?: {
      document?: string;
      image?: string;
      audio?: string;
      video?: string;
      font?: string;
    };
    cacheStartUrl?: boolean;
    dynamicStartUrl?: boolean;
    dynamicStartUrlRedirect?: string;
    customWorkerDir?: string;
    customWorkerSrc?: string;
    customWorkerDest?: string;
    customWorkerPrefix?: string;
    workboxOptions?: WorkboxOptions;
  }

  function withPWA(config: PWAConfig): (nextConfig: NextConfig) => NextConfig;

  export default withPWA;
}
