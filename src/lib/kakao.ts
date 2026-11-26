/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Kakao 지도 SDK 의 services(장소 검색) 를 쓸 수 있게 될 때까지 기다린다.
 * layout 이 `autoload=false` 로 SDK 를 불러오므로 `kakao.maps.load()` 를 부르기 전에는 `kakao.maps.services` 가 없다.
 * SDK 가 아예 없으면(키·도메인 문제) null.
 */
export function loadKakaoServices(): Promise<any | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const kakao = (window as any).kakao;
  if (!kakao?.maps) return Promise.resolve(null);
  if (kakao.maps.services) return Promise.resolve(kakao);
  if (typeof kakao.maps.load !== 'function') return Promise.resolve(null);
  return new Promise((resolve) => kakao.maps.load(() => resolve(kakao.maps.services ? kakao : null)));
}

/** '숙대입구역' → '숙대입구역으로', '서울역' → '서울역으로', '카페' → '카페로'. 한글이 아니면 '(으)로' */
export function withEuro(word: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (!last || code < 0 || code > 11171) return `${word}(으)로`;
  const final = code % 28;
  return final === 0 || final === 8 ? `${word}로` : `${word}으로`;
}
