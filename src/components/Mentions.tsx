'use client';

import React, { useEffect, useRef, useState } from 'react';
import ImageWithFallback from './ImageWithFallback';
import { X } from 'lucide-react';

export interface MentionItem {
  id: string;
  title?: string;
  nickname?: string;
  profileImage?: string;
  /** 사진·이니셜 대신 보여 줄 아이콘 (예: '전체') */
  icon?: React.ReactNode;
}

interface ChipProps {
  label: string;
  image?: string;
  icon?: React.ReactNode;
  onRemove?: () => void;
}

export function Chip({ label, image, icon, onRemove }: ChipProps) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  return (
    <div className="bg-raised text-ink-2 text-xs h-7 pl-1 pr-2 rounded-full flex items-center gap-1.5 relative">
      {image ? (
        <ImageWithFallback 
          src={image.startsWith('/uploads/') ? `${apiUrl}${image}` : image} 
          alt={label} 
          fill 
          containerClassName="size-5 rounded-full shrink-0" 
          className="object-cover" 
          unoptimized
        />
      ) : (
        <div className="size-5 rounded-full bg-surface flex items-center justify-center text-ink-3 shrink-0">
          {icon || label[0]}
        </div>
      )}
      <span className="truncate max-w-[100px]" title={label}>{label}</span>
      {onRemove && (
        // 보이는 크기는 14px 그대로, 누르는 영역만 위아래로 넓힌다(옆 칩과 겹치지 않게 좌우는 8px).
        <button type="button" onClick={onRemove} aria-label={`${label} 빼기`} className="relative text-ink-3 hover:text-ink transition-colors duration-150 ease-out after:absolute after:-inset-x-2 after:-inset-y-[15px] after:content-['']">
          <X size={14} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}

interface MentionListProps {
  items: MentionItem[];
  onSelect: (item: MentionItem) => void;
  isMemo?: boolean;
  /** 키보드로 고르는 중인 항목(↑↓). 주면 부모가 키를 처리하고(제어), 안 주면 목록이 스스로 ↑↓·Enter·Esc 를 받는다 */
  activeIndex?: number;
  /** 목록을 입력칸 위(기본) 또는 아래에 띄운다 */
  placement?: 'top' | 'bottom';
  /** 후보가 없을 때 문구 (기본 '찾는 결과가 없어요') */
  emptyText?: string;
  /** 주면 Esc 로 목록만 닫는다(창 전체가 닫히지 않게) */
  onClose?: () => void;
}

export function MentionList({ items, onSelect, isMemo, activeIndex, placement = 'top', emptyText = '찾는 결과가 없어요', onClose }: MentionListProps) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  // 화살표로 고른 후보. 화살표를 누르기 전(-1)에는 Enter 를 가로채지 않는다.
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  // 부모가 activeIndex 를 주면(토픽 댓글) 부모가 키를 처리하므로 아래 키 처리는 쉰다(두 번 움직이지 않게)
  const controlled = activeIndex !== undefined;
  const shown = controlled ? activeIndex : active;
  const state = useRef({ items, onSelect, onClose, active, controlled });
  useEffect(() => { state.current = { items, onSelect, onClose, active, controlled }; });

  // 후보 수가 바뀌면(글자를 더 치면) 고른 줄을 처음으로 되돌린다.
  const [prevCount, setPrevCount] = useState(items.length);
  if (prevCount !== items.length) {
    setPrevCount(items.length);
    setActive(-1);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { items: list, onSelect: select, onClose: close, active: cur, controlled: byParent } = state.current;
      if (e.isComposing || byParent) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!list.length) return;
        e.preventDefault();
        const next = e.key === 'ArrowDown' ? (cur + 1) % list.length : (cur <= 0 ? list.length - 1 : cur - 1);
        setActive(next);
        listRef.current?.querySelectorAll('button')[next]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && cur >= 0 && list[cur]) {
        e.preventDefault();
        e.stopPropagation();
        select(list[cur]);
      } else if (e.key === 'Escape' && close) {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <div ref={listRef} role="listbox" className={`absolute z-30 ${placement === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'} w-full bg-surface rounded-xl shadow-float border border-line overflow-hidden p-1 max-h-48 overflow-y-auto no-scrollbar`}>
      {items.map((m, i) => (
        <button
          key={m.id}
          type="button"
          role="option"
          aria-selected={i === shown}
          // 누를 때 입력칸 포커스를 뺏지 않는다(고른 뒤 바로 이어 쓰기)
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(m)}
          ref={controlled && activeIndex === i ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
          className={`w-full min-h-11 md:min-h-9 text-left px-3 py-2 rounded-lg hover:bg-raised transition-colors duration-150 ease-out text-sm text-ink ${i === shown ? 'bg-raised' : ''}`}
        >
          {isMemo ? (
            m.title
          ) : (
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-full bg-raised relative shrink-0 overflow-hidden">
                {m.icon ? (
                  <div className="w-full h-full flex items-center justify-center text-ink-2">{m.icon}</div>
                ) : m.profileImage ? (
                  <ImageWithFallback 
                    src={m.profileImage.startsWith('/uploads/') ? `${apiUrl}${m.profileImage}` : m.profileImage} 
                    alt={m.nickname || ''} 
                    fill 
                    containerClassName="w-full h-full"
                    className="object-cover" 
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full bg-raised flex items-center justify-center text-xs text-ink-2">
                    {(m.nickname || '')[0]}
                  </div>
                )}
              </div>
              {m.nickname}
            </div>
          )}
        </button>
      ))}
      {items.length === 0 && <div className="px-3 py-4 text-center text-sm text-ink-3">{emptyText}</div>}
    </div>
  );
}