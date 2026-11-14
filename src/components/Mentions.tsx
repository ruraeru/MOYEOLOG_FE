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
    <div className="bg-raised text-ink-2 text-xs pl-1 pr-2 py-0.5 rounded-full flex items-center gap-1.5 relative">
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
        <button type="button" onClick={onRemove} className="text-ink-3 hover:text-ink transition-colors duration-150 ease-out">
          <X size={12} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}

interface MentionListProps {
  items: MentionItem[];
  onSelect: (item: MentionItem) => void;
  isMemo?: boolean;
}

export function MentionList({ items, onSelect, isMemo }: MentionListProps) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  return (
    <div className="absolute z-30 bottom-full mb-2 w-full bg-surface rounded-2xl shadow-float border border-line overflow-hidden py-2 max-h-48 overflow-y-auto no-scrollbar">
      {items.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onSelect(m)}
          className="w-full text-left px-4 py-3 hover:bg-raised transition-colors duration-150 ease-out border-b border-line last:border-0 text-sm text-ink"
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
                  <div className="w-full h-full bg-accent-soft flex items-center justify-center text-xs text-accent font-medium">
                    {(m.nickname || '')[0]}
                  </div>
                )}
              </div>
              {m.nickname}
            </div>
          )}
        </button>
      ))}
      {items.length === 0 && <div className="p-4 text-center text-sm text-ink-3">검색 결과가 없어요</div>}
    </div>
  );
}