import NextAuth from 'next-auth';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import {
  authOptions,
  createAuthOptions,
  KAKAO_LINK_COOKIE,
  KAKAO_LINK_COOKIE_PATH,
  LINK_ERROR_URL,
  type KakaoLinkRequest,
} from '@/lib/auth';

type RouteContext = { params: Promise<{ nextauth: string[] }> };

/**
 * 카카오 콜백에 연결 쿠키(link-intent)가 실려 오면 연결 모드로 처리합니다.
 * - 쿠키의 사용자와 지금 세션(오류 없음)의 사용자가 같을 때만 연결한다. 어긋나면 sync 하지 않고 LinkFailed.
 * - 연결에 성공하면 Location 을 설정 화면(linked=kakao)으로 바꿉니다(성공 표시는 여기서만 붙는다).
 *   그 밖의 결과(카카오 동의 취소 등 signIn 까지 오지 않은 경우 포함)는 모두 linkError 주소로 보낸다.
 * - 쿠키는 결과와 관계없이 한 번 쓰고 지웁니다.
 */
async function handler(req: NextRequest, ctx: RouteContext) {
  const linkUserId = req.cookies.get(KAKAO_LINK_COOKIE)?.value;
  if (!linkUserId || !req.nextUrl.pathname.endsWith('/callback/kakao')) {
    return NextAuth(req, ctx, authOptions);
  }

  const link: KakaoLinkRequest = {};
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token && !token.error && token.accessToken && String(token.userId) === linkUserId) {
    link.accessToken = token.accessToken;
  }

  const response: Response = await NextAuth(req, ctx, createAuthOptions(link));
  if (link.redirect) {
    response.headers.set('Location', link.redirect);
  } else if (!response.headers.get('Location')?.startsWith(LINK_ERROR_URL)) {
    // 연결 모드는 실패해도 세션 쿠키를 만들지 않는다(signIn 이 문자열 반환). 오류 화면 대신 설정으로.
    response.headers.set('Location', `${LINK_ERROR_URL}LinkFailed`);
  }
  const secure = process.env.NEXTAUTH_URL?.startsWith('https://') ? '; Secure' : '';
  response.headers.append(
    'Set-Cookie',
    `${KAKAO_LINK_COOKIE}=; Path=${KAKAO_LINK_COOKIE_PATH}; Max-Age=0; HttpOnly; SameSite=Lax${secure}`
  );
  return response;
}

export { handler as GET, handler as POST };
