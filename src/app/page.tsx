'use client';

import { useSyncExternalStore, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { safeCallbackPath } from '@/lib/url-safety';
import { Ribbon } from '@/components/ui';
import { getThemeColors } from '@/lib/utils';

const emptySubscribe = () => () => {};

/**
 * 로그인 후 돌아갈 경로. callbackUrl 쿼리가 같은 사이트 내 상대 경로일 때만 사용하고, 아니면 /memo로 보냅니다.
 */
const getCallbackPath = () =>
  safeCallbackPath(new URLSearchParams(window.location.search).get('callbackUrl'));

const getLoginError = () => new URLSearchParams(window.location.search).get('error');

/** 오른쪽 미리보기 카드에 쓰는 예시 일정(화면 설명용) */
const PREVIEW_ROWS = [
  { day: '오늘', time: '14:00', title: '캡스톤 2차 정기 회의', meta: '캡스톤 디자인 3조 · 공학관 302호', theme: 'emerald', people: ['윤', '오', '한', '정'] },
  { day: '내일', time: '19:30', title: '12월에 읽을 책 고르기', meta: '느린 책장 · 연남동 카페', theme: 'amber', people: ['서', '민', '정'] },
  { day: '금요일', time: '20:00', title: '풋살 정기전', meta: '풋살하는 사람들 · 망원 유수지', theme: 'orange', people: ['준', '태', '정'] },
];

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
    <main className="flex min-h-screen items-center bg-canvas px-6 py-12 lg:px-16">
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-16 lg:grid-cols-[minmax(0,1fr)_620px]">
        {/* 왼쪽: 로고, 제목, 설명, 카카오 버튼 */}
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="h-[22px] w-[3px] rounded-full bg-mark" />
            <span className="font-display text-2xl leading-none text-ink">모여로그</span>
          </div>

          <h1 className="mt-8 font-display text-[36px] leading-[48px] text-ink lg:text-[52px] lg:leading-[64px]">
            모임의 메모와 일정을
            <br />
            한곳에 모아요
          </h1>
          <p className="mt-6 max-w-[480px] text-base leading-relaxed text-ink-2 lg:text-lg">
            친구와 모임을 만들고, 회의록과 약속을 같이 쓰고, 토픽에서 이야기해요
          </p>

          {loginError && (
            <p role="alert" className="mt-6 w-full max-w-[400px] rounded-[10px] bg-negative-soft px-4 py-3 text-sm text-negative">
              로그인에 실패했어요. 잠시 후 다시 시도해 주세요.
            </p>
          )}

          <button
            onClick={() => signIn('kakao', { callbackUrl: getCallbackPath() })}
            className="mt-8 flex h-12 items-center justify-center gap-2 rounded-[10px] bg-[#FEE500] px-6 text-[15px] font-medium text-[#191919] transition-[background-color,transform] hover:bg-[#FEE500]/90 active:scale-[0.98] max-sm:w-full"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 3C6.477 3 2 6.48 2 10.8c0 2.8 1.88 5.25 4.72 6.57-.19.7-.7 2.54-.8 2.92-.12.46.16.45.34.33.14-.09 2.24-1.52 3.14-2.13.84.23 1.73.35 2.64.35 5.523 0 10-3.48 10-7.8S17.523 3 12 3z" />
            </svg>
            카카오로 시작하기
          </button>
          <p className="mt-4 text-[13px] text-ink-3">처음이면 가입도 함께 돼요</p>
        </div>

        {/* 오른쪽: 앱 미리보기 (넓은 화면만) */}
        <div aria-hidden className="hidden rounded-2xl border border-line bg-surface p-8 shadow-float lg:block">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-[26px] leading-8 text-ink">11월 23일 월요일</p>
              <p className="mt-1 text-[13px] text-ink-2">이번 주 일정 5개</p>
            </div>
            <span className="btn-primary pointer-events-none">
              <Plus size={16} strokeWidth={1.5} />
              일정 추가
            </span>
          </div>

          <ul className="mt-4 divide-y divide-line border-b border-line">
            {PREVIEW_ROWS.map((row) => (
              <li key={row.title} className="flex items-center gap-4 py-4">
                <span className="w-14 shrink-0 font-display text-[15px] text-ink">{row.day}</span>
                <span className="w-12 shrink-0 text-sm tabular-nums text-ink-2">{row.time}</span>
                <Ribbon color={getThemeColors(row.theme).hex} className="h-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[15px] leading-5 text-ink">{row.title}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-3">{row.meta}</p>
                </div>
                <div className="flex shrink-0 -space-x-1.5">
                  {row.people.map((p, i) => (
                    <span key={i} className="flex size-6 items-center justify-center rounded-full border-2 border-surface bg-raised text-[11px] text-ink-2">
                      {p}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex gap-3 rounded-xl border border-line bg-raised px-5 py-4">
            <Ribbon color={getThemeColors('emerald').hex} className="self-stretch" />
            <div className="min-w-0">
              <p className="font-display text-[15px] leading-5 text-ink">1차 회의록 - 기능 범위 정하기</p>
              <p className="mt-1 truncate text-[13px] text-ink-2">메모·일정·모임 세 기능으로 범위를 확정했다. 발표는 12월 12일</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
