'use client';

import React from 'react';
import { MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { stripMarkdown } from '@/lib/utils';
import ImageWithFallback from '@/components/ImageWithFallback';
import { type TopicResponse } from '@/types/topic';

interface TopicCardProps {
  topic: TopicResponse;
  viewMode: 'grid' | 'list';
  onClick: () => void;
}

export function TopicCard({ topic, viewMode, onClick }: TopicCardProps) {
  const isList = viewMode === 'list';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  
  return (
    <div 
      onClick={onClick} 
      className={`bg-white shadow-sm transition-all duration-500 group flex overflow-hidden cursor-pointer border border-transparent hover:border-indigo-100 ${
        isList 
          ? 'rounded-[2rem] p-6 gap-8 hover:shadow-lg hover:-translate-x-1' 
          : 'rounded-[3rem] flex-col hover:shadow-lg hover:-translate-y-2'
      }`}
    >
      {topic.imageUrl && (
        <ImageWithFallback 
          src={topic.imageUrl.startsWith('/uploads/') ? `${apiUrl}${topic.imageUrl}` : topic.imageUrl} 
          alt={topic.title} 
          fill 
          containerClassName={isList ? "w-40 h-40 rounded-2xl shrink-0 shadow-sm" : "h-56 w-full bg-gray-50"} 
          className="object-cover group-hover:scale-110 transition-transform duration-700" 
          unoptimized 
        />
      )}
      <div className={isList ? "flex flex-col flex-1 min-w-0 py-2" : "p-8 flex flex-col gap-5 flex-1 min-w-0"}>
        <div className="flex items-center justify-between">
          <h4 className="font-black text-gray-900 text-xl truncate group-hover:text-indigo-600 transition-colors tracking-tight">
            {topic.title}
          </h4>
          <div className="flex items-center gap-1.5 text-indigo-500 font-black text-[11px] bg-indigo-50 px-3 py-1 rounded-xl shadow-sm">
            <MessageSquare className="w-3.5 h-3.5" /> 
            {topic.commentCount}
          </div>
        </div>
        <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed font-bold flex-1">
          {stripMarkdown(topic.content)}
        </p>
        <div className="flex items-center justify-between pt-5 border-t border-gray-50 mt-auto">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full overflow-hidden relative bg-indigo-50 shadow-inner">
              {topic.authorProfileImage ? (
                <ImageWithFallback 
                  src={topic.authorProfileImage.startsWith('/uploads/') ? `${apiUrl}${topic.authorProfileImage}` : topic.authorProfileImage} 
                  alt="" 
                  fill 
                  containerClassName="w-full h-full"
                  className="object-cover" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[9px] text-indigo-500 font-black">
                  {topic.authorNickname[0]}
                </div>
              )}
            </div>
            <span className="text-[11px] text-gray-500 font-black tracking-tight">{topic.authorNickname}</span>
          </div>
          <span className="text-[11px] text-gray-300 font-black">{format(new Date(topic.createdAt), 'yyyy.MM.dd')}</span>
        </div>
      </div>
    </div>
  );
}
