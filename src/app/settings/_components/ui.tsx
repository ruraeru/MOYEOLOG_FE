'use client';

import { useSyncExternalStore } from 'react';
import { AlertCircle, RotateCw } from 'lucide-react';
import { PREF_CHANGE_EVENT, PREF_OPTIONS, type PrefName, type PrefValue } from '@/lib/constants';
import { getPref } from '@/lib/utils';

/** 설정 화면의 한 묶음 (제목 + 카드) */
export function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
      </div>
      <div className="card divide-y divide-line">{children}</div>
    </section>
  );
}

/** 카드 안의 한 줄: 왼쪽 설명, 오른쪽 조작 */
export function SettingsRow({
  label,
  description,
  children,
  htmlFor,
}: {
  label: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
            {label}
          </label>
        ) : (
          <p className="text-sm font-medium text-ink">{label}</p>
        )}
        {description && <div className="mt-0.5 text-sm text-ink-3">{description}</div>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}

/** 켜기/끄기 스위치 */
export function Toggle({
  id,
  checked,
  onChange,
  disabled,
  label,
}: {
  id?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-accent' : 'bg-line-strong'
      }`}
    >
      <span
        className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

/** 여러 값 중 하나를 고르는 버튼 묶음 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[10px] border border-line bg-raised p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`h-8 rounded-lg px-3 text-sm transition-colors ${
              active ? 'bg-surface text-ink font-medium shadow-sm' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** 불러오기에 실패했을 때 (빈 상태 대신) 보여 주는 안내와 다시 시도 버튼 */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
      <AlertCircle size={18} strokeWidth={1.5} className="text-negative" />
      <p className="text-sm text-ink-2">{message}</p>
      <button type="button" onClick={onRetry} className="btn-secondary">
        <RotateCw size={16} strokeWidth={1.5} />
        다시 시도
      </button>
    </div>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-[10px] bg-negative-soft px-4 py-3 text-sm text-negative">
      {message}
    </p>
  );
}

const subscribePrefs = (callback: () => void) => {
  window.addEventListener(PREF_CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(PREF_CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
};

/** 기기별 화면 설정 값을 읽고, 바뀌면(다른 탭 포함) 다시 그립니다. */
export function usePref<K extends PrefName>(name: K): PrefValue<K> {
  return useSyncExternalStore(
    subscribePrefs,
    () => getPref(name),
    () => PREF_OPTIONS[name][0] as PrefValue<K>
  );
}
