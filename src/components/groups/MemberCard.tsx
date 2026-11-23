'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import ImageWithFallback from '@/components/ImageWithFallback';
import { type GroupResponse } from '@/lib/group-api';

interface MemberCardProps {
  member: GroupResponse['members'][0];
  isOwner: boolean;
  isMe?: boolean;
  currentUserIsOwner: boolean;
  onKick: () => void;
  apiUrl: string;
}

export function MemberCard({ member, isOwner, isMe, currentUserIsOwner, onKick, apiUrl }: MemberCardProps) {
  return (
    <div className="card flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-150 ease-out hover:bg-raised group/member">
      <div className="flex items-center gap-3 min-w-0">
        <div className="size-10 rounded-full overflow-hidden relative shrink-0">
          {member.profileImage ? (
            <ImageWithFallback
              src={member.profileImage.startsWith('/uploads/') ? `${apiUrl}${member.profileImage}` : member.profileImage}
              alt={member.nickname}
              fill
              containerClassName="w-full h-full"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-accent-soft flex items-center justify-center text-accent font-medium text-base">
              {[...member.nickname][0]}
            </div>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-ink flex items-center gap-2 min-w-0">
            <span className="truncate">{member.nickname}</span>
            {isOwner && (
              <span className="shrink-0 rounded-md bg-accent-soft px-2 py-0.5 text-xs text-accent font-normal">
                방장
              </span>
            )}
            {isMe && (
              <span className="shrink-0 rounded-md bg-raised px-2 py-0.5 text-xs text-ink-2 font-normal">
                나
              </span>
            )}
          </span>
          {/* 같은 닉네임·사진으로 바꾼 사람과 구분할 수 있게 고유 아이디를 보여 준다 */}
          <p className="text-xs text-ink-3 truncate">
            {member.customId ? `@${member.customId}` : '모임 멤버'}
          </p>
        </div>
      </div>
      {currentUserIsOwner && !isOwner && (
        <button
          type="button"
          onClick={onKick}
          aria-label={`${member.nickname} 내보내기`}
          title="내보내기"
          className="btn-ghost size-9 !px-0 shrink-0 hover:!text-negative hover:!bg-negative-soft [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/member:opacity-100 focus-visible:opacity-100"
        >
          <Trash2 size={16} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
