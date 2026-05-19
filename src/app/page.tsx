'use client';

import { useSyncExternalStore, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';

const emptySubscribe = () => () => {};

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/memo');
    }
  }, [status, router]);

  if (!isMounted || status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F9FB]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </main>
    );
  }

  if (status === 'authenticated') return null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F8F9FB] p-6">
      <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-10 shadow-xl">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#6366F1] shadow-lg shadow-indigo-200">
            <Calendar className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-3xl font-black text-gray-900">모여로그</h1>
          <p className="max-w-sm text-sm font-medium leading-relaxed text-gray-500">
            일정, 메모, 모임을 한곳에서 관리하세요.
            <br />
            카카오 계정으로 간편하게 시작할 수 있습니다.
          </p>
        </div>

        <button
          onClick={() => signIn('kakao', { callbackUrl: '/memo' })}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#FEE500] px-8 py-4 text-lg font-bold text-[#191919] shadow-md transition-all hover:bg-[#FEE500]/90 hover:scale-[1.02]"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 3C6.477 3 2 6.48 2 10.8c0 2.8 1.88 5.25 4.72 6.57-.19.7-.7 2.54-.8 2.92-.12.46.16.45.34.33.14-.09 2.24-1.52 3.14-2.13.84.23 1.73.35 2.64.35 5.523 0 10-3.48 10-7.8S17.523 3 12 3z" />
          </svg>
          카카오로 시작하기
        </button>
      </div>
    </main>
  );
}
