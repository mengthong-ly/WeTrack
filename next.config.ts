import type { NextConfig } from "next"

// standalone: the staging droplet runs .next/standalone/server.js (deploy/staging-release.sh).
const nextConfig: NextConfig = { output: "standalone" }

export default nextConfig
