'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { accountApi, isEmailLike, nicknameProblem, normalizeEmail, passwordProblem, PASSWORD_MIN } from '@/lib/account-api';
import { getApiErrorMessage } from '@/lib/axios';
import { AccountShell, Field, FormError } from './AccountShell';

type Errors = Partial<Record<'email' | 'nickname' | 'password' | 'confirm', string>>;

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!isEmailLike(normalizeEmail(email))) next.email = '이메일 주소를 확인해 주세요.';
    const nick = nicknameProblem(nickname);
    if (nick) next.nickname = nick;
    const pw = passwordProblem(password);
    if (pw) next.password = pw;
    else if (password !== confirm) next.confirm = '비밀번호가 서로 달라요.';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await accountApi.signup({ email, password, nickname });
      setSentTo(normalizeEmail(email));
      setPassword('');
      setConfirm('');
    } catch (error) {
      setFormError(getApiErrorMessage(error, '가입 신청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (sentTo) {
    return (
      <AccountShell title="메일을 보냈어요">
        <div className="space-y-4 text-sm leading-relaxed text-ink-2">
          <p className="break-all font-medium text-ink">{sentTo}</p>
          <p>이 주소로 메일을 보냈어요. 메일에 적힌 안내를 따라 30분 안에 가입을 마쳐 주세요.</p>
          <p className="text-[13px] text-ink-3">메일이 보이지 않으면 스팸함을 확인해 주세요. 주소를 잘못 썼다면 다시 신청하면 돼요.</p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link href="/" className="btn-primary">
              로그인 화면으로
            </Link>
            <button type="button" className="btn-secondary" onClick={() => setSentTo(null)}>
              다시 신청하기
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
          <Link href="/" className="touch-hit text-accent underline-offset-2 hover:underline">
            로그인
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field id="signup-email" label="이메일" error={errors.email}>
          <input
            id="signup-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            onChange={(e) => setNickname(e.target.value)}
            aria-invalid={!!errors.nickname}
            aria-describedby="signup-nickname-msg"
            className={`form-input h-10 ${errors.nickname ? '!border-negative' : ''}`}
          />
        </Field>
        <Field id="signup-password" label="비밀번호" hint={`${PASSWORD_MIN}자 이상`} error={errors.password}>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
            aria-describedby="signup-password-msg"
            className={`form-input h-10 ${errors.password ? '!border-negative' : ''}`}
          />
        </Field>
        <Field id="signup-confirm" label="비밀번호 확인" error={errors.confirm}>
          <input
            id="signup-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={!!errors.confirm}
            aria-describedby="signup-confirm-msg"
            className={`form-input h-10 ${errors.confirm ? '!border-negative' : ''}`}
          />
        </Field>

        <FormError message={formError} />

        <button type="submit" disabled={submitting} className="btn-primary h-10 w-full">
          {submitting ? '보내는 중...' : '인증 메일 받기'}
        </button>
        <p className="text-[13px] text-ink-3">메일의 링크를 눌러야 가입이 끝나요.</p>
      </form>
    </AccountShell>
  );
}
