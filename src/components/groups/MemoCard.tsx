'use client';

import React from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { stripMarkdown } from '@/lib/utils';
import ImageWithFallback from '@/components/ImageWithFallback';
import { type MemoResponse } from '@/lib/memo-api';
import { useSession } from 'next-auth/react';

interface MemoCardProps {
  memo: MemoResponse;
  viewMode: 'grid' | 'list';
  onClick: () => void;
}

export function MemoCard({ memo, viewMode, onClick }: MemoCardProps) {
  const { data: session } = useSession();
  const isList = viewMode === 'list';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const imageSrc = memo.imageUrl ? (memo.imageUrl.startsWith('/uploads/') ? `${apiUrl}${memo.imageUrl}` : memo.imageUrl) : null;
  
  const userName = session?.user?.name || '나';
  const userImage = session?.user?.image;

  return (
    <div 
      onClick={onClick} 
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
          containerClassName={isList ? "size-28 rounded-lg shrink-0 overflow-hidden" : "h-48 w-full bg-raised"} 
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
        <div className="flex items-center justify-between pt-3 border-t border-line">
          <div className="flex items-center gap-2">
             <div className="size-6 rounded-full bg-accent-soft flex items-center justify-center text-accent text-xs overflow-hidden relative">
               {userImage ? (
                 <ImageWithFallback 
                   src={userImage} 
                   alt={userName} 
                   fill 
                   containerClassName="w-full h-full"
                   className="object-cover"
                   unoptimized
                 />
               ) : (
                 userName[0]
               )}
             </div>
             <span className="text-xs text-ink-2">{userName}</span>
          </div>
          <span className="stamp">{format(new Date(memo.createdAt), 'M.d EEE', { locale: ko })}</span>
        </div>
      </div>
    </div>
  );
}
