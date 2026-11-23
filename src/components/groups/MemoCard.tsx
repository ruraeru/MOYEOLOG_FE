'use client';

import React from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { stripMarkdown, getFileUrl } from '@/lib/utils';
import ImageWithFallback from '@/components/ImageWithFallback';
import { type MemoResponse } from '@/lib/memo-api';

interface MemoCardProps {
  memo: MemoResponse;
  viewMode: 'grid' | 'list';
  onClick: () => void;
}

export function MemoCard({ memo, viewMode, onClick }: MemoCardProps) {
  const isList = viewMode === 'list';
  const imageSrc = getFileUrl(memo.imageUrl);

  // 카드에는 보는 사람이 아니라 실제 작성자를 보여 준다
  const authorName = memo.authorNickname || '알 수 없음';
  const authorImage = getFileUrl(memo.authorProfileImage);

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
      role="button"
      tabIndex={0}
      className={`card transition-colors duration-150 ease-out group flex overflow-hidden cursor-pointer hover:bg-raised ${
        isList
          ? 'p-4 gap-4'
          : 'flex-col'
      }`}
    >
      {imageSrc && (
        <ImageWithFallback
          src={imageSrc}
          alt={memo.title}
          fill
          containerClassName={isList ? "size-20 sm:size-28 rounded-lg shrink-0 overflow-hidden" : "h-48 w-full bg-raised"}
          className="object-cover"
          unoptimized
        />
      )}
      <div className={isList ? "flex flex-col gap-2 flex-1 min-w-0" : "p-5 flex flex-col gap-3 flex-1 min-w-0"}>
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-ink text-base truncate">
            {memo.title}
          </h4>
        </div>
        <p className="text-sm text-ink-2 line-clamp-2 leading-relaxed flex-1">
          {stripMarkdown(memo.content)}
        </p>
        <div className="flex flex-wrap gap-2">
          {memo.tags?.slice(0, 3).map(tag => (
            <span key={tag} className="rounded-md bg-raised px-2 py-0.5 text-xs text-ink-2">
              #{tag}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-line">
          <div className="flex items-center gap-2 min-w-0">
             <div className="size-6 shrink-0 rounded-full bg-accent-soft flex items-center justify-center text-accent text-xs overflow-hidden relative">
               {authorImage ? (
                 <ImageWithFallback
                   src={authorImage}
                   alt={authorName}
                   fill
                   containerClassName="w-full h-full"
                   className="object-cover"
                   unoptimized
                 />
               ) : (
                 [...authorName][0]
               )}
             </div>
             <span className="text-xs text-ink-2 truncate">{authorName}</span>
          </div>
          <span className="stamp shrink-0">{format(new Date(memo.createdAt), 'M.d EEE', { locale: ko })}</span>
        </div>
      </div>
    </div>
  );
}
