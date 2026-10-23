import type { NextConfig } from "next"

// standalone: the staging droplet runs .next/standalone/server.js (deploy/staging-release.sh).
// cacheComponents + partialPrefetching: links prefetch each route's shell (layout chrome and its
// loading.tsx), so a click paints at once and the signed-in data streams in.
const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  experimental: { agentUpgrade: "security" },
}

export default nextConfig
