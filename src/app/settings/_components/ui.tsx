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
    <section className="space-y-4">
      <div>
        <h3 className="font-display text-xl leading-7 text-ink">{title}</h3>
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
    // 조작(스위치·버튼)은 자리가 되면 설명 오른쪽에 두고, 넓은 조작(Segmented)만 좁은 화면에서 아래 줄로 내린다
    <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 lg:px-6">
      {htmlFor ? (
        // 조작과 이어진 행은 이름·설명 전체가 label 이라 글자 어디를 눌러도 스위치가 바뀐다
        <label htmlFor={htmlFor} className="block min-w-0 flex-1 basis-[180px] cursor-pointer">
          <span className="block text-[15px] font-medium text-ink">{label}</span>
          {description && <span className="mt-0.5 block text-[13px] text-ink-3">{description}</span>}
        </label>
      ) : (
        <div className="min-w-0 flex-1 basis-[180px]">
          <p className="text-[15px] font-medium text-ink">{label}</p>
          {description && <div className="mt-0.5 text-[13px] text-ink-3">{description}</div>}
        </div>
      )}
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
      // 보이는 크기는 44×24, 누르는 영역은 위아래로 10px 씩 넓혀 44×44
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors before:absolute before:inset-x-0 before:-inset-y-2.5 before:content-[''] disabled:opacity-50 ${
        checked ? 'bg-accent' : 'bg-line-strong'
      }`}
    >
      <span
        className={`inline-block size-5 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.16)] transition-transform ${
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
    <div role="radiogroup" aria-label={label} className="inline-flex h-11 items-center gap-0.5 rounded-[10px] bg-raised p-[3px] sm:h-9">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            // 터치 기기 폭에서는 칸을 44px 이상으로(높이 38 + 위아래 3px 누름 영역)
            className={`relative h-[38px] min-w-11 rounded-lg px-3 text-[13px] transition-colors before:absolute before:inset-x-0 before:-inset-y-[3px] before:content-[''] sm:h-[30px] sm:min-w-0 ${
              active ? 'bg-surface font-medium text-ink shadow-[inset_0_0_0_1px_var(--line)]' : 'text-ink-2 hover:text-ink'
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
    <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
      <AlertCircle size={20} strokeWidth={1.5} className="text-negative" aria-hidden />
      <p className="font-display text-base text-ink">불러오지 못했어요</p>
      <p className="text-sm text-ink-3">{message}</p>
      <button type="button" onClick={onRetry} className="btn-secondary mt-2">
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
