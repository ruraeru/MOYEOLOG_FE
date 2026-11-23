'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { SessionProvider, useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import AlertContainer from './AlertContainer';
import SessionGuard from './SessionGuard';
import { getApiErrorStatus } from '@/lib/axios';

// 세션을 주기적으로 다시 읽어 다른 기기·탭에서의 로그아웃이나 토큰 만료를 알아챕니다 (초 단위).
const SESSION_REFETCH_INTERVAL_S = 5 * 60;

/**
 * 오류가 나면 한 번만 다시 시도합니다. 단, 다시 해도 결과가 같은 4xx(401·403·404·429 등)는 재시도하지 않습니다.
 */
function shouldRetry(failureCount: number, error: unknown) {
  const status = getApiErrorStatus(error);
  if (status !== undefined && status >= 400 && status < 500) return false;
  return failureCount < 1;
}

/** 로그인한 화면에서만 하단 내비와 그 높이만큼의 여백을 둡니다. */
function AppShell({ children, bottomNav }: { children: React.ReactNode; bottomNav?: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const showNav = !!bottomNav && status === 'authenticated' && !session?.user?.error && pathname !== '/';

  return (
    <>
      <div className={`flex-1 flex flex-col ${showNav ? 'pb-16 lg:pb-0' : ''}`}>{children}</div>
      {showNav && bottomNav}
    </>
  );
}

export default function Providers({
  children,
  bottomNav,
}: {
  children: React.ReactNode;
  bottomNav?: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1분
            retry: shouldRetry,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <SessionProvider refetchInterval={SESSION_REFETCH_INTERVAL_S} refetchOnWindowFocus>
      <SessionGuard />
      <QueryClientProvider client={queryClient}>
        <AppShell bottomNav={bottomNav}>{children}</AppShell>
        <AlertContainer />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </SessionProvider>
  );
}
