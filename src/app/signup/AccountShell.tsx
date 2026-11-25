import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * 로그인 없이 여는 계정 화면(/signup, /verify, /reset-password)의 껍데기.
 * 로그인 화면과 같은 로고 + 가운데 좁은 카드.
 */
export function AccountShell({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-start justify-center bg-canvas px-4 py-12 sm:items-center">
      <div className="w-full max-w-[400px]">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <span aria-hidden className="h-[22px] w-[3px] rounded-full bg-mark" />
          <span className="font-display text-2xl leading-none text-ink">모여로그</span>
        </Link>
        <div className="card mt-8 p-6">
          <h1 className="font-display text-2xl leading-8 text-ink">{title}</h1>
          {description && <div className="mt-1 text-sm text-ink-2">{description}</div>}
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
        <p id={`${id}-msg`} className="text-xs text-negative">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-msg`} className="text-xs text-ink-3">
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
