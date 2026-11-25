'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { accountApi, isEmailLike, normalizeEmail, passwordProblem, PASSWORD_MIN } from '@/lib/account-api';
import { getApiErrorMessage } from '@/lib/axios';
import { AccountShell, Field, FormError } from '../signup/AccountShell';

/** 토큰이 없으면: 비밀번호 설정 메일 요청 */
function RequestForm() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizeEmail(email);
    setFormError(null);
    if (!isEmailLike(normalized)) {
      setEmailError('이메일 주소를 확인해 주세요.');
      return;
    }
    setEmailError(null);
    setSubmitting(true);
    try {
      await accountApi.requestPasswordReset(normalized);
      setSentTo(normalized);
    } catch (error) {
      setFormError(getApiErrorMessage(error, '메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (sentTo) {
    return (
      <AccountShell title="메일을 보냈어요">
        <div className="space-y-4 text-sm leading-relaxed text-ink-2">
          <p className="break-all font-medium text-ink">{sentTo}</p>
          <p>이 이메일로 인증된 계정이 있으면 비밀번호 설정 링크를 보냈어요. 링크는 30분 동안 쓸 수 있어요.</p>
          <p className="text-[13px] text-ink-3">
            메일이 오지 않으면 스팸함을 확인해 주세요. 카카오로 가입했고 이메일 인증을 하지 않았다면, 카카오로 로그인한 뒤 설정의 &apos;계정 및
            보안&apos;에서 비밀번호를 정할 수 있어요.
          </p>
          <Link href="/" className="btn-primary">
            로그인 화면으로
          </Link>
        </div>
      </AccountShell>
    );
  }

  return (
    <AccountShell title="비밀번호 찾기" description="가입한 이메일을 쓰면 비밀번호를 새로 정하는 링크를 보내 드려요.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field id="reset-email" label="이메일" error={emailError}>
          <input
            id="reset-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!emailError}
            aria-describedby="reset-email-msg"
            className={`form-input h-10 ${emailError ? '!border-negative' : ''}`}
          />
        </Field>
        <FormError message={formError} />
        <button type="submit" disabled={submitting} className="btn-primary h-10 w-full">
          {submitting ? '보내는 중...' : '링크 받기'}
        </button>
        <Link href="/" className="btn-ghost w-full">
          로그인 화면으로
        </Link>
      </form>
    </AccountShell>
  );
}

/** 토큰이 있으면: 새 비밀번호 입력 */
function ConfirmForm({ token }: { token: string }) {
  const { status } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const pw = passwordProblem(password);
    const next = pw ? { password: pw } : password !== confirm ? { confirm: '비밀번호가 서로 달라요.' } : {};
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await accountApi.confirmPasswordReset(token, password);
      // 백엔드가 모든 기기를 로그아웃시켰다. 이 브라우저의 세션도 끊어 로그인 화면이 바로 열리게 한다
      if (status === 'authenticated') await signOut({ redirect: false });
      setDone(true);
    } catch (error) {
      setFormError(getApiErrorMessage(error, '비밀번호를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <AccountShell title="비밀번호를 정했어요" description="모든 기기에서 로그아웃했어요. 새 비밀번호로 다시 로그인해 주세요.">
        <Link href="/" className="btn-primary">
          로그인하기
        </Link>
      </AccountShell>
    );
  }

  return (
    <AccountShell title="새 비밀번호 정하기" description="바꾸면 모든 기기에서 로그아웃돼요.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field id="reset-password" label="새 비밀번호" hint={`${PASSWORD_MIN}자 이상`} error={errors.password}>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
            aria-describedby="reset-password-msg"
            className={`form-input h-10 ${errors.password ? '!border-negative' : ''}`}
          />
        </Field>
        <Field id="reset-confirm" label="새 비밀번호 확인" error={errors.confirm}>
          <input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={!!errors.confirm}
            aria-describedby="reset-confirm-msg"
            className={`form-input h-10 ${errors.confirm ? '!border-negative' : ''}`}
          />
        </Field>
        <FormError message={formError} />
        {formError && (
          <p className="text-[13px] text-ink-3">
            링크가 만료됐다면{' '}
            <Link href="/reset-password" className="text-accent underline-offset-2 hover:underline">
              새 링크
            </Link>
            를 받아 주세요.
          </p>
        )}
        <button type="submit" disabled={submitting} className="btn-primary h-10 w-full">
          {submitting ? '저장하는 중...' : '비밀번호 저장'}
        </button>
      </form>
    </AccountShell>
  );
}

function ResetPasswordContent() {
  const token = useSearchParams().get('token');
  // 토큰이 바뀌면(새 링크) 폼 상태를 새로 시작한다
  return token ? <ConfirmForm key={token} token={token} /> : <RequestForm />;
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-canvas" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
