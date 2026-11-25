/**
 * 초대 링크의 미리보기 정보(모임 이름·인원, 친구 닉네임). 서버 컴포넌트의 generateMetadata 에서만 부른다.
 * 메신저·SNS 의 미리보기 수집기는 로그인하지 않으므로, 프론트 서버가 내부 비밀값으로 백엔드에 묻는다
 * (GET /api/auth/link-preview, nginx 가 /api/auth 를 프론트로 보내 외부에서는 닿지 않는다).
 * 실패·없는 코드는 null: 페이지는 이름 없는 기본 문구로 미리보기를 만든다.
 */
export interface LinkPreview {
  name: string;
  description: string | null;
  memberCount: number | null;
  ownerNickname: string | null;
}

export async function fetchLinkPreview(type: 'group' | 'friend', code: string | undefined): Promise<LinkPreview | null> {
  const value = (code || '').trim();
  if (!value || value.length > 64) return null;
  const base = process.env.BACKEND_INTERNAL_URL || 'http://app:8080';
  try {
    const res = await fetch(`${base}/api/auth/link-preview?type=${type}&code=${encodeURIComponent(value)}`, {
      headers: { 'X-Internal-Secret': process.env.INTERNAL_API_SECRET ?? '' },
      cache: 'no-store',
      // 미리보기 수집기는 오래 기다리지 않는다. 늦으면 기본 문구로 답한다
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as LinkPreview;
    return typeof data?.name === 'string' && data.name ? data : null;
  } catch {
    return null;
  }
}

/** 미리보기 문구에 넣을 글자를 한 줄로 줄인다 */
export const clip = (text: string | null | undefined, max: number) => {
  const flat = (text || '').replace(/\s+/g, ' ').trim();
  return [...flat].length > max ? `${[...flat].slice(0, max).join('')}…` : flat;
};
