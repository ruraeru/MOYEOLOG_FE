import type { MetadataRoute } from 'next';

/**
 * 홈 화면에 추가했을 때 브라우저 틀(주소창·도구 막대) 없이 앱처럼 뜨게 한다.
 * 색은 globals.css 의 --canvas 와 맞춘다. 아이콘 PNG 는 app/icon.svg 에서 만든 것이다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '모여로그',
    short_name: '모여로그',
    description: '일정, 메모, 모임을 친구와 한곳에서 함께 쓰는 서비스',
    lang: 'ko',
    // 로그인 전이면 미들웨어가 로그인 화면으로 보낸다
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f6f3',
    theme_color: '#f5f6f3',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
