import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return [
      {
        source: '/api-proxy/:path*',
        destination: `${process.env.BACKEND_INTERNAL_URL || 'http://moyeolog.kro.kr:8080'}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${process.env.BACKEND_INTERNAL_URL || 'http://moyeolog.kro.kr:8080'}/uploads/:path*`,
      },
    ];
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
