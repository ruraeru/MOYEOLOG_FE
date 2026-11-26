'use client';

import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { Eye, EyeOff } from 'lucide-react';
import { accountApi, isEmailLike, normalizeEmail, passwordProblem, PASSWORD_MIN } from '@/lib/account-api';
import { getApiErrorMessage } from '@/lib/axios';
import { AccountShell, Field, FormError } from '../signup/AccountShell';

/** 로그인 화면을 이메일 폼이 펼쳐진 채로 연다 */
const LOGIN_HREF = '/?email=1';
/** 같은 주소로는 메일을 1분에 한 번만 보낸다(백엔드 AccountService.allowSend 와 같은 값) */
const RESEND_WAIT_MS = 60 * 1000;
/** 보냄 화면을 새로고침해도 유지하려고 이 탭의 sessionStorage 에 둔다 */
const SENT_KEY = 'moyeolog:reset-sent';

type Sent = { email: string; at: number };

const readSent = (): Sent | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as Sent) : null;
    return parsed && typeof parsed.email === 'string' && typeof parsed.at === 'number' ? parsed : null;
  } catch {
    return null;
  }
};

const writeSent = (sent: Sent | null) => {
  try {
    if (sent) sessionStorage.setItem(SENT_KEY, JSON.stringify(sent));
    else sessionStorage.removeItem(SENT_KEY);
  } catch {
    // 저장소를 못 쓰면 새로고침 때 폼으로 돌아갈 뿐이다
  }
};

