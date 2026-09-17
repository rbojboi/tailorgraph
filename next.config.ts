import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com", port: "", pathname: "/listings/**", search: "" }],
    qualities: [75, 85],
    deviceSizes: [640, 750, 828, 1080, 1200, 1600, 1920, 2400],
    imageSizes: [64, 96, 128, 192, 256, 384],
    formats: ["image/webp"]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb"
    }
  }
};

export default nextConfig;
