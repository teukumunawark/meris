import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ['@opentelemetry/api', '@opentelemetry/sdk-node'],
};

export default nextConfig;
