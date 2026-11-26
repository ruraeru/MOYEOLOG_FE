'use client';

/**
 * 화면 공통 부품 (캠핑 테마). 새 화면도 여기 것을 쓴다.
 * - PageHeader: 화면 제목(주아) + 개수 + 오른쪽 동작(만들기 버튼은 여기에 하나만)
 * - Ribbon: 모임 색 띠. 모임 색은 띠·점으로만 쓴다
 * - UnderlineTabs: 밑줄 탭 (선택 = 주아 + 주황 밑줄. 모임 화면 안에서는 모임 색의 진한 톤 밑줄)
 * - Segmented: 보기 전환 (월/주/목록, 카드/목록)
 * - EmptyState: 빈 상태
 * - Modal: 창 껍데기 (모바일은 아래에서 올라오는 시트, Esc·바깥 클릭으로 닫힘)
 * - SideItem / SideLabel: 왼쪽 목록 메뉴 행
 */

import React, { useEffect, useId, useRef } from 'react';
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
    // 제목은 최소 10rem 을 잡고 남는 폭에서 말줄임. 동작 버튼이 그 옆에 안 들어갈 때만 다음 줄로 내려간다
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <div className="min-w-0 flex-1 basis-40">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h1 className="font-display text-2xl leading-8 text-ink lg:text-[30px] lg:leading-9 truncate">{title}</h1>
          {count != null && <span className="stamp shrink-0 whitespace-nowrap text-sm text-ink-3">{count}</span>}
        </div>
        {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
      </div>
      {/* 좁은 화면에서 동작이 한 줄에 안 들어가면 화면 밖으로 밀지 않고 안에서 줄을 바꾼다 */}
      {actions && <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2 lg:gap-3">{actions}</div>}
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
  // 키보드: 선택 탭만 Tab 정지점, ←/→/Home/End 로 탭을 옮기며 바로 연다
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = items.findIndex((it) => it.key === active);
    const n = items.length;
    const next =
      e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (next < 0 || n === 0) return;
    e.preventDefault();
    onChange(items[next].key);
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };
  return (
    <div role="tablist" onKeyDown={onKeyDown} className={`flex gap-6 overflow-x-auto no-scrollbar border-b border-line ${className}`}>
      {items.map((it) => {
        const on = it.key === active;
        return (
          <button
            key={it.key}
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(it.key)}
            className="touch-hit relative flex shrink-0 items-center gap-1.5 pb-2.5 pt-1 pointer-coarse:pt-2.5"
          >
            {/* 선택 글꼴(주아)과 비선택 글꼴로 폭을 둘 다 잡아 두어(넓은 쪽) 선택이 바뀌어도 탭 폭이 흔들리지 않는다 */}
            <span className="inline-grid">
              <span className={`col-start-1 row-start-1 ${on ? 'font-display text-base text-ink' : 'text-[15px] text-ink-2 hover:text-ink'}`}>{it.label}</span>
              <span aria-hidden className="invisible col-start-1 row-start-1 h-0 font-display text-base">{it.label}</span>
              <span aria-hidden className="invisible col-start-1 row-start-1 h-0 text-[15px]">{it.label}</span>
            </span>
            {it.count != null && <span className="stamp text-xs">{it.count}</span>}
            <span
              aria-hidden
              className={`absolute bottom-[-1px] left-0 h-0.5 rounded-full bg-[var(--group-ink,var(--mark))] transition-[width,opacity] duration-200 ${on ? 'w-full opacity-100' : 'w-2 opacity-0'}`}
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
            className={`touch-hit inline-flex ${ih} items-center justify-center gap-1 rounded-lg transition-colors ${
              on ? 'bg-surface text-group-sel font-medium shadow-[inset_0_0_0_1px_var(--line)]' : 'text-ink-2 hover:text-ink'
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
      {description && <p className="max-w-xs break-keep text-sm text-ink-3">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/**
 * 최근에 포커스를 받은(또는 누른) 요소 몇 개. 창 안 입력칸의 autoFocus 는 Modal 의 effect 보다 먼저 돌아
 * 열 때의 document.activeElement 가 이미 새 창 안이므로, 닫을 때 돌아갈 곳(연 버튼)은 여기서 새 창 밖의 가장 최근 것을 찾는다.
 * (창 위에 연 창이면 아래 창 안의 버튼이 돌아갈 곳이다)
 */
const recentFocus: HTMLElement[] = [];
if (typeof document !== 'undefined') {
  const remember = (el: Element | null) => {
    if (!(el instanceof HTMLElement) || el === document.body) return;
    const i = recentFocus.indexOf(el);
    if (i >= 0) recentFocus.splice(i, 1);
    recentFocus.push(el);
    if (recentFocus.length > 8) recentFocus.shift();
  };
  document.addEventListener('focusin', (e) => remember(e.target instanceof Element ? e.target : null), true);
  // Safari 는 버튼을 눌러도 포커스를 주지 않으므로 누른 버튼·링크도 기억한다
  document.addEventListener(
    'pointerdown',
    (e) => remember(e.target instanceof Element ? e.target.closest('button,a[href],[role="button"],[role="tab"]') : null),
    true,
  );
}
const openerOutside = (dialog: HTMLElement | null) => {
  for (let i = recentFocus.length - 1; i >= 0; i--) {
    const el = recentFocus[i];
    if (el.isConnected && !dialog?.contains(el)) return el;
  }
  return null;
};

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[contenteditable="true"],[tabindex]:not([tabindex="-1"])';

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
  const dialogRef = useRef<HTMLDivElement>(null);
  // 키보드 사용자: 열면 창 안으로 포커스, Tab 은 창 안에서만 돌고, 닫으면 연 버튼으로 돌아간다
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const opener = active && active !== document.body && !dialog?.contains(active) ? active : openerOutside(dialog);
    const focusables = () =>
      dialog
        ? [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0)
        : [];
    const isTop = () => {
      const all = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      return all[all.length - 1] === dialog;
    };
    // 창 안의 autoFocus 가 먼저 잡았으면 그대로 둔다. 아니면 첫 입력칸 → 닫기가 아닌 첫 버튼 → 창 자체
    const t = window.setTimeout(() => {
      if (!dialog || dialog.contains(document.activeElement)) return;
      const els = focusables();
      const first =
        els.find((el) => el.matches('input:not([type=hidden]),textarea,select,[contenteditable="true"]')) ??
        els.find((el) => el.getAttribute('aria-label') !== '닫기') ??
        dialog;
      first.focus({ preventScroll: true });
    }, 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialog || !isTop()) return;
      const els = focusables();
      if (els.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const cur = document.activeElement;
      if (!dialog.contains(cur)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (cur === first || cur === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && cur === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);
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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby={title ? titleId : undefined}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92dvh] w-full ${w} flex-col overflow-hidden rounded-t-2xl bg-surface animate-slide-up md:max-h-[88vh] md:rounded-2xl md:animate-scale-in outline-none`}
      >
        {(title || headerExtra) && (
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4 md:px-6">
            <div className="min-w-0">
              {title && <h2 id={titleId} className="font-display text-xl leading-7 text-ink">{title}</h2>}
              {subtitle && <div className="mt-1 text-[13px] text-ink-3">{subtitle}</div>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {headerExtra}
              {/* 모바일(바텀시트)·터치 기기에서는 닫기 버튼을 44px 로 */}
              <button onClick={onClose} aria-label="닫기" className="btn-icon max-md:size-11 pointer-coarse:size-11">
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
