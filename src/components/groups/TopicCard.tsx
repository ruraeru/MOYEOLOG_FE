'use client';

import React from 'react';
import { MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
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
      className={`card transition-colors duration-150 ease-out group flex overflow-hidden cursor-pointer hover:bg-raised ${
        isList 
          ? 'p-4 gap-4' 
          : 'flex-col'
      }`}
    >
      {topic.imageUrl && (
        <ImageWithFallback 
          src={topic.imageUrl.startsWith('/uploads/') ? `${apiUrl}${topic.imageUrl}` : topic.imageUrl} 
          alt={topic.title} 
          fill 
          containerClassName={isList ? "size-28 rounded-lg shrink-0 overflow-hidden" : "h-48 w-full bg-raised"} 
          className="object-cover" 
          unoptimized 
        />
      )}
      <div className={isList ? "flex flex-col gap-2 flex-1 min-w-0" : "p-5 flex flex-col gap-3 flex-1 min-w-0"}>
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-semibold text-ink text-base truncate">
            {topic.title}
          </h4>
          <div className="flex items-center gap-1 text-ink-3 text-xs tabular-nums shrink-0">
            <MessageSquare size={16} strokeWidth={1.5} /> 
            {topic.commentCount}
          </div>
        </div>
        <p className="text-sm text-ink-2 line-clamp-2 leading-relaxed flex-1">
          {stripMarkdown(topic.content)}
        </p>
        <div className="flex items-center justify-between pt-3 border-t border-line mt-auto">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-full overflow-hidden relative bg-accent-soft">
              {topic.authorProfileImage ? (
                <ImageWithFallback 
                  src={topic.authorProfileImage.startsWith('/uploads/') ? `${apiUrl}${topic.authorProfileImage}` : topic.authorProfileImage} 
                  alt="" 
                  fill 
                  containerClassName="w-full h-full"
                  className="object-cover" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-accent">
                  {topic.authorNickname[0]}
                </div>
              )}
            </div>
            <span className="text-xs text-ink-2">{topic.authorNickname}</span>
          </div>
          <span className="stamp">{format(new Date(topic.createdAt), 'M.d EEE', { locale: ko })}</span>
        </div>
      </div>
    </div>
  );
}
