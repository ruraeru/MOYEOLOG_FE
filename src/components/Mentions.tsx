'use client';

import React from 'react';
import ImageWithFallback from './ImageWithFallback';
import { X } from 'lucide-react';

export interface MentionItem {
  id: string;
  title?: string;
  nickname?: string;
  profileImage?: string;
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
      <span className="truncate max-w-[100px]">{label}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`${label} 빼기`} className="text-ink-3 hover:text-ink transition-colors duration-150 ease-out">
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
  /** 키보드로 고르는 중인 항목(↑↓). 없으면 표시하지 않는다 */
  activeIndex?: number;
  /** 목록을 입력칸 위(기본) 또는 아래에 띄운다 */
  placement?: 'top' | 'bottom';
}

export function MentionList({ items, onSelect, isMemo, activeIndex, placement = 'top' }: MentionListProps) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  return (
    <div role="listbox" className={`absolute z-30 ${placement === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'} w-full bg-surface rounded-xl shadow-float border border-line overflow-hidden p-1 max-h-48 overflow-y-auto no-scrollbar`}>
      {items.map((m, i) => (
        <button
          key={m.id}
          type="button"
          role="option"
          aria-selected={activeIndex === i}
          // 누를 때 입력칸 포커스를 뺏지 않는다(고른 뒤 바로 이어 쓰기)
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(m)}
          ref={activeIndex === i ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
          className={`w-full min-h-9 text-left px-3 py-2 rounded-lg hover:bg-raised transition-colors duration-150 ease-out text-sm text-ink ${activeIndex === i ? 'bg-raised' : ''}`}
        >
          {isMemo ? (
            m.title
          ) : (
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-full bg-raised relative shrink-0 overflow-hidden">
                {m.profileImage ? (
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
      {items.length === 0 && <div className="px-3 py-4 text-center text-sm text-ink-3">찾는 결과가 없어요</div>}
    </div>
  );
}