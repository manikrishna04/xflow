import path from "path";
import type { NextConfig } from "next";

const useWorkerThreads =
  process.env.NEXT_WORKER_THREADS === "true" ||
  process.env.NEXT_WORKER_THREADS === "1";

const nextConfig: NextConfig = {
  experimental: {
    workerThreads: useWorkerThreads,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "api.qrserver.com",
        pathname: "/**",
      },
    ],
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
