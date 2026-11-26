'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { accountApi, type VerifyResult } from '@/lib/account-api';
import { getApiErrorMessage } from '@/lib/axios';
import { AccountShell, Field, FormError } from '../signup/AccountShell';
import { loginHref, takeAfterSignup } from '@/lib/after-signup';

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
  const [afterSignup, setAfterSignup] = useState<string | null>(null);

  const onVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!isEmailChange && !password) {
      setError('가입 때 정한 비밀번호를 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const verified = await accountApi.verify(
        token,
        isEmailChange ? { session } : { password }
      );
      if (verified.purpose === 'SIGNUP') setAfterSignup(takeAfterSignup());
      setResult(verified);
      // 설정 화면에 인증된 이메일이 바로 보이도록 내 정보 캐시를 버린다
      if (verified.purpose === 'EMAIL') await queryClient.invalidateQueries();
    } catch (err) {
      setError(getApiErrorMessage(err, '인증하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AccountShell title="링크가 올바르지 않아요" description="메일에 있는 링크를 그대로 열어 주세요.">
        <Link href="/" className="btn-secondary">
          로그인 화면으로
        </Link>
      </AccountShell>
    );
  }

  if (result?.purpose === 'SIGNUP') {
    return (
      <AccountShell title="가입을 마쳤어요">
        <p className="text-sm leading-relaxed text-ink-2">이제 이 이메일과 비밀번호로 로그인할 수 있어요.</p>
        <p className="mt-2 break-all text-sm font-medium text-ink">{result.email}</p>
        {/* 가입 화면에서 기억해 둔 곳(예: 친구 초대 링크)이 있으면 로그인 뒤 그리로 */}
        <Link href={loginHref(afterSignup)} className="btn-primary mt-6">
          로그인하기
        </Link>
      </AccountShell>
    );
  }

  if (result?.purpose === 'EMAIL') {
    return (
      <AccountShell title="이메일을 인증했어요">
        <p className="text-sm leading-relaxed text-ink-2">계정의 이메일을 이 주소로 바꿨어요.</p>
        <p className="mt-2 break-all text-sm font-medium text-ink">{result.email}</p>
        <Link href="/settings?menu=security" className="btn-primary mt-6">
          설정으로
        </Link>
      </AccountShell>
    );
  }

  if (isEmailChange && status === 'loading') {
    return <main className="min-h-screen bg-canvas" />;
  }

  if (isEmailChange && !loggedIn) {
    const callbackUrl = `/verify?${searchParams.toString()}`;
    return (
      <AccountShell
        title="로그인이 필요해요"
        description="이메일을 등록한 계정으로 로그인하면 이 화면으로 돌아와요. 돌아온 뒤 인증 버튼을 눌러 주세요."
      >
        <Link href={`/?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="btn-primary h-10 w-full">
          로그인하기
        </Link>
      </AccountShell>
    );
  }

  return (
    <AccountShell
      title="이메일 인증"
      description={
        isEmailChange
          ? '아래 버튼을 누르면 이 계정의 이메일을 이 주소로 바꿔요.'
          : '가입할 때 정한 비밀번호를 입력하면 가입을 마쳐요.'
      }
    >
      <form className="space-y-4" onSubmit={onVerify} noValidate>
        {!isEmailChange && (
          <Field id="verify-password" label="가입 때 정한 비밀번호">
            <input
              id="verify-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
            />
          </Field>
        )}
        <FormError message={error} />
        <button type="submit" disabled={submitting} className="btn-primary h-10 w-full">
          {submitting ? '인증하는 중...' : '이메일 인증하기'}
        </button>
        {error && (
          <p className="text-[13px] text-ink-3">
            링크가 만료됐다면{' '}
            <Link href="/signup" className="text-accent underline-offset-2 hover:underline">
              가입
            </Link>
            이나 설정의 이메일 등록을 다시 해 주세요.
          </p>
        )}
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
