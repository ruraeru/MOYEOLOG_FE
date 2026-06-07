import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import Script from "next/script";
import BottomNavbar from "@/components/BottomNavbar";

export const metadata: Metadata = {
  title: '모여로그 | MOYEOLOG',
  description: '일정, 메모, 모임을 한곳에서 관리하는 스마트 협업 플랫폼',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 환경 변수 정제 (공백 및 비가시 문자 제거)
  const kakaoKey = (process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY || '').trim().replace(/[^a-z0-9]/gi, '');
  
  return (
    <html
      lang="ko"
      className="h-full antialiased"
    >
      <head>
        <meta httpEquiv="Content-Security-Policy" content="upgrade-insecure-requests" />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <Script
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&libraries=services&autoload=false`}
          strategy="beforeInteractive"
        />
        <Providers>
          <div className="flex-1 flex flex-col pb-16 lg:pb-0">
            {children}
          </div>
          <BottomNavbar />
        </Providers>
      </body>
    </html>
  );
}
