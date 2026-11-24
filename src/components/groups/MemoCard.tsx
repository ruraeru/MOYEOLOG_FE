'use client';

import React from 'react';
import { format } from 'date-fns';
import { Image as ImageIcon, Star } from 'lucide-react';
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
}

export function MemoCard({ memo, viewMode, color, onClick }: MemoCardProps) {
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
          {memo.isFavorite && (
            <Star size={16} strokeWidth={1.5} className="mt-1 shrink-0 fill-current text-ink-2" aria-label="즐겨찾기" />
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
          <span className="truncate text-xs text-ink-3">{authorName}</span>
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
