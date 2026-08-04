import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: "sl-studio-le",
  project: "javascript-nextjs",
  // No SENTRY_AUTH_TOKEN configured yet — source map upload is skipped (stack traces will show
  // minified code until one's added), everything else works fine without it.
  silent: true,
  widenClientFileUpload: true,
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: true,
  },
});
