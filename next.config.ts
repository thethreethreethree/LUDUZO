import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Gym logo uploads (Settings) POST an image through a server action; default is 1MB.
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
