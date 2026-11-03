import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Next's workspace root inside this app (avoids picking up parent lockfiles).
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
