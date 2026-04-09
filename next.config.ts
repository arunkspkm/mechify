import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Creates a self-contained build for Docker (smaller image, no node_modules needed)
  output: "standalone",
  // Only allow local images (product photos from public/uploads/)
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
