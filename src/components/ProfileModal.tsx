'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Settings,
  HelpCircle,
  LogOut,
  X,
  Copy,
  Check
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { initialOf } from '@/lib/utils';

interface User {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  customId?: string;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User;
}

export default function ProfileModal({ isOpen, onClose, user }: ProfileModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const inviteLink = user?.customId ? `${window.location.origin}/invite/friend?code=${user.customId}` : '';

  const handleCopyInviteLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="absolute top-14 right-4 z-[100] w-80 animate-slide-down">
      {/* 바깥을 누르면 닫힘 */}
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative overflow-hidden rounded-xl border border-line bg-surface shadow-float">
        {/* 내 정보 */}
        <div className="flex items-start gap-3 border-b border-line p-4">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-full bg-raised">
            {user?.image ? (
              <Image
                src={user.image}
                alt={user.name || 'User Avatar'}
                fill
                sizes="40px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-ink-2">
                {initialOf(user?.name, '나')}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-base leading-6 text-ink">{user?.name || '게스트'}</h3>
            <p className="stamp">ID {user?.customId || '--------'}</p>
            <p className="mt-0.5 truncate text-xs text-ink-3">{user?.email || '등록된 이메일이 없어요'}</p>
          </div>
          <button onClick={onClose} className="btn-icon -mr-1 -mt-1 shrink-0" aria-label="닫기">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* 친구 초대 링크 */}
        <div className="border-b border-line p-4">
          <p className="mb-2 text-xs font-medium text-ink-2">내 친구 초대 링크</p>
          <div className="flex gap-2">
            <div className="flex h-9 min-w-0 flex-1 items-center rounded-[10px] border border-line-strong bg-surface px-3 text-xs text-ink-3">
              <span className="truncate">{inviteLink || '로그인 후 이용할 수 있어요'}</span>
            </div>
            <button
              onClick={handleCopyInviteLink}
              disabled={!inviteLink}
              className="btn-secondary size-9 !px-0"
              title={copied ? '복사했어요' : '링크 복사'}
            >
              {copied ? <Check size={16} strokeWidth={1.5} /> : <Copy size={16} strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        {/* 메뉴 */}
        <div className="p-1.5">
          <ProfileMenuItem href="/settings" icon={Settings} label="설정" onClose={onClose} />
          <ProfileMenuItem href="/help" icon={HelpCircle} label="도움말" onClose={onClose} />
        </div>

        <div className="border-t border-line p-1.5">
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-sm text-negative transition-colors hover:bg-negative-soft"
          >
            <LogOut size={16} strokeWidth={1.5} />
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}

interface ProfileMenuItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
  onClose: () => void;
}

function ProfileMenuItem({ href, icon: Icon, label, onClose }: ProfileMenuItemProps) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm text-ink transition-colors hover:bg-raised"
    >
      <Icon size={16} strokeWidth={1.5} className="text-ink-3" />
      <span className="flex-1">{label}</span>
    </Link>
  );
}
