import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import Script from "next/script";
import BottomNavbar from "@/components/BottomNavbar";
import { Jua } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL, pageMeta } from "@/lib/site-meta";

// 제목·날짜·로고용 글꼴. 빌드 때 받아서 같은 도메인에서 내려준다(외부 글꼴 CDN 을 CSP 에 열지 않는다)
const jua = Jua({ weight: "400", subsets: ["latin"], display: "swap", preload: false, variable: "--font-jua" });

export const metadata: Metadata = {
  // 링크를 공유했을 때의 미리보기(Open Graph). og:image·og:url 의 상대 경로는 metadataBase 로 절대 주소가 된다.
  // 초대 링크는 app/invite/*/page.tsx 의 generateMetadata 가 모임 이름·보낸 사람으로 바꾼다
  metadataBase: new URL(SITE_URL),
  ...pageMeta({ title: SITE_TITLE, description: SITE_DESCRIPTION, path: '/' }),
  // 홈 화면에 추가하면 앱처럼(브라우저 틀 없이) 뜬다. 매니페스트는 app/manifest.ts, iOS 아이콘은 app/apple-icon.png
  applicationName: SITE_NAME,
  appleWebApp: { capable: true, title: '모여로그', statusBarStyle: 'default' },
  // Next 는 capable 을 mobile-web-app-capable 로만 내보낸다. 매니페스트를 읽지 않는 예전 iOS 를 위해 같이 둔다
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

// 상태 막대·앱 전환 화면의 바탕색(globals.css 의 --canvas)
export const viewport: Viewport = {
  themeColor: '#f5f6f3',
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
