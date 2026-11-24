'use client';

/**
 * 모임의 얼굴: 모임 색 · 프로필 사진 · 배경 사진을 화면에 드러내는 공통 부품.
 * - groupStyle(theme): 모임 화면 루트에 style 로 깔면 그 안에서 bg-group / text-group-ink / bg-group-wash / bg-group-soft 가 모임 색이 된다
 * - GroupAvatar: 모임 프로필 사진. 없으면 모임 색 바탕 + 이름 첫 글자(주아)
 * - GroupCover: 모임 배경 사진. 없으면 모임 색 옅은 바탕 + 천막 줄무늬
 * 주의: 모임 색 위에 흰 글자를 올리지 않는다(노랑·하늘색 대비 부족). 글자는 text-group-ink 또는 text-ink.
 */

import React from 'react';
import ImageWithFallback from '@/components/ImageWithFallback';
import { getFileUrl, getThemeColors, initialOf } from '@/lib/utils';

export function groupTone(theme?: string | null) {
  const c = getThemeColors(theme ?? undefined);
  return {
    hex: c.hex,
    ink: c.ink,
    /** 아주 옅은 바탕 (표지 없음, 선택 행) */
    wash: `color-mix(in srgb, ${c.hex} 12%, var(--surface))`,
    /** 조금 더 진한 바탕 (프로필 사진 없음) */
    soft: `color-mix(in srgb, ${c.hex} 24%, var(--surface))`,
  };
}

/** 모임 화면 루트에 깐다: <div style={groupStyle(group.colorTheme)}> */
export function groupStyle(theme?: string | null): React.CSSProperties {
  const t = groupTone(theme);
  return {
    '--group': t.hex,
    '--group-ink': t.ink,
    '--group-wash': t.wash,
    '--group-soft': t.soft,
  } as React.CSSProperties;
}

const AVATAR_SIZES = {
  xs: { box: 'size-5', radius: 'rounded-[5px]', text: 'text-[11px]' },
  sm: { box: 'size-7', radius: 'rounded-md', text: 'text-sm' },
  md: { box: 'size-10', radius: 'rounded-lg', text: 'text-lg' },
  lg: { box: 'size-14', radius: 'rounded-xl', text: 'text-2xl' },
  xl: { box: 'size-20', radius: 'rounded-2xl', text: 'text-[32px]' },
} as const;

export type GroupAvatarSize = keyof typeof AVATAR_SIZES;

/** 모임 프로필 사진 (사람 얼굴과 구분되게 둥근 사각형) */
export function GroupAvatar({
  name,
  src,
  theme,
  size = 'md',
  className = '',
}: {
  name?: string | null;
  /** group.profileImage (서버 경로) 또는 미리보기 data/blob URL */
  src?: string | null;
  theme?: string | null;
  size?: GroupAvatarSize;
  className?: string;
}) {
  const s = AVATAR_SIZES[size];
  const url = src && (src.startsWith('data:') || src.startsWith('blob:')) ? src : getFileUrl(src);
  const t = groupTone(theme);
  return (
    <span
      aria-hidden
      className={`relative inline-flex ${s.box} ${s.radius} shrink-0 items-center justify-center overflow-hidden font-display leading-none ${s.text} ${className}`}
      style={url ? undefined : { backgroundColor: t.soft, color: t.ink }}
    >
      {url ? (
        <ImageWithFallback src={url} alt="" fill containerClassName="w-full h-full" className="object-cover" unoptimized />
      ) : (
        initialOf(name)
      )}
    </span>
  );
}

/** 모임 배경 사진 띠. 크기·모서리는 className 으로 (예: 'h-36 rounded-xl') */
export function GroupCover({
  src,
  theme,
  className = '',
  children,
}: {
  src?: string | null;
  theme?: string | null;
  className?: string;
  children?: React.ReactNode;
}) {
  const url = src && (src.startsWith('data:') || src.startsWith('blob:')) ? src : getFileUrl(src);
  const t = groupTone(theme);
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={
        url
          ? undefined
          : {
              backgroundColor: t.wash,
              backgroundImage: `repeating-linear-gradient(135deg, transparent 0 18px, color-mix(in srgb, ${t.hex} 14%, transparent) 18px 19px)`,
            }
      }
    >
      {url && <ImageWithFallback src={url} alt="" fill containerClassName="!absolute inset-0" className="object-cover" unoptimized />}
      {children}
    </div>
  );
}
