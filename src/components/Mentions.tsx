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
  return (
    <div className="bg-indigo-50 text-indigo-700 text-[10px] font-black pl-1.5 pr-3 py-1.5 rounded-full flex items-center gap-1.5 border border-indigo-100 shadow-sm">
      {image ? (
        <ImageWithFallback 
          src={image} 
          alt={label} 
          fill 
          containerClassName="w-5 h-5 rounded-full border border-indigo-200 shrink-0" 
          className="object-cover" 
        />
      ) : (
        <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center border border-indigo-200 text-indigo-500 shrink-0">
          {icon || label[0]}
        </div>
      )}
      <span className="truncate max-w-[100px]">{label}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} className="hover:text-indigo-900 transition-colors">
          <X className="w-3 h-3" />
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
  return (
    <div className="absolute z-30 bottom-full mb-2 w-full bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden py-2 max-h-48 overflow-y-auto">
      {items.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onSelect(m)}
          className="w-full text-left px-5 py-3 hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0 font-bold text-sm text-gray-800"
        >
          {isMemo ? (
            m.title
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-200 relative shrink-0 overflow-hidden">
                {m.profileImage ? (
                  <ImageWithFallback src={m.profileImage} alt={m.nickname || ''} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full bg-indigo-100 flex items-center justify-center text-[10px] text-indigo-600 font-bold">
                    {(m.nickname || '')[0]}
                  </div>
                )}
              </div>
              {m.nickname}
            </div>
          )}
        </button>
      ))}
      {items.length === 0 && <div className="p-4 text-center text-xs text-gray-400">검색 결과가 없습니다.</div>}
    </div>
  );
}