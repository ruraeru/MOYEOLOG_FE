import type { NextConfig } from "next";

type RemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

/**
 * next/image 최적화(/_next/image)가 받아 올 수 있는 외부 이미지 출처.
 * - 우리 서비스의 업로드 파일 (NEXT_PUBLIC_API_URL 도메인의 /uploads/)
 * - 카카오 프로필 사진 (k.kakaocdn.net, img1.kakaocdn.net 등. 오래된 계정은 http 주소)
 * 그 밖의 호스트(카카오 이미지 검색 결과 등)는 /api/proxy-image 를 거치거나 unoptimized 로 직접 불러옵니다.
 */
function buildRemotePatterns(): RemotePattern[] {
  const patterns: RemotePattern[] = [
    { protocol: "https", hostname: "moyeolog.ruraeru.xyz", pathname: "/uploads/**" },
    { protocol: "https", hostname: "*.kakaocdn.net" },
    { protocol: "http", hostname: "*.kakaocdn.net" },
  ];

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    try {
      const { protocol, hostname, port } = new URL(apiUrl);
      if ((protocol === "https:" || protocol === "http:") && hostname !== "moyeolog.ruraeru.xyz") {
        patterns.push({
          protocol: protocol === "https:" ? "https" : "http",
          hostname,
          ...(port ? { port } : {}),
          pathname: "/uploads/**",
        });
      }
    } catch {
      // 잘못된 값이면 기본 출처만 허용합니다.
    }
  }
  return patterns;
}

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: buildRemotePatterns(),
  },
};

export default nextConfig;
