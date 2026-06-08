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
    <div className="flex items-center justify-between p-6 bg-white rounded-[2.5rem] transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group/member border border-transparent hover:border-indigo-50">
      <div className="flex items-center gap-5">
        <div className="w-16 h-16 rounded-[1.5rem] overflow-hidden relative shadow-lg shrink-0 group-hover/member:scale-105 transition-transform duration-500">
          {member.profileImage ? (
            <ImageWithFallback 
              src={member.profileImage.startsWith('/uploads/') ? `${apiUrl}${member.profileImage}` : member.profileImage} 
              alt={member.nickname} 
              fill 
              containerClassName="w-full h-full"
              className="object-cover" 
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center text-indigo-500 font-black text-2xl">
              {member.nickname[0]}
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-black text-gray-900 flex items-center gap-2">
            {member.nickname}
            {isOwner && (
              <span className="bg-indigo-600 text-white text-[9px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider shadow-md shadow-indigo-100">
                Leader
              </span>
            )}
          </span>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">Community Member</p>
        </div>
      </div>
      {currentUserIsOwner && !isOwner && (
        <button onClick={onKick} className="p-3.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover/member:opacity-100 active:scale-90">
          <Trash2 className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
