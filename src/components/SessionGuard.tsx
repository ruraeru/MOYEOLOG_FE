'use client';

import { useEffect, useRef } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { UNAUTHORIZED_EVENT } from '@/lib/axios';

// 401이 연달아 발생해도 세션 재확인은 이 간격에 한 번만 수행합니다 (무한 루프 방지).
const RECHECK_INTERVAL_MS = 15 * 1000;

/**
 * 세션 상태를 감시하는 컴포넌트입니다.
 * - 세션에 오류(RefreshAccessTokenError 등)가 실려 있으면 로그아웃시켜
 *   "로그인된 것처럼 보이지만 모든 요청이 401"인 상태에 머무르지 않게 합니다.
 * - API가 401을 반환하면 세션을 다시 조회해 토큰 갱신(또는 위의 로그아웃)을 유도합니다.
 */
export default function SessionGuard() {
  const { data: session, status, update } = useSession();
  const signingOut = useRef(false);
  const lastRecheck = useRef(0);
  const updateRef = useRef(update);
  const statusRef = useRef(status);

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
    const handleUnauthorized = () => {
      if (statusRef.current !== 'authenticated' || signingOut.current) return;
      const now = Date.now();
      if (now - lastRecheck.current < RECHECK_INTERVAL_MS) return;
      lastRecheck.current = now;
      // 인자 없이 호출하면 서버에서 세션을 다시 읽어옵니다 (만료된 토큰은 이때 갱신됨).
      updateRef.current().catch(() => {});
    };

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  return null;
}
