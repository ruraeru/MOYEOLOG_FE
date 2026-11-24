import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import Script from "next/script";
import BottomNavbar from "@/components/BottomNavbar";
import { Jua } from "next/font/google";

// 제목·날짜·로고용 글꼴. 빌드 때 받아서 같은 도메인에서 내려준다(외부 글꼴 CDN 을 CSP 에 열지 않는다)
const jua = Jua({ weight: "400", subsets: ["latin"], display: "swap", preload: false, variable: "--font-jua" });

export const metadata: Metadata = {
  title: '모여로그 | MOYEOLOG',
  description: '일정, 메모, 모임을 친구와 한곳에서 함께 쓰는 서비스',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 환경 변수 정제 (공백 제거)
  const kakaoKey = (process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY || '').trim();
  
  return (
    <html
      lang="ko"
      className={`h-full antialiased ${jua.variable}`}
    >
      <head>
        <meta httpEquiv="Content-Security-Policy" content="upgrade-insecure-requests" />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <Script
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&libraries=services&autoload=false`}
          strategy="beforeInteractive"
        />
        {/* 하단 내비는 로그인한 화면에서만 보입니다 (Providers 의 AppShell 이 결정). */}
        <Providers bottomNav={<BottomNavbar />}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
