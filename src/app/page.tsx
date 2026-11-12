'use client';

import { useSyncExternalStore, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { safeCallbackPath } from '@/lib/url-safety';

const emptySubscribe = () => () => {};

/**
 * 로그인 후 돌아갈 경로. callbackUrl 쿼리가 같은 사이트 내 상대 경로일 때만 사용하고, 아니면 /memo로 보냅니다.
 */
const getCallbackPath = () =>
  safeCallbackPath(new URLSearchParams(window.location.search).get('callbackUrl'));

const getLoginError = () => new URLSearchParams(window.location.search).get('error');

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const sessionError = session?.user?.error;

  useEffect(() => {
    // 오류 상태의 세션은 SessionGuard가 로그아웃시키므로 이동하지 않습니다.
    if (status === 'authenticated' && !sessionError) {
      router.push(getCallbackPath());
    }
  }, [status, sessionError, router]);

  if (!isMounted || status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </main>
    );
  }

  if (status === 'authenticated') return null;

  const loginError = getLoginError();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas p-6">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-accent">
            <Calendar size={24} strokeWidth={1.5} className="text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-ink">모여로그</h1>
          <p className="max-w-sm text-sm leading-relaxed text-ink-2">
            일정, 메모, 모임을 한곳에서 함께 써요.
            <br />
            카카오 계정으로 바로 시작할 수 있어요.
          </p>
        </div>

        {loginError && (
          <p role="alert" className="mb-4 rounded-[10px] bg-negative-soft px-4 py-3 text-center text-sm text-negative">
            로그인에 실패했어요. 잠시 후 다시 시도해 주세요.
          </p>
        )}

        <button
          onClick={() => signIn('kakao', { callbackUrl: getCallbackPath() })}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-[#FEE500] px-6 text-sm font-medium text-[#191919] transition-[background-color,transform] hover:bg-[#FEE500]/90 active:scale-[0.98]"
        >
          <svg className="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 3C6.477 3 2 6.48 2 10.8c0 2.8 1.88 5.25 4.72 6.57-.19.7-.7 2.54-.8 2.92-.12.46.16.45.34.33.14-.09 2.24-1.52 3.14-2.13.84.23 1.73.35 2.64.35 5.523 0 10-3.48 10-7.8S17.523 3 12 3z" />
          </svg>
          카카오로 시작하기
        </button>
      </div>
    </main>
  );
}
