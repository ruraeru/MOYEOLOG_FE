'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { accountApi, type VerifyResult } from '@/lib/account-api';
import { getApiErrorMessage } from '@/lib/axios';
import { AccountShell, Field, FormError, PasswordInput } from '../signup/AccountShell';
import { loginHref, takeAfterSignup } from '@/lib/after-signup';

/** 링크 상태: 열자마자 미리 본다(토큰을 쓰지 않는다). 쓸 수 없으면 비밀번호를 묻지 않고 까닭부터 보여 준다 */
type Preview = { state: 'loading' } | { state: 'ok'; email: string | null } | { state: 'unusable'; message: string };

const isBadRequest = (err: unknown) => (err as { response?: { status?: number } })?.response?.status === 400;

async function checkLink(token: string): Promise<Preview> {
  try {
    const p = await accountApi.previewVerify(token);
    return { state: 'ok', email: p.email };
  } catch (err) {
    // 400 만 '쓸 수 없는 링크'. 네트워크 오류 등은 확정 단계에서 다시 알린다
    if (isBadRequest(err)) return { state: 'unusable', message: getApiErrorMessage(err, '이 링크는 쓸 수 없어요.') };
    return { state: 'ok', email: null };
  }
}

/**
 * 메일 링크(/verify?token=...&purpose=signup|email)로 여는 화면. 로그인하지 않아도, 로그인한 채로도 열린다.
 * 메일 미리보기 봇이 링크를 열어도 토큰이 쓰이지 않도록, 버튼을 눌러야 인증 요청을 보낸다.
 * 메일을 연 사람이 신청한 사람인지 확인한다: 가입은 가입 때 정한 비밀번호, 이메일 등록은 그 계정의 로그인.
 */
