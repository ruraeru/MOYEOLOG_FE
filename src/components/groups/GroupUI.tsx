'use client';

import React from 'react';
import { RotateCw } from 'lucide-react';
import { differenceInMinutes, format, isToday, isYesterday } from 'date-fns';
import ImageWithFallback from '@/components/ImageWithFallback';
import { getFileUrl, initialOf } from '@/lib/utils';

// ─── 모임 화면 작은 부품 ───────────────────────────────────────

/** 태그 칩. 선택되면 갈색 */
export function TagBadge({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-md px-2.5 text-xs transition-colors duration-150 ${
        active ? 'bg-accent text-white' : 'bg-raised text-ink-2 hover:text-ink'
      }`}
    >
      #{label}
    </button>
  );
}

/** 사람 얼굴. 사진이 없으면 첫 글자 */
export function Avatar({
  name,
  src,
  size = 'size-6',
  className = '',
}: {
  name?: string | null;
  src?: string | null;
  /** Tailwind size-* 클래스 */
  size?: string;
  className?: string;
}) {
  const url = getFileUrl(src);
  const text = size === 'size-10' ? 'text-sm' : size === 'size-8' ? 'text-xs' : 'text-[11px]';
  return (
    <span className={`relative inline-flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised ${text} font-medium text-ink-2 ${className}`}>
      {url ? (
        <ImageWithFallback src={url} alt="" fill containerClassName="w-full h-full" className="object-cover" unoptimized />
      ) : (
        initialOf(name)
      )}
    </span>
  );
}

/** 겹친 얼굴 묶음 (최대 max 명, 나머지는 +N) */
export function AvatarStack({
  people,
  max = 4,
  size = 'size-7',
}: {
  people: Array<{ id: string; nickname: string; profileImage?: string }>;
  max?: number;
  size?: string;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="flex items-center -space-x-1.5">
      {shown.map((p) => (
        <Avatar key={p.id} name={p.nickname} src={p.profileImage} size={size} className="ring-2 ring-surface" />
      ))}
      {rest > 0 && (
        <span className={`relative inline-flex ${size} items-center justify-center rounded-full bg-raised text-[11px] font-medium text-ink-2 tabular-nums ring-2 ring-surface`}>
          +{rest}
        </span>
      )}
    </span>
  );
}

/** 토픽·메모 시각: 방금 · N분 전 · N시간 전 · 어제 · 11.20 */
export function relativeStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mins = differenceInMinutes(new Date(), d);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  if (isToday(d)) return `${Math.floor(mins / 60)}시간 전`;
  if (isYesterday(d)) return '어제';
  return format(d, d.getFullYear() === new Date().getFullYear() ? 'M.d' : 'yy.M.d');
}

/** 목록을 불러오지 못했을 때 빈 상태 대신 보여 주는 오류 상태 */
export function ErrorState({ message, onRetry }: { message: string, onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="font-display text-lg text-ink">불러오지 못했어요</p>
      <p className="max-w-xs text-sm text-ink-3">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary mt-3">
          <RotateCw size={16} strokeWidth={1.5} /> 다시 시도
        </button>
      )}
    </div>
  );
}
