'use client';

import React from 'react';
import { Star } from 'lucide-react';
import { format } from 'date-fns';
import { stripMarkdown } from '@/lib/utils';
import ImageWithFallback from '@/components/ImageWithFallback';
import { type MemoResponse } from '@/lib/memo-api';

interface MemoCardProps {
  memo: MemoResponse;
  viewMode: 'grid' | 'list';
  onClick: () => void;
}

export function MemoCard({ memo, viewMode, onClick }: MemoCardProps) {
  const isList = viewMode === 'list';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const imageSrc = memo.imageUrl ? (memo.imageUrl.startsWith('/uploads/') ? `${apiUrl}${memo.imageUrl}` : memo.imageUrl) : null;
  
  return (
    <div 
      onClick={onClick} 
      className={`bg-white shadow-sm transition-all duration-500 group flex overflow-hidden cursor-pointer border border-transparent hover:border-indigo-100 ${
        isList 
          ? 'rounded-[2rem] p-6 gap-8 hover:shadow-lg hover:-translate-x-1' 
          : 'rounded-[3rem] flex-col hover:shadow-lg hover:-translate-y-2'
      }`}
    >
      {imageSrc && (
        <ImageWithFallback 
          src={imageSrc} 
          alt={memo.title} 
          fill 
          containerClassName={isList ? "w-40 h-40 rounded-2xl shrink-0 shadow-sm" : "h-56 w-full bg-gray-50"} 
          className="object-cover group-hover:scale-110 transition-transform duration-700" 
          unoptimized 
        />
      )}
      <div className={isList ? "flex flex-col flex-1 min-w-0 py-2" : "p-8 flex flex-col gap-5 flex-1 min-w-0"}>
        <div className="flex items-center justify-between">
          <h4 className="font-black text-gray-900 text-xl truncate group-hover:text-indigo-600 transition-colors tracking-tight">
            {memo.title}
          </h4>
        </div>
        <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed font-bold flex-1">
          {stripMarkdown(memo.content)}
        </p>
        <div className="flex flex-wrap gap-2">
          {memo.tags?.slice(0, 3).map(tag => (
            <span key={tag} className="text-[10px] text-indigo-500 font-black bg-indigo-50/50 px-3 py-1 rounded-xl">
              #{tag}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between pt-5 border-t border-gray-50 mt-2">
          <div className="flex items-center gap-3">
             <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center text-indigo-500 text-[9px] font-black shadow-inner">
               {memo.authorNickname[0]}
             </div>
             <span className="text-[11px] text-gray-500 font-black tracking-tight">{memo.authorNickname}</span>
          </div>
          <span className="text-[11px] text-gray-300 font-black">{format(new Date(memo.createdAt), 'yyyy.MM.dd')}</span>
        </div>
      </div>
    </div>
  );
}