/** 토큰이 없으면: 비밀번호 재설정 메일 요청 */
function RequestForm({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 로그인 화면에서 다른 주소를 들고 왔으면 예전 보냄 화면은 버린다
  const [sent, setSent] = useState<Sent | null>(() => {
    const saved = readSent();
    return saved && (!initialEmail || saved.email === initialEmail) ? saved : null;
  });
  const [now, setNow] = useState(() => Date.now());
  const [resent, setResent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const waitLeft = sent ? Math.max(0, Math.ceil((sent.at + RESEND_WAIT_MS - now) / 1000)) : 0;

  useEffect(() => {
    if (!waitLeft) return;
    const timer = window.setTimeout(() => setNow(Date.now()), 1000);
    return () => window.clearTimeout(timer);
  }, [waitLeft, now]);

  const send = async (normalized: string) => {
    setFormError(null);
    setSubmitting(true);
    try {
      await accountApi.requestPasswordReset(normalized);
      const next = { email: normalized, at: Date.now() };
      writeSent(next);
      setNow(next.at);
      setSent(next);
      return true;
    } catch (error) {
      setFormError(getApiErrorMessage(error, '메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.'));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizeEmail(email);
    setFormError(null);
    if (!normalized || !isEmailLike(normalized)) {
      setEmailError(normalized ? '이메일 주소를 확인해 주세요.' : '이메일을 입력해 주세요.');
      emailRef.current?.focus();
      return;
    }
    setEmailError(null);
    setResent(false);
    await send(normalized);
  };

  const onResend = async () => {
    if (!sent || waitLeft) return;
    if (await send(sent.email)) setResent(true);
  };

  const clearSent = () => {
    writeSent(null);
    setSent(null);
    setResent(false);
    setFormError(null);
  };

  if (sent) {
    return (
      <AccountShell title="메일을 보냈어요">
        <div className="space-y-4 text-sm leading-relaxed text-ink-2">
          <p className="break-all font-medium text-ink">{sent.email}</p>
          <p>
            {resent ? '다시 보냈어요. ' : ''}이 이메일로 인증된 계정이 있으면 새 비밀번호를 정하는 링크를 보냈어요. 링크는 30분 동안 쓸
            수 있어요.
          </p>
          <p className="text-[13px] text-ink-3">
            메일이 오지 않으면 스팸함을 확인해 주세요. 같은 주소로는 메일을 1분에 한 번, 1시간에 다섯 번까지만 보내요. 카카오로 가입했고
            이메일 인증을 하지 않았다면, 카카오로 로그인한 뒤 설정의 &apos;계정 및 보안&apos;에서 비밀번호를 정할 수 있어요.
          </p>
          <FormError message={formError} />
          <button
            type="button"
            onClick={onResend}
            disabled={submitting || waitLeft > 0}
            className="btn-secondary h-11 w-full sm:h-10"
          >
            {submitting ? '보내는 중...' : waitLeft > 0 ? `다시 보내기 (${waitLeft}초 뒤)` : '다시 보내기'}
          </button>
          <Link href={LOGIN_HREF} className="btn-primary h-11 w-full sm:h-10">
            로그인 화면으로
          </Link>
          <button type="button" onClick={clearSent} className="btn-ghost h-11 w-full sm:h-10">
            다른 이메일 쓰기
          </button>
        </div>
      </AccountShell>
    );
  }

  return (
    <AccountShell title="비밀번호 찾기" description="가입한 이메일을 쓰면 새 비밀번호를 정하는 링크를 보내 드려요.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field id="reset-email" label="이메일" error={emailError}>
          <input
            ref={emailRef}
            id="reset-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError(null);
            }}
            aria-invalid={!!emailError}
            aria-describedby="reset-email-msg"
            className={`form-input h-11 sm:h-10 ${emailError ? '!border-negative' : ''}`}
          />
        </Field>
        <FormError message={formError} />
        <button type="submit" disabled={submitting} className="btn-primary h-11 w-full sm:h-10">
          {submitting ? '보내는 중...' : '링크 받기'}
        </button>
        <Link href={LOGIN_HREF} className="btn-ghost h-11 w-full sm:h-10">
          로그인 화면으로
        </Link>
      </form>
    </AccountShell>
  );
}

/** 링크를 쓸 수 없을 때(틀린·만료·이미 쓴 토큰). 같은 경로의 Link 는 화면이 안 바뀌어 주소를 새로 연다 */
function InvalidLink() {
  return (
    <AccountShell title="링크를 쓸 수 없어요" description="링크가 올바르지 않거나, 만료됐거나, 이미 썼어요. 새 링크를 받아 주세요.">
      <div className="space-y-3">
        <a href="/reset-password" className="btn-primary h-11 w-full sm:h-10">
          새 링크 받기
        </a>
        <Link href={LOGIN_HREF} className="btn-ghost h-11 w-full sm:h-10">
          로그인 화면으로
        </Link>
      </div>
    </AccountShell>
  );
}

/** 저장 뒤. 주소에서 토큰을 지운 ?done=1 로 보여 줘 새로고침·앞으로 가기에도 폼이 다시 열리지 않는다 */
function DoneView() {
  return (
    <AccountShell title="새 비밀번호를 정했어요" description="모든 기기에서 로그아웃했어요. 새 비밀번호로 다시 로그인해 주세요.">
      <Link href={LOGIN_HREF} className="btn-primary h-11 w-full sm:h-10">
        로그인하기
      </Link>
    </AccountShell>
  );
}

/** 토큰이 있으면: 새 비밀번호 입력 */
function ConfirmForm({ token }: { token: string }) {
  const { status } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [linkState, setLinkState] = useState<'checking' | 'ok' | 'invalid'>('checking');
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  // 열자마자 링크를 확인한다(소모하지 않음). 네트워크 오류면 폼을 그대로 보여 주고 저장 때 다시 알린다
  useEffect(() => {
    let alive = true;
    accountApi
      .checkPasswordResetToken(token)
      .then(() => alive && setLinkState('ok'))
      .catch((error: unknown) => {
        if (!alive) return;
        const statusCode = (error as { response?: { status?: number } })?.response?.status;
        setLinkState(statusCode === 400 ? 'invalid' : 'ok');
      });
    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => {
    if (linkState === 'ok') passwordRef.current?.focus();
  }, [linkState]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: { password?: string; confirm?: string } = {};
    const pw = passwordProblem(password);
    if (pw) next.password = pw;
    if (!confirm) next.confirm = '한 번 더 입력해 주세요.';
    else if (password !== confirm) next.confirm = '비밀번호가 서로 달라요.';
    setErrors(next);
    setFormError(null);
    if (next.password) passwordRef.current?.focus();
    else if (next.confirm) confirmRef.current?.focus();
    if (next.password || next.confirm) return;

    setSubmitting(true);
    try {
      await accountApi.confirmPasswordReset(token, password);
      // 백엔드가 모든 기기를 로그아웃시켰다. 이 브라우저의 세션도 끊어 로그인 화면이 바로 열리게 한다
      // (SessionGuard 는 /reset-password 에서 로그인 화면으로 보내지 않는다)
      if (status === 'authenticated') await signOut({ redirect: false });
      window.history.replaceState(null, '', '/reset-password?done=1');
    } catch (error) {
      // 링크 문제면 안내 화면으로, 아니면 서버 문구를 보여 준다
      const stillUsable = await accountApi.checkPasswordResetToken(token).then(
        () => true,
        (checkError: unknown) => (checkError as { response?: { status?: number } })?.response?.status !== 400,
      );
      if (!stillUsable) setLinkState('invalid');
      else setFormError(getApiErrorMessage(error, '비밀번호를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (linkState === 'invalid') return <InvalidLink />;

  const inputType = show ? 'text' : 'password';

  return (
    <AccountShell title="새 비밀번호 정하기" description="바꾸면 모든 기기에서 로그아웃돼요.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field id="reset-password" label="새 비밀번호" hint={`${PASSWORD_MIN}자 이상`} error={errors.password}>
          <input
            ref={passwordRef}
            id="reset-password"
            type={inputType}
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            aria-invalid={!!errors.password}
            aria-describedby="reset-password-msg"
            className={`form-input h-11 sm:h-10 ${errors.password ? '!border-negative' : ''}`}
          />
        </Field>
        <Field id="reset-confirm" label="새 비밀번호 확인" error={errors.confirm}>
          <input
            ref={confirmRef}
            id="reset-confirm"
            type={inputType}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setErrors((prev) => ({ ...prev, confirm: undefined }));
            }}
            aria-invalid={!!errors.confirm}
            aria-describedby="reset-confirm-msg"
            className={`form-input h-11 sm:h-10 ${errors.confirm ? '!border-negative' : ''}`}
          />
        </Field>
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-pressed={show}
          className="btn-ghost -ml-3 h-11 sm:h-9"
        >
          {show ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
          {show ? '비밀번호 가리기' : '비밀번호 보기'}
        </button>
        <FormError message={formError} />
        <button type="submit" disabled={submitting || linkState === 'checking'} className="btn-primary h-11 w-full sm:h-10">
          {submitting ? '저장하는 중...' : '비밀번호 저장'}
        </button>
      </form>
    </AccountShell>
  );
}

function ResetPasswordContent() {
  const params = useSearchParams();
  const token = params.get('token');
  if (params.get('done') === '1') return <DoneView />;
  // 토큰이 바뀌면(새 링크) 폼 상태를 새로 시작한다
  return token ? (
    <ConfirmForm key={token} token={token} />
  ) : (
    <RequestForm initialEmail={normalizeEmail(params.get('email') ?? '')} />
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-canvas" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
