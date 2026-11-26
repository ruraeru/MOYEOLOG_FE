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
  /** 모임 고정·해제. 주면 모임 고정 권한(permissions.groupPin)이 있는 사람에게 버튼을 보인다 */
  onTogglePin?: () => void;
}

export function MemoCard({ memo, viewMode, color, onClick, onTogglePin }: MemoCardProps) {
  const isList = viewMode === 'list';
  const imageSrc = getFileUrl(memo.imageUrl);

  // 카드에는 보는 사람이 아니라 실제 작성자를 보여 준다
  const authorName = memo.authorNickname || '알 수 없음';
  const summary = stripMarkdown(memo.content);
  // 모임 화면은 모임 고정(groupPinnedAt)만 그린다. 모임에 공유된 개인 메모(groupId 없음)에는 그리지 않는다
  const isGroupMemo = !!memo.groupId;
  const groupPinned = !!memo.groupPinnedAt;

  // 카드 태그는 3개까지, 나머지는 +N 으로
  const shownTags = memo.tags?.slice(0, 3) ?? [];
  const hiddenTagCount = (memo.tags?.length ?? 0) - shownTags.length;

  return (
    // 카드 전체를 누르는 영역은 제목 버튼(after:inset-0)이 맡는다. 버튼 안에 버튼이 들어가지 않게 바깥은 div 다
    <div
      data-memo-card
      className={`card relative flex cursor-pointer gap-4 overflow-hidden transition-colors duration-150 hover:bg-group-wash ${
        isList ? 'items-center px-4 py-3 md:px-5' : 'flex-col p-5'
      }`}
    >
      {/* 모임에 공유된 개인 메모는 모임 색 대신 회색 띠로 구분한다 */}
      {color && <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${isGroupMemo ? 'bg-group' : 'bg-line-strong'}`} />}

      <div className={`flex min-w-0 flex-1 flex-col ${isList ? 'gap-1' : 'gap-2'}`}>
        {/* 고정 버튼(32px, -mt-1 이라 28px 차지)이 없는 카드도 같은 높이가 되게 min-h-7 */}
        <div className="flex min-h-7 items-start justify-between gap-3">
          <h4 className="min-w-0 truncate font-display text-[17px] leading-6 text-ink">
            <button
              type="button"
              onClick={onClick}
              className="block max-w-full truncate text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
            >
              {memo.title}
            </button>
          </h4>
          {!isGroupMemo ? null : onTogglePin && memo.permissions?.groupPin ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
              aria-label={groupPinned ? '모임 고정 해제' : '모임에 고정'}
              aria-pressed={groupPinned}
              title={groupPinned ? '모임 고정 해제' : '모임에 고정'}
              className={`btn-icon relative z-10 -mr-1.5 -mt-1 shrink-0 before:absolute before:-inset-1.5 before:content-[''] ${groupPinned ? 'text-group-ink hover:text-group-ink' : 'text-ink-3'}`}
            >
              <Pin size={16} strokeWidth={1.5} className={groupPinned ? 'fill-current' : ''} />
            </button>
          ) : groupPinned && (
            <Pin size={16} strokeWidth={1.5} className="mt-1 shrink-0 fill-current text-group-ink" aria-label="고정됨" />
          )}
        </div>
        {summary && (
          <p className={`text-sm leading-relaxed text-ink-2 ${isList ? 'line-clamp-1' : 'line-clamp-3'}`}>{summary}</p>
        )}
        {/* 목록 보기에서도 태그를 한 줄로 보인다 */}
        {(shownTags.length > 0 || (!isList && imageSrc)) && (
          <div className={`flex items-center gap-1.5 ${isList ? 'flex-nowrap overflow-hidden' : 'flex-wrap'}`}>
            {shownTags.map(tag => (
              <span key={tag} className="chip shrink-0">#{tag}</span>
            ))}
            {hiddenTagCount > 0 && (
              <span className="chip shrink-0" title={memo.tags.slice(3).map(t => `#${t}`).join(' ')}>+{hiddenTagCount}</span>
            )}
            {!isList && imageSrc && (
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