function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const isEmailChange = searchParams.get('purpose') === 'email';
  const { data: session, status } = useSession();
  const loggedIn = status === 'authenticated' && !!session?.user?.accessToken && !session.user.error;
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [preview, setPreview] = useState<Preview>({ state: 'loading' });
  /** 가입을 마칠 때 다른 계정으로 로그인돼 있었으면 그 이름 */
  const [otherAccount, setOtherAccount] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    checkLink(token).then((p) => {
      if (alive) setPreview(p);
    });
    return () => {
      alive = false;
    };
  }, [token]);
  const [afterSignup, setAfterSignup] = useState<string | null>(null);

  const onVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!isEmailChange && !password) {
      setError('가입 때 정한 비밀번호를 입력해 주세요.');
      document.getElementById('verify-password')?.focus();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const verified = await accountApi.verify(token, isEmailChange ? { session } : { password });
      if (verified.purpose === 'SIGNUP' && loggedIn) setOtherAccount(session?.user?.name || '다른');
      if (verified.purpose === 'SIGNUP') setAfterSignup(takeAfterSignup());
      setResult(verified);
      // 설정 화면에 인증된 이메일이 바로 보이도록 내 정보 캐시를 버린다
      if (verified.purpose === 'EMAIL') await queryClient.invalidateQueries();
    } catch (err) {
      // 이번 실패로 링크를 더 못 쓰게 됐으면(5번 틀림·이미 씀·만료) 까닭 화면으로 바꾼다. 아니면 비밀번호 문제다
      const after = isBadRequest(err) ? await checkLink(token) : null;
      if (after?.state === 'unusable') setPreview(after);
      else setError(getApiErrorMessage(err, '인증하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  };

  /** 가입을 마친 뒤 방금 넣은 비밀번호로 바로 로그인(다른 계정이면 먼저 로그아웃) */
  const startNow = async () => {
    if (!result || starting) return;
    setStarting(true);
    setStartError(null);
    try {
      if (loggedIn) await signOut({ redirect: false });
      const r = await signIn('credentials', { redirect: false, email: result.email, password });
      if (r?.ok && !r.error) {
        window.location.assign(afterSignup || '/home');
        return;
      }
    } catch {
      // 아래 문구로 알린다
    }
    setStartError('자동으로 로그인하지 못했어요. 로그인 화면에서 이메일과 비밀번호로 로그인해 주세요.');
    setStarting(false);
  };

  if (!token) {
    return (
      <AccountShell title="링크가 올바르지 않아요" description="메일에 있는 링크를 그대로 열어 주세요.">
        <Link href="/" className="btn-secondary h-11 w-full">
          로그인 화면으로
        </Link>
      </AccountShell>
    );
  }

  if (result?.purpose === 'SIGNUP') {
    return (
      <AccountShell title="가입을 마쳤어요" focusTitle>
        <p className="break-keep text-sm leading-relaxed text-ink-2">
          {otherAccount
            ? `지금은 ${otherAccount} 계정으로 로그인돼 있어요. 아래 버튼을 누르면 로그아웃하고 새 계정으로 로그인해요.`
            : '이제 이 이메일과 비밀번호로 로그인할 수 있어요.'}
        </p>
        <p className="mt-2 break-all text-sm font-medium text-ink">{result.email}</p>
        {/* 가입 화면에서 기억해 둔 곳(예: 친구 초대 링크)이 있으면 로그인 뒤 그리로 */}
        <div className="mt-6 space-y-2">
          <FormError message={startError} />
          <button type="button" onClick={startNow} disabled={starting} className="btn-primary h-11 w-full">
            {starting ? '로그인하는 중...' : otherAccount ? '새 계정으로 시작하기' : '바로 시작하기'}
          </button>
          <Link href={otherAccount ? '/home' : loginHref(afterSignup)} className="btn-ghost h-11 w-full">
            {otherAccount ? '지금 계정으로 계속' : '로그인 화면으로'}
          </Link>
        </div>
      </AccountShell>
    );
  }

  if (result?.purpose === 'EMAIL') {
    return (
      <AccountShell title="이메일을 인증했어요" focusTitle>
        <p className="text-sm leading-relaxed text-ink-2">계정의 이메일을 이 주소로 바꿨어요.</p>
        <p className="mt-2 break-all text-sm font-medium text-ink">{result.email}</p>
        <Link href="/settings?menu=security" className="btn-primary mt-6 h-11 w-full">
          설정으로
        </Link>
      </AccountShell>
    );
  }

  if (preview.state === 'loading' || (isEmailChange && status === 'loading')) {
    return <main className="min-h-screen bg-canvas" />;
  }

  if (preview.state === 'unusable') {
    return (
      <AccountShell title="이 링크는 쓸 수 없어요" description={preview.message} focusTitle>
        <div className="flex flex-col gap-2">
          {isEmailChange ? (
            <Link href="/settings?menu=security" className="btn-primary h-11 w-full">
              설정에서 이메일 다시 등록하기
            </Link>
          ) : (
            <>
              <Link href="/" className="btn-primary h-11 w-full">
                로그인하기
              </Link>
              <Link href="/signup" className="btn-secondary h-11 w-full">
                가입 다시 신청하기
              </Link>
            </>
          )}
        </div>
      </AccountShell>
    );
  }

  if (isEmailChange && !loggedIn) {
    const callbackUrl = `/verify?${searchParams.toString()}`;
    return (
      <AccountShell
        title="로그인이 필요해요"
        description="이메일을 등록한 계정으로 로그인하면 이 화면으로 돌아와요. 돌아온 뒤 인증 버튼을 눌러 주세요."
      >
        <Link href={`/?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="btn-primary h-11 w-full">
          로그인하기
        </Link>
      </AccountShell>
    );
  }

  return (
    <AccountShell
      title="이메일 인증"
      description={
        <>
          {preview.email && <span className="block break-all font-medium text-ink">{preview.email}</span>}
          {isEmailChange
            ? '아래 버튼을 누르면 이 계정의 이메일을 이 주소로 바꿔요.'
            : '가입할 때 정한 비밀번호를 입력하면 가입을 마쳐요.'}
          {!isEmailChange && loggedIn && (
            <span className="mt-1 block text-ink-3">
              지금 {session?.user?.name || '다른'} 계정으로 로그인돼 있어요. 인증하면 이 이메일로 새 계정이 만들어져요.
            </span>
          )}
        </>
      }
    >
      <form className="space-y-4" onSubmit={onVerify} noValidate>
        {!isEmailChange && (
          <Field id="verify-password" label="가입 때 정한 비밀번호">
            <PasswordInput
              id="verify-password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input h-10"
            />
          </Field>
        )}
        <FormError message={error} />
        <button type="submit" disabled={submitting} className="btn-primary h-11 w-full">
          {submitting ? '인증하는 중...' : '이메일 인증하기'}
        </button>
      </form>
    </AccountShell>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-canvas" />}>
      <VerifyContent />
    </Suspense>
  );
}
