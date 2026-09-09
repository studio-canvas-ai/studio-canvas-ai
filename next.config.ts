import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  serverExternalPackages: ["sharp", "ffmpeg-static", "googleapis"],
  // Ensure the FFmpeg binary is bundled with the extract-hooks serverless function.
  outputFileTracingIncludes: {
    "/api/shorts/extract-hooks": ["./node_modules/ffmpeg-static/**/*"],
  },
  // FFmpeg.wasm (client) — allow packing / dynamic import without Node polyfills.
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
};

export default nextConfig;
