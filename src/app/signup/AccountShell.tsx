'use client';

import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { Logo } from '@/components/Logo';

/**
 * 로그인 없이 여는 계정 화면(/signup, /verify, /reset-password)의 껍데기.
 * 로그인 화면과 같은 로고 + 가운데 좁은 카드.
 */
export function AccountShell({
  title,
  description,
  children,
  focusTitle = false,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** 화면이 통째로 바뀐 결과 화면(보냄·완료)에서 제목으로 포커스를 옮겨 스크린리더가 읽게 한다 */
  focusTitle?: boolean;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusTitle) titleRef.current?.focus();
  }, [focusTitle, title]);
  return (
    <main className="flex min-h-screen items-start justify-center bg-canvas px-4 py-12 sm:items-center">
      <div className="w-full max-w-[400px]">
        <Link href="/" className="inline-flex items-center">
          <Logo height={46} />
        </Link>
        <div className="card mt-8 p-6">
          <h1 ref={titleRef} tabIndex={focusTitle ? -1 : undefined} className="font-display text-2xl leading-8 text-ink outline-none">
            {title}
          </h1>
          {description && <div className="mt-1 break-keep text-sm text-ink-2">{description}</div>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}

/** 이름표 + 입력칸 + 안내/오류 한 줄 */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="break-keep text-xs text-negative">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-msg`} className="break-keep text-xs text-ink-3">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** 폼 전체의 오류 (서버 응답 등) */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[10px] bg-negative-soft px-4 py-3 text-sm text-negative">
      {message}
    </p>
  );
}

/** 비밀번호 입력칸 + 보기/숨기기 버튼(모바일에서 가린 채 두 번 입력하지 않게) */
export function PasswordInput({ className = '', ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={shown ? 'text' : 'password'} className={`${className} pr-11`} />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? '비밀번호 숨기기' : '비밀번호 보기'}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-[10px] text-ink-3 hover:text-ink"
      >
        {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}
