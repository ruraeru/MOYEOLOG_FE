'use client';

/**
 * 화면 공통 부품 (캠핑 테마). 새 화면도 여기 것을 쓴다.
 * - PageHeader: 화면 제목(주아) + 개수 + 오른쪽 동작(만들기 버튼은 여기에 하나만)
 * - Ribbon: 모임 색 띠. 모임 색은 띠·점으로만 쓴다
 * - UnderlineTabs: 밑줄 탭 (선택 = 주아 + 주황 밑줄)
 * - Segmented: 보기 전환 (월/주/목록, 카드/목록)
 * - EmptyState: 빈 상태
 * - Modal: 창 껍데기 (모바일은 아래에서 올라오는 시트, Esc·바깥 클릭으로 닫힘)
 * - SideItem / SideLabel: 왼쪽 목록 메뉴 행
 */

import React, { useEffect, useId } from 'react';
import { X, type LucideIcon } from 'lucide-react';

export function PageHeader({
  title,
  count,
  description,
  actions,
  className = '',
}: {
  title: React.ReactNode;
  count?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2.5">
          <h1 className="font-display text-2xl leading-8 text-ink lg:text-[30px] lg:leading-9 truncate">{title}</h1>
          {count != null && <span className="stamp text-sm text-ink-3">{count}</span>}
        </div>
        {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 lg:gap-3">{actions}</div>}
    </div>
  );
}

/**
 * 모임 색 띠. color 는 hex (getThemeColors(theme).hex)
 * stretch: 부모 높이만큼 늘린다(카드 왼쪽 띠). width: 3(기본) 또는 4(모임 머리)
 */
export function Ribbon({ color, className, stretch, width = 3 }: { color: string; className?: string; stretch?: boolean; width?: 3 | 4 }) {
  const h = className ?? (stretch ? 'self-stretch' : 'h-5');
  return <span aria-hidden className={`inline-block ${width === 4 ? 'w-1' : 'w-[3px]'} shrink-0 rounded-full ${h}`} style={{ backgroundColor: color }} />;
}

/** 모임 색 점 */
export function Dot({ color, className = 'size-1.5' }: { color: string; className?: string }) {
  return <span aria-hidden className={`inline-block shrink-0 rounded-full ${className}`} style={{ backgroundColor: color }} />;
}

export interface TabItem<K extends string> {
  key: K;
  label: string;
  count?: number;
}

export function UnderlineTabs<K extends string>({
  items,
  active,
  onChange,
  className = '',
}: {
  items: TabItem<K>[];
  active: K;
  onChange: (key: K) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={`flex gap-6 overflow-x-auto no-scrollbar border-b border-line ${className}`}>
      {items.map((it) => {
        const on = it.key === active;
        return (
          <button
            key={it.key}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(it.key)}
            className="relative flex shrink-0 items-center gap-1.5 pb-2.5 pt-1"
          >
            <span className={on ? 'font-display text-base text-ink' : 'text-[15px] text-ink-2 hover:text-ink'}>{it.label}</span>
            {it.count != null && <span className="stamp text-xs">{it.count}</span>}
            <span
              aria-hidden
              className={`absolute bottom-[-1px] left-0 h-0.5 rounded-full bg-mark transition-[width,opacity] duration-200 ${on ? 'w-full opacity-100' : 'w-2 opacity-0'}`}
            />
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<K extends string>({
  items,
  active,
  onChange,
  size = 'md',
  ariaLabel,
}: {
  items: { key: K; label: React.ReactNode; title?: string }[];
  active: K;
  onChange: (key: K) => void;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}) {
  const h = size === 'sm' ? 'h-8' : 'h-9';
  const ih = size === 'sm' ? 'h-[26px] text-xs px-2.5' : 'h-[30px] text-[13px] px-3';
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`inline-flex ${h} items-center gap-0.5 rounded-[10px] bg-raised p-[3px]`}>
      {items.map((it) => {
        const on = it.key === active;
        return (
          <button
            key={it.key}
            role="radio"
            aria-checked={on}
            title={it.title}
            onClick={() => onChange(it.key)}
            className={`inline-flex ${ih} items-center justify-center gap-1 rounded-lg transition-colors ${
              on ? 'bg-surface text-ink font-medium shadow-[inset_0_0_0_1px_var(--line)]' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 px-6 py-12 text-center ${className}`}>
      {Icon && <Icon size={20} strokeWidth={1.5} className="mb-1 text-ink-3" aria-hidden />}
      <p className="font-display text-lg text-ink">{title}</p>
      {description && <p className="max-w-xs text-sm text-ink-3">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/**
 * 창 껍데기. 내용·버튼은 children/footer 로.
 * size: sm 420 · md 560 · lg 720 · xl 960
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  headerExtra,
  footer,
  size = 'md',
  children,
  bodyClassName = '',
  zIndex = 'z-[110]',
  closeOnEsc = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  bodyClassName?: string;
  zIndex?: string;
  /** 창이 자체 Esc 처리(멘션 목록 → 수정 취소 → 닫기 등)를 가지면 false */
  closeOnEsc?: boolean;
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open || !closeOnEsc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, closeOnEsc]);
  if (!open) return null;
  const w = { sm: 'md:max-w-[420px]', md: 'md:max-w-[560px]', lg: 'md:max-w-[720px]', xl: 'md:max-w-[960px]' }[size];
  return (
    <div className={`fixed inset-0 ${zIndex} flex items-end justify-center bg-black/40 md:items-center md:p-4`} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92dvh] w-full ${w} flex-col overflow-hidden rounded-t-2xl bg-surface animate-slide-up md:max-h-[88vh] md:rounded-2xl md:animate-scale-in`}
      >
        {(title || headerExtra) && (
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4 md:px-6">
            <div className="min-w-0">
              {title && <h2 id={titleId} className="font-display text-xl leading-7 text-ink">{title}</h2>}
              {subtitle && <div className="mt-1 text-[13px] text-ink-3">{subtitle}</div>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {headerExtra}
              <button onClick={onClose} aria-label="닫기" className="btn-icon">
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        )}
        <div className={`min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6 ${bodyClassName}`}>{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3 md:px-6 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

/** 왼쪽 목록 메뉴의 소제목 */
export function SideLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pb-1.5 pt-5 text-xs font-medium text-ink-3 first:pt-0">{children}</p>;
}

/** 왼쪽 목록 메뉴 행. icon 또는 ribbon(hex) 중 하나 */
export function SideItem({
  label,
  icon: Icon,
  ribbon,
  count,
  active,
  current,
  onClick,
  href,
  as: As,
}: {
  label: React.ReactNode;
  icon?: LucideIcon;
  ribbon?: string;
  count?: React.ReactNode;
  active?: boolean;
  /** 버튼 모드에서 aria-pressed 대신 aria-current="page" 를 쓴다 (설정 메뉴처럼 화면을 바꾸는 메뉴) */
  current?: boolean;
  onClick?: () => void;
  href?: string;
  as?: React.ElementType;
}) {
  const cls = `flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm transition-colors ${
    active ? 'bg-surface font-medium text-ink shadow-[inset_0_0_0_1px_var(--line)]' : 'text-ink-2 hover:bg-raised hover:text-ink'
  }`;
  const inner = (
    <>
      {ribbon ? <Ribbon color={ribbon} className="h-4" /> : Icon ? <Icon size={16} strokeWidth={1.5} className={active ? 'text-ink' : 'text-ink-3'} aria-hidden /> : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count != null && <span className="stamp text-xs">{count}</span>}
    </>
  );
  if (As && href) {
    return (
      <As href={href} className={cls} aria-current={active ? 'page' : undefined}>
        {inner}
      </As>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cls}
      aria-pressed={current ? undefined : active}
      aria-current={current && active ? 'page' : undefined}
    >
      {inner}
    </button>
  );
}
