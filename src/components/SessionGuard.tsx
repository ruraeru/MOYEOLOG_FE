'use client';

import { useEffect, useRef } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { UNAUTHORIZED_EVENT } from '@/lib/axios';

// 401이 연달아 발생해도 세션 재확인은 이 간격에 한 번만 수행합니다 (무한 루프 방지).
const RECHECK_INTERVAL_MS = 15 * 1000;

/** 로그인 화면으로 완전히 새로 이동합니다 (로그아웃 전에 받아 둔 라우터 캐시를 쓰지 않도록). */
function goToLogin() {
  const { pathname, search } = window.location;
  if (pathname === '/') {
    window.location.replace('/');
    return;
  }
  const callbackUrl = encodeURIComponent(`${pathname}${search}`);
  window.location.replace(`/?callbackUrl=${callbackUrl}`);
}

/**
 * 세션 상태를 감시하는 컴포넌트입니다.
 * - 세션에 오류(RefreshAccessTokenError, BackendRejectedToken 등)가 실려 있으면 로그아웃시켜
 *   "로그인된 것처럼 보이지만 모든 요청이 401"인 상태에 머무르지 않게 합니다.
 * - API가 401을 반환하면 서버에서 토큰을 다시 확인합니다(만료 전이라도 백엔드가 거부하면 갱신, 안 되면 오류 → 로그아웃).
 * - 다른 탭에서 로그아웃해 이 탭의 세션이 사라지면 로그인 화면으로 보냅니다.
 */
export default function SessionGuard() {
  const { data: session, status, update } = useSession();
  const signingOut = useRef(false);
  const lastRecheck = useRef(0);
  const updateRef = useRef(update);
  const statusRef = useRef(status);
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    updateRef.current = update;
    statusRef.current = status;
  }, [update, status]);

  const sessionError = session?.user?.error;

  useEffect(() => {
    if (status !== 'authenticated' || !sessionError || signingOut.current) return;
    signingOut.current = true;
    signOut({ callbackUrl: '/' });
  }, [status, sessionError]);

  useEffect(() => {
    if (status === 'authenticated') {
      wasAuthenticated.current = true;
      return;
    }
    // 비밀번호 재설정 화면은 저장한 뒤 스스로 로그아웃하고 완료 안내를 보여 준다(그 화면은 로그인 없이 쓴다)
    if (window.location.pathname.startsWith('/reset-password')) return;
    if (status === 'unauthenticated' && wasAuthenticated.current && !signingOut.current) {
      // 다른 탭에서 로그아웃함(next-auth 가 탭 사이에 알려 줌) 또는 세션 쿠키가 만료됨
      signingOut.current = true;
      goToLogin();
    }
  }, [status]);

  useEffect(() => {
    const handleUnauthorized = () => {
      if (statusRef.current !== 'authenticated' || signingOut.current) return;
      const now = Date.now();
      if (now - lastRecheck.current < RECHECK_INTERVAL_MS) return;
      lastRecheck.current = now;
      // 서버(jwt 콜백)가 백엔드에 토큰을 확인하고, 거부되면 갱신하거나 세션을 오류 상태로 만듭니다.
      updateRef.current({ revalidate: true }).catch(() => {});
    };

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  return null;
}

