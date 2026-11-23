import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 5000;

const json = (body: unknown, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * 로그인 세션 목록 (GET /api/users/me/sessions 대리 호출).
 * 리프레시 토큰은 브라우저에 내보내지 않으므로, 세션 쿠키에서 꺼내 X-Refresh-Token 으로 붙여
 * 백엔드가 '지금 이 기기' 를 표시할 수 있게 합니다.
 */
export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token || token.error || !token.accessToken) {
    return json(
      { error: 'UNAUTHORIZED', message: '로그인이 필요해요. 다시 로그인해 주세요.', status: 401 },
      401
    );
  }

  const internalApiUrl = process.env.BACKEND_INTERNAL_URL || 'http://app:8080';
  const headers: Record<string, string> = { Authorization: `Bearer ${token.accessToken}` };
  if (token.refreshToken) headers['X-Refresh-Token'] = token.refreshToken;

  try {
    const response = await fetch(`${internalApiUrl}/api/users/me/sessions`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!response.ok) {
      return json(
        body && typeof body === 'object'
          ? body
          : { error: 'UPSTREAM_ERROR', message: '로그인 기기 목록을 불러오지 못했어요.', status: response.status },
        response.status
      );
    }
    return json(Array.isArray(body) ? body : [], 200);
  } catch (error) {
    console.error('Session list failed:', error);
    return json(
      { error: 'UPSTREAM_ERROR', message: '로그인 기기 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.', status: 502 },
      502
    );
  }
}
