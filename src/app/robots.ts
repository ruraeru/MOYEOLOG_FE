import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-meta';

// 막는 경로를 두지 않는다: 링크 미리보기 수집기(Twitterbot 등)는 robots.txt 를 지켜서, 막으면 초대 링크 미리보기가 사라진다.
// 로그인이 필요한 화면은 로그인 화면으로 넘어가고, 초대 화면은 페이지에서 noindex 다
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
