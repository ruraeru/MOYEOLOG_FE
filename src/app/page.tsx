'use client';

import { useSyncExternalStore, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';
import { Eye, EyeOff, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { safeCallbackPath } from '@/lib/url-safety';
import { normalizeEmail } from '@/lib/account-api';
import { Ribbon } from '@/components/ui';
import { Logo } from '@/components/Logo';
import { getThemeColors } from '@/lib/utils';

const emptySubscribe = () => () => {};

/**
 * 로그인 후 돌아갈 경로. callbackUrl 쿼리가 같은 사이트 내 상대 경로일 때만 사용하고, 아니면 /home으로 보냅니다.
 */
const getCallbackPath = () =>
  safeCallbackPath(new URLSearchParams(window.location.search).get('callbackUrl'));

const getLoginError = () => new URLSearchParams(window.location.search).get('error');

/** 이메일 폼을 펼쳤는지·입력한 이메일을 기억해 가입·비밀번호 찾기에서 뒤로 와도 그대로 두는 키 */
const EMAIL_FORM_KEY = 'login-email-form';

/** 아주 기본적인 형식 검사(@ 앞뒤에 글자, 뒤에 점). 실제 확인은 서버가 한다 */
const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** NextAuth 오류 코드 → 문구. CredentialsSignin·TooManyAttempts 는 auth.ts 의 credentials 로그인이 낸다 */
const loginErrorMessage = (code: string | null | undefined) => {
  // 백엔드는 잠금(10회 실패)도 계정 유무를 숨기려고 같은 401 을 준다. 그래서 두 경우를 한 문구로 알린다.
  if (code === 'CredentialsSignin')
    return '이메일 또는 비밀번호가 올바르지 않아요. 여러 번 틀렸다면 10분 동안 로그인이 막힐 수 있어요.';
  if (code === 'AccessDenied') return '카카오 로그인을 취소했어요. 다시 시작하려면 카카오로 시작하기를 눌러 주세요.';
  if (code === 'TooManyAttempts') return '로그인 시도가 너무 많아요. 잠시 후 다시 시도해 주세요.';
  return '로그인에 실패했어요. 잠시 후 다시 시도해 주세요.';
};

/** 오른쪽 미리보기 카드에 쓰는 예시 일정(화면 설명용) */
const PREVIEW_ROWS = [
  { day: '오늘', time: '14:00', title: '캡스톤 2차 정기 회의', meta: '캡스톤 디자인 3조 · 공학관 302호', theme: 'emerald', people: ['윤', '오', '한', '정'] },
  { day: '내일', time: '19:30', title: '12월에 읽을 책 고르기', meta: '느린 책장 · 연남동 카페', theme: 'amber', people: ['서', '민', '정'] },
  { day: '금요일', time: '20:00', title: '풋살 정기전', meta: '풋살하는 사람들 · 망원 유수지', theme: 'orange', people: ['준', '태', '정'] },
];

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // 주소의 error 를 이 화면에서 지웠는지(다시 시도하면 위쪽 오류는 내리고 폼 안 오류 하나만 보인다)
  const [queryErrorCleared, setQueryErrorCleared] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

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

  // 가입·비밀번호 찾기에 갔다가 뒤로 왔을 때 펼친 폼과 입력한 이메일을 되살린다
  // (서버 렌더와 맞추려고 첫 렌더 뒤에 읽는다)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = sessionStorage.getItem(EMAIL_FORM_KEY);
        if (saved !== null) {
          setEmailOpen(true);
          setEmail(saved);
        }
      } catch {
        // 저장소를 못 쓰면 처음 상태로 둔다
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!emailOpen) return;
    try {
      sessionStorage.setItem(EMAIL_FORM_KEY, email);
    } catch {
      // 무시
    }
  }, [emailOpen, email]);

  // 로그인한 사용자는 미들웨어가 '/' 에서 먼저 보내므로, 세션 확인을 기다리지 않고 바로 화면을 그린다.
  if (status === 'authenticated') return null;

  // 주소의 error·callbackUrl 은 브라우저에서만 읽는다(서버 렌더에서는 오류 없이 그린다).
  const loginError = isMounted && !queryErrorCleared ? getLoginError() : null;
  // 이메일 폼은 접어 둔다. 이메일 로그인 오류로 돌아왔으면 펼친 채로 보여 준다.
  const showEmail = emailOpen || loginError === 'CredentialsSignin' || loginError === 'TooManyAttempts';

  const closeEmail = () => {
    setEmailOpen(false);
    setFormError(null);
    setPassword('');
    if (loginError) clearQueryError();
    try {
      sessionStorage.removeItem(EMAIL_FORM_KEY);
    } catch {
      // 무시
    }
  };

  /** 주소의 ?error= 를 지운다(callbackUrl 은 남긴다) */
  const clearQueryError = () => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('error')) {
      url.searchParams.delete('error');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    setQueryErrorCleared(true);
  };

  const onEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (loginError) {
      // 주소의 오류로 펼쳐진 폼이 접히지 않게 펼침 상태로 옮긴 뒤 지운다
      setEmailOpen(true);
      clearQueryError();
    }
    const trimmed = email.trim();
    if (!trimmed || !password) {
      setFormError('이메일과 비밀번호를 입력해 주세요.');
      (trimmed ? passwordRef : emailRef).current?.focus();
      return;
    }
    if (!looksLikeEmail(trimmed)) {
      setFormError('이메일 형식이 아니에요. 예: name@example.com');
      emailRef.current?.focus();
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const result = await signIn('credentials', { redirect: false, email: normalizeEmail(email), password });
      if (result?.ok && !result.error) {
        try {
          sessionStorage.removeItem(EMAIL_FORM_KEY);
        } catch {
          // 무시
        }
        return; // 세션이 갱신되면 위 useEffect 가 callbackUrl 로 보낸다
      }
      setFormError(loginErrorMessage(result?.error));
    } catch {
      // nginx rate limit(429) 등 NextAuth 가 아닌 응답이면 signIn 이 던진다
      setFormError(loginErrorMessage(null));
    }
    setPassword('');
    setSubmitting(false);
    // 비운 비밀번호칸으로 바로 다시 입력할 수 있게(버튼이 다시 켜진 뒤 포커스)
    setTimeout(() => passwordRef.current?.focus(), 0);
  };

  return (
    // 위쪽 기준으로 놓아 폼을 펼치거나 오류가 떠도 로고·제목이 위로 튀지 않는다
    <main className="flex min-h-screen items-start bg-canvas px-6 pb-12 pt-[max(3rem,calc(50vh-18rem))] lg:px-16">
      {/* 두 열은 xl(1280) 부터: lg(1024)에서는 왼쪽 열이 212px 로 줄어 제목이 다섯 줄로 깨졌다 */}
      <div className="mx-auto grid w-full max-w-[1200px] items-start gap-16 xl:grid-cols-[minmax(0,1fr)_620px]">
        {/* 왼쪽: 로고, 제목, 설명, 카카오 버튼 */}
        <div className="flex flex-col items-start">
          <Logo height={46} />

          <h1 className="mt-8 font-display text-[36px] leading-[48px] break-keep text-ink lg:text-[52px] lg:leading-[64px]">
            모임장도 모임원도,
            <br />
            모이기 쉽게 잊지 않게
          </h1>
          <p className="mt-6 max-w-[480px] break-keep text-base leading-relaxed text-ink-2 lg:text-lg">
            장소 정하기부터 함께 보는 일정과 메모까지, 모임의 모든 일을 한곳에서 해결해요
          </p>

          {loginError && !formError && (
            <p role="alert" className="mt-6 w-full max-w-[400px] rounded-[10px] bg-negative-soft px-4 py-3 text-sm text-negative">
              {loginErrorMessage(loginError)}
            </p>
          )}

          <button
            onClick={() => signIn('kakao', { callbackUrl: getCallbackPath() })}
            className="mt-8 flex h-12 w-full max-w-[400px] items-center justify-center gap-2 rounded-[10px] bg-[#FEE500] px-6 text-[15px] font-medium text-[#191919] transition-[background-color,transform] hover:bg-[#FEE500]/90 active:scale-[0.98]"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 3C6.477 3 2 6.48 2 10.8c0 2.8 1.88 5.25 4.72 6.57-.19.7-.7 2.54-.8 2.92-.12.46.16.45.34.33.14-.09 2.24-1.52 3.14-2.13.84.23 1.73.35 2.64.35 5.523 0 10-3.48 10-7.8S17.523 3 12 3z" />
            </svg>
            카카오로 시작하기
          </button>
          <p className="mt-3 text-[13px] text-ink-3">카카오로 처음 오면 가입도 함께 돼요</p>

          {/* 이메일 로그인: 누르면 그 자리에 폼이 펼쳐진다 */}
          {!showEmail && (
            <button
              type="button"
              onClick={() => setEmailOpen(true)}
              className="btn-secondary mt-6 h-12 w-full max-w-[400px] text-[15px]"
            >
              이메일로 계속하기
            </button>
          )}
          {showEmail && (
          <>
          <form onSubmit={onEmailLogin} noValidate className="mt-6 w-full max-w-[400px] space-y-3">
            <div>
              <label htmlFor="login-email" className="sr-only">
                이메일
              </label>
              <input
                id="login-email"
                type="email"
                inputMode="email"
                autoComplete="username"
                placeholder="이메일"
                autoFocus={emailOpen}
                value={email}
                ref={emailRef}
                aria-invalid={formError ? true : undefined}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFormError(null);
                }}
                className="form-input h-11"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="sr-only">
                비밀번호
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="비밀번호"
                  value={password}
                  aria-invalid={formError ? true : undefined}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFormError(null);
                  }}
                  className="form-input h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-3 hover:text-ink"
                >
                  {showPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
                </button>
              </div>
            </div>
            {formError && (
              <p role="alert" className="rounded-[10px] bg-negative-soft px-4 py-3 text-sm text-negative">
                {formError}
              </p>
            )}
            <button type="submit" disabled={submitting} className="btn-primary h-11 w-full text-[15px]">
              {submitting ? '로그인하는 중...' : '이메일로 로그인'}
            </button>
          </form>
          {/* 링크는 터치 높이 44px(h-11). 글자 위치는 전처럼 제출 버튼 아래 16px 쯤 */}
          <div className="mt-1 flex w-full max-w-[400px] items-center justify-between text-[13px]">
            <Link href="/signup" className="inline-flex h-11 items-center pr-3 text-accent underline-offset-2 hover:underline">
              이메일로 가입
            </Link>
            <button
              type="button"
              onClick={closeEmail}
              className="inline-flex h-11 items-center px-2 text-ink-3 underline-offset-2 hover:text-ink hover:underline"
            >
              접기
            </button>
            <Link href="/reset-password" className="inline-flex h-11 items-center text-ink-2 underline-offset-2 hover:text-ink hover:underline">
              비밀번호를 잊었어요
            </Link>
          </div>
          </>
          )}
        </div>

        {/* 오른쪽: 앱 미리보기 (넓은 화면만) */}
        <div aria-hidden className="hidden rounded-2xl border border-line bg-surface p-8 shadow-float xl:mt-[60px] xl:block">
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
