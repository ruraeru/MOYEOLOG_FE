import type { Metadata } from 'next';

/**
 * 링크를 공유했을 때 뜨는 미리보기(Open Graph)용 사이트 정보.
 * 페이지가 openGraph 를 정의하면 layout 의 openGraph 를 통째로 덮어쓰므로(이미지·사이트 이름이 사라진다),
 * 페이지에서도 pageMeta() 로 같은 모양을 만든다.
 */
export const SITE_NAME = '모여로그';
export const SITE_TITLE = '모여로그 | MOYEOLOG';
export const SITE_DESCRIPTION = '장소 정하기부터 함께 보는 일정과 메모까지, 모임의 모든 일을 한곳에서 해결해요';
/** 사이트 주소. 빌드 때와 실행 때 모두 있는 NEXT_PUBLIC_API_URL(같은 도메인)을 쓴다 */
export const SITE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://moyeolog.ruraeru.xyz').replace(/\/+$/, '');
/** public/og.png (1200×630). 로고를 바꾸면 다시 만든다 */
const OG_IMAGE = { url: '/og.png', width: 1200, height: 630, alt: SITE_NAME, type: 'image/png' };

/**
 * 제목·설명·주소로 미리보기 메타를 만든다. path 는 '/invite/group?code=…' 같은 사이트 안 경로.
 * path 를 주지 않으면 og:url 을 넣지 않는다: layout 의 기본값이 모든 화면에 물려지므로, 여기에 주소를 넣으면
 * /help 같은 다른 화면도 og:url 이 사이트 첫 화면이 돼 수집기가 엉뚱한 주소의 (저장된) 미리보기를 쓴다.
 */
export function pageMeta({ title, description, path, noindex = false }: { title: string; description: string; path?: string; noindex?: boolean }): Metadata {
  return {
    title,
    description,
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: { type: 'website', siteName: SITE_NAME, locale: 'ko_KR', title, description, ...(path ? { url: path } : {}), images: [OG_IMAGE] },
    twitter: { card: 'summary_large_image', title, description, images: [OG_IMAGE.url] },
  };
}
