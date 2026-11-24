'use client';

import React from 'react';
import { UserMinus } from 'lucide-react';
import { type GroupResponse } from '@/lib/group-api';
import { Avatar } from './GroupUI';

interface MemberCardProps {
  member: GroupResponse['members'][0];
  isOwner: boolean;
  isMe?: boolean;
  currentUserIsOwner: boolean;
  onKick: () => void;
}

/** 멤버 행 (카드 안 목록). 아바타 40, 주아 이름, @아이디 */
export function MemberCard({ member, isOwner, isMe, currentUserIsOwner, onKick }: MemberCardProps) {
  return (
    <div className="group/member flex min-h-16 items-center justify-between gap-3 px-4 py-3 transition-colors duration-150 hover:bg-raised md:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={member.nickname} src={member.profileImage} size="size-10" />
        <div className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-display text-base text-ink">{member.nickname}</span>
            {isOwner && <span className="shrink-0 text-xs text-ink-3">방장</span>}
            {isMe && <span className="shrink-0 text-xs text-ink-3">나</span>}
          </span>
          {/* 같은 닉네임·사진으로 바꾼 사람과 구분할 수 있게 고유 아이디를 보여 준다 */}
          <p className="truncate text-xs text-ink-3">
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
          className="btn-icon shrink-0 hover:!bg-negative-soft hover:!text-negative focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/member:opacity-100"
        >
          <UserMinus size={16} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
