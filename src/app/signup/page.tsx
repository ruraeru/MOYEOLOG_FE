'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { accountApi, isEmailLike, nicknameProblem, normalizeEmail, passwordProblem, PASSWORD_MIN } from '@/lib/account-api';
import { getApiErrorMessage } from '@/lib/axios';
import { AccountShell, Field, FormError, PasswordInput } from './AccountShell';

type FieldName = 'email' | 'nickname' | 'password' | 'confirm';
type Errors = Partial<Record<FieldName, string>>;

/** 같은 이메일로는 1분에 메일 1통만 보낸다(백엔드 AccountService.allowSend). 그 안의 재신청은 메일이 가지 않는다 */
const RESEND_WAIT_SECONDS = 60;
const FIELD_ORDER: FieldName[] = ['email', 'nickname', 'password', 'confirm'];
/** 글줄 안의 링크: 줄 높이는 그대로 두고 누르는 영역만 44px 가까이 넓힌다 */
const linkHit = 'text-accent underline-offset-2 hover:underline -mx-1 px-1 py-3.5';

export default function SignupPage() {
  const { data: session, status } = useSession();
  const loggedIn = status === 'authenticated' && !!session?.user?.accessToken && !session.user.error;
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);

  // 데스크톱(마우스)에서만 첫 칸에 포커스. 터치 기기는 키보드가 바로 올라오지 않게 둔다
  useEffect(() => {
    if (status !== 'loading' && !loggedIn && !sentTo && window.matchMedia('(pointer: fine)').matches) emailRef.current?.focus();
  }, [status, loggedIn, sentTo]);

  const waitLeft = sentTo ? Math.max(0, RESEND_WAIT_SECONDS - Math.floor((now - sentAt) / 1000)) : 0;
  useEffect(() => {
    if (!sentTo || waitLeft <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [sentTo, waitLeft]);

  /** 칸을 고치면 그 칸의 오류는 바로 지운다 */
  const change = (name: FieldName, set: (v: string) => void, value: string) => {
    set(value);
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!isEmailLike(normalizeEmail(email))) next.email = '이메일 주소를 확인해 주세요.';
    const nick = nicknameProblem(nickname);
    if (nick) next.nickname = nick;
    const pw = passwordProblem(password);
    if (pw) next.password = pw;
    if (password !== confirm) next.confirm = '비밀번호가 서로 달라요.';
    const invalid = FIELD_ORDER.filter((name) => next[name]);
    setErrors(next);
    setFormError(null);
    if (invalid.length) {
      document.getElementById(`signup-${invalid[0]}`)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await accountApi.signup({ email, password, nickname });
      const at = Date.now();
      setSentTo(normalizeEmail(email));
      setSentAt(at);
      setNow(at);
      setPassword('');
      setConfirm('');
    } catch (error) {
      setFormError(getApiErrorMessage(error, '가입 신청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') return <main className="min-h-screen bg-canvas" />;

  if (loggedIn && !sentTo) {
    return (
      <AccountShell
        title="이미 로그인돼 있어요"
        description={`지금 ${session?.user?.name || '다른'} 계정으로 로그인돼 있어요. 새 계정을 만들려면 먼저 로그아웃해 주세요.`}
      >
        <div className="flex flex-col gap-2">
          <Link href="/home" className="btn-primary h-11 w-full">
            홈으로
          </Link>
          <button type="button" className="btn-secondary h-11 w-full" onClick={() => signOut({ callbackUrl: '/signup' })}>
            로그아웃하고 새로 가입하기
          </button>
        </div>
      </AccountShell>
    );
  }

  if (sentTo) {
    return (
      <AccountShell title="메일을 보냈어요" focusTitle>
        <div className="space-y-4 break-keep text-sm leading-relaxed text-ink-2">
          <p className="break-all font-medium text-ink">{sentTo}</p>
          <p>
            이 주소로 메일을 보냈어요. 메일의 링크를 열고 가입 때 정한 비밀번호를 넣으면 가입이 끝나요. 링크는{' '}
            <span className="whitespace-nowrap">30분</span> 동안 쓸 수 있어요.
          </p>
          <p className="text-[13px] text-ink-3">
            메일이 보이지 않으면 스팸함을 확인해 주세요. 주소를 잘못 썼다면 다시 신청하면 돼요. 같은 주소로는 1분에 한 번, 한 시간에 다섯
            번까지 메일을 보내요. 다시 신청했다면 마지막에 받은 메일의 링크를 그때 정한 비밀번호로 열어 주세요.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link href="/" className="btn-primary h-11">
              로그인 화면으로
            </Link>
            <button type="button" className="btn-secondary h-11" disabled={waitLeft > 0} onClick={() => setSentTo(null)}>
              {waitLeft > 0 ? `${waitLeft}초 뒤 다시 신청` : '다시 신청하기'}
            </button>
          </div>
        </div>
      </AccountShell>
    );
  }

  return (
    <AccountShell
      title="이메일로 가입"
      description={
        <>
          이미 계정이 있나요?{' '}
          <Link href="/" className={linkHit}>
            로그인
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field id="signup-email" label="이메일" error={errors.email}>
          <input
            ref={emailRef}
            id="signup-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => change('email', setEmail, e.target.value)}
            aria-invalid={!!errors.email}
            aria-describedby="signup-email-msg"
            className={`form-input h-10 ${errors.email ? '!border-negative' : ''}`}
          />
        </Field>
        <Field id="signup-nickname" label="활동 이름" hint="2~20자. 친구와 모임 멤버에게 이 이름으로 보여요." error={errors.nickname}>
          <input
            id="signup-nickname"
            autoComplete="nickname"
            value={nickname}
            onChange={(e) => change('nickname', setNickname, e.target.value)}
            aria-invalid={!!errors.nickname}
            aria-describedby="signup-nickname-msg"
            className={`form-input h-10 ${errors.nickname ? '!border-negative' : ''}`}
          />
        </Field>
        <Field id="signup-password" label="비밀번호" hint={`${PASSWORD_MIN}자 이상`} error={errors.password}>
          <PasswordInput
            id="signup-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => change('password', setPassword, e.target.value)}
            aria-invalid={!!errors.password}
            aria-describedby="signup-password-msg"
            className={`form-input h-10 ${errors.password ? '!border-negative' : ''}`}
          />
        </Field>
        <Field id="signup-confirm" label="비밀번호 확인" error={errors.confirm}>
          <PasswordInput
            id="signup-confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => change('confirm', setConfirm, e.target.value)}
            aria-invalid={!!errors.confirm}
            aria-describedby="signup-confirm-msg"
            className={`form-input h-10 ${errors.confirm ? '!border-negative' : ''}`}
          />
        </Field>

        <FormError message={formError} />

        <button type="submit" disabled={submitting} className="btn-primary h-11 w-full">
          {submitting ? '보내는 중...' : '인증 메일 받기'}
        </button>
        <p className="text-[13px] text-ink-3">메일의 링크를 눌러야 가입이 끝나요.</p>
      </form>
    </AccountShell>
  );
}
