import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';
import { safeCallbackPath } from '@/lib/url-safety';

/**
 * next-auth의 withAuth는 signIn 페이지('/')에서는 감싼 함수를 실행하지 않기 때문에
 * 로그인한 사용자를 '/'에서 '/memo'로 보내는 리다이렉트가 동작하지 않습니다.
 * 그래서 getToken으로 직접 세션 쿠키를 확인하되, 보호 규칙은 withAuth와 동일하게 유지합니다.
 * - '/' : 누구나 접근 가능. 로그인 상태면 callbackUrl(없으면 /memo)로 리다이렉트
 * - 그 외 matcher 경로 : 토큰이 없으면 '/?callbackUrl=원래경로'로 리다이렉트
 */
export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname, search } = req.nextUrl;

  if (pathname === '/') {
    // 오류 상태의 세션(리프레시 실패 등)은 클라이언트에서 로그아웃 처리되므로 리다이렉트하지 않습니다.
    if (token && !token.error) {
      const target = safeCallbackPath(req.nextUrl.searchParams.get('callbackUrl'));
      return NextResponse.redirect(new URL(target, req.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    const signInUrl = new URL('/', req.url);
    signInUrl.searchParams.set('callbackUrl', `${pathname}${search}`);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/home/:path*',
    '/memo/:path*',
    '/schedule/:path*',
    '/groups/:path*',
    '/friends/:path*',
    '/notifications/:path*',
    '/settings/:path*',
  ],
};
