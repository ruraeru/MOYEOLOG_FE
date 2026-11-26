'use client';

import React from 'react';
import { format } from 'date-fns';
import { Image as ImageIcon, Pin } from 'lucide-react';
import { stripMarkdown, getFileUrl } from '@/lib/utils';
import ImageWithFallback from '@/components/ImageWithFallback';
import { type MemoResponse } from '@/lib/memo-api';

interface MemoCardProps {
  memo: MemoResponse;
  viewMode: 'grid' | 'list';
  /**
   * 왼쪽 띠를 그릴지. 띠 색은 hex 대신 모임 화면 루트의 group 토큰(bg-group)을 따른다.
   * (예전 호출과 맞추려고 hex 문자열을 그대로 받는다. 값은 띠 유무로만 쓴다)
   */
  color?: string;
  onClick: () => void;
  /** 고정·해제. 주면 고정 권한(permissions.pin)이 있는 사람에게 버튼을 보인다 */
  onTogglePin?: () => void;
}

export function MemoCard({ memo, viewMode, color, onClick, onTogglePin }: MemoCardProps) {
  const isList = viewMode === 'list';
  const imageSrc = getFileUrl(memo.imageUrl);

  // 카드에는 보는 사람이 아니라 실제 작성자를 보여 준다
  const authorName = memo.authorNickname || '알 수 없음';
  const summary = stripMarkdown(memo.content);

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
      role="button"
      tabIndex={0}
      className={`card relative flex cursor-pointer gap-4 overflow-hidden transition-colors duration-150 hover:bg-group-wash ${
        isList ? 'items-center px-4 py-3 md:px-5' : 'flex-col p-5'
      }`}
    >
      {color && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-group" />}

      <div className={`flex min-w-0 flex-1 flex-col ${isList ? 'gap-1' : 'gap-2'}`}>
        <div className="flex items-start justify-between gap-3">
          <h4 className="truncate font-display text-[17px] leading-6 text-ink">{memo.title}</h4>
          {onTogglePin && memo.permissions?.pin ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
              onKeyDown={(e) => e.stopPropagation()}
              aria-label={memo.pinnedAt ? '고정 해제' : '고정'}
              aria-pressed={!!memo.pinnedAt}
              title={memo.pinnedAt ? '고정 해제' : '고정'}
              className={`btn-icon -mr-1.5 -mt-1 shrink-0 ${memo.pinnedAt ? 'text-group-ink hover:text-group-ink' : 'text-ink-3'}`}
            >
              <Pin size={16} strokeWidth={1.5} className={memo.pinnedAt ? 'fill-current' : ''} />
            </button>
          ) : memo.pinnedAt && (
            <Pin size={16} strokeWidth={1.5} className="mt-1 shrink-0 fill-current text-group-ink" aria-label="고정됨" />
          )}
        </div>
        {summary && (
          <p className={`text-sm leading-relaxed text-ink-2 ${isList ? 'line-clamp-1' : 'line-clamp-3'}`}>{summary}</p>
        )}
        {!isList && (memo.tags?.length > 0 || imageSrc) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {memo.tags?.slice(0, 3).map(tag => (
              <span key={tag} className="chip">#{tag}</span>
            ))}
            {imageSrc && (
              <span className="inline-flex items-center gap-1 text-xs text-ink-3">
                <ImageIcon size={14} strokeWidth={1.5} aria-hidden /> 사진 1장
              </span>
            )}
          </div>
        )}
        <div className={`flex items-center justify-between gap-2 ${isList ? '' : 'mt-auto pt-1'}`}>
          {/* groupId 가 없는 메모는 작성자가 이 모임에 공유한 개인 메모다(멤버는 읽기만) */}
          <span className="truncate text-xs text-ink-3">{authorName}{!memo.groupId && ' · 공유된 메모'}</span>
          <span className="stamp shrink-0">{format(new Date(memo.createdAt), 'M.d')}</span>
        </div>
      </div>

      {isList && imageSrc && (
        <ImageWithFallback
          src={imageSrc}
          alt={memo.title}
          fill
          containerClassName="size-14 shrink-0 overflow-hidden rounded-lg"
          className="object-cover"
          unoptimized
        />
      )}
    </div>
  );
}
