import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  eslint: {
    // ESLint dijalankan terpisah via `npm run lint`; skip saat build agar
    // tidak menghambat CI karena konflik eslint-config-next v16 + ESLint v9 flat config.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

