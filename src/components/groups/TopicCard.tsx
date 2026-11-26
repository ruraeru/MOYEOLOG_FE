'use client';

import React from 'react';
import { Image as ImageIcon, MessageSquare, Pin } from 'lucide-react';
import { stripMarkdown } from '@/lib/utils';
import { type TopicResponse } from '@/types/topic';
import { Avatar, relativeStamp } from './GroupUI';

interface TopicCardProps {
  topic: TopicResponse;
  onClick: () => void;
}

/** 토픽 카드: (고정 표시) 주아 제목, 한 줄 요약, 작성자·시각·댓글 수·사진 */
export function TopicCard({ topic, onClick }: TopicCardProps) {
  const summary = stripMarkdown(topic.content);
  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
      role="button"
      tabIndex={0}
      className="card flex cursor-pointer flex-col gap-2 px-4 py-4 transition-colors duration-150 hover:bg-group-wash md:px-5"
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {topic.pinnedAt && (
          <Pin size={14} strokeWidth={1.5} className="shrink-0 text-group-ink" aria-label="고정됨" role="img" />
        )}
        <h4 className="truncate font-display text-[17px] leading-6 text-ink">{topic.title}</h4>
      </div>
      {summary && <p className="hidden text-sm leading-relaxed text-ink-2 line-clamp-1 md:block">{summary}</p>}
      <div className="flex min-w-0 items-center gap-2 text-xs text-ink-3">
        <Avatar name={topic.authorNickname} src={topic.authorProfileImage} size="size-5" />
        <span className="truncate text-ink-2">{topic.authorNickname}</span>
        <span className="stamp shrink-0">{relativeStamp(topic.createdAt)}</span>
        <span className="ml-1.5 inline-flex shrink-0 items-center gap-1">
          <MessageSquare size={14} strokeWidth={1.5} aria-hidden />
          <span className="tabular-nums">댓글 {topic.commentCount}</span>
        </span>
        {topic.imageUrl && (
          <span className="ml-1.5 inline-flex shrink-0 items-center gap-1">
            <ImageIcon size={14} strokeWidth={1.5} aria-hidden />
            사진 1
          </span>
        )}
      </div>
    </div>
  );
}
