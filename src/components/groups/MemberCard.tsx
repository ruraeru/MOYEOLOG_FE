'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import ImageWithFallback from '@/components/ImageWithFallback';
import { type GroupResponse } from '@/lib/group-api';

interface MemberCardProps {
  member: GroupResponse['members'][0];
  isOwner: boolean;
  currentUserIsOwner: boolean;
  onKick: () => void;
  apiUrl: string;
}

export function MemberCard({ member, isOwner, currentUserIsOwner, onKick, apiUrl }: MemberCardProps) {
  return (
    <div className="card flex items-center justify-between px-4 py-3 transition-colors duration-150 ease-out hover:bg-raised group/member">
      <div className="flex items-center gap-3">
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
              {member.nickname[0]}
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-ink flex items-center gap-2">
            {member.nickname}
            {isOwner && (
              <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs text-accent font-normal">
                방장
              </span>
            )}
          </span>
          <p className="text-xs text-ink-3">모임 멤버</p>
        </div>
      </div>
      {currentUserIsOwner && !isOwner && (
        <button onClick={onKick} className="btn-ghost size-9 !px-0 hover:!text-negative hover:!bg-negative-soft opacity-0 group-hover/member:opacity-100 focus-visible:opacity-100">
          <Trash2 size={16} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
