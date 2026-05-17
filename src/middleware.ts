import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    if (req.nextUrl.pathname === '/' && req.nextauth.token) {
      return NextResponse.redirect(new URL('/memo', req.url));
    }
  },
  {
    pages: {
      signIn: '/',
    },
    callbacks: {
      authorized: ({ token, req }) => {
        if (req.nextUrl.pathname === '/') return true;
        return !!token;
      },
    },
  }
);

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
