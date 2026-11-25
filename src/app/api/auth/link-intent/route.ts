import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { KAKAO_LINK_COOKIE, KAKAO_LINK_COOKIE_PATH } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LINK_INTENT_MAX_AGE_S = 5 * 60;

/**
 * 설정 화면의 '카카오 연결' 시작 (POST, 로그인 필요).
 * 5분짜리 쿠키를 심어 두면, 이어지는 카카오 로그인 콜백을 [...nextauth]/route.ts 가 연결 모드로 처리합니다.
 * 세션 쿠키가 SameSite=Lax 라 다른 사이트에서 보낸 POST 는 세션이 없어 401 이 됩니다.
 */
export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token || token.error || !token.accessToken || !token.userId) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: '로그인이 필요해요. 다시 로그인해 주세요.', status: 401 },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const response = new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(KAKAO_LINK_COOKIE, String(token.userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NEXTAUTH_URL?.startsWith('https://') ?? false,
    path: KAKAO_LINK_COOKIE_PATH,
    maxAge: LINK_INTENT_MAX_AGE_S,
  });
  return response;
}
