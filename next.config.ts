import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.kakao.com",
      },
      {
        protocol: "https",
        hostname: "*.daumcdn.net",
      },
      {
        protocol: "https",
        hostname: "*.kakaocdn.net",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
  },
};

export default nextConfig;
