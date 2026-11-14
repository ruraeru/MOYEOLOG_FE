'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  User,
  Settings,
  HelpCircle,
  LogOut,
  X,
  ChevronRight,
  ShieldCheck,
  Copy,
  Check
} from 'lucide-react';
import { signOut } from 'next-auth/react';

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
    <div className="absolute top-14 right-4 z-[100] w-80 animate-in fade-in slide-in-from-top-4 duration-200">
      {/* Backdrop for closing */}
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-surface rounded-2xl shadow-float border border-line overflow-hidden">
        {/* Header/User Profile */}
        <div className="p-5 border-b border-line">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-ink-3 flex items-center gap-1.5">
              <ShieldCheck size={16} strokeWidth={1.5} />
              인증된 계정
            </span>
            <button onClick={onClose} className="btn-ghost size-8 !h-8 !px-0">
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="size-12 rounded-full overflow-hidden border border-line relative bg-raised shrink-0">
              {user?.image ? (
                <Image
                  src={user.image}
                  alt={user.name || 'User Avatar'}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-ink-2 font-medium text-lg">
                  {user?.name?.[0] || '나'}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-ink truncate">{user?.name || '게스트'}</h3>
              <p className="text-xs text-ink-2 tabular-nums">ID: {user?.customId || '--------'}</p>
              <p className="text-xs text-ink-3 truncate w-full">{user?.email || '로그인이 필요해요'}</p>
            </div>
          </div>
        </div>

        {/* Invite Link Section */}
        <div className="p-4 border-b border-line">
          <p className="text-xs text-ink-2 mb-2">내 친구 초대 링크</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-raised border border-line rounded-lg px-3 h-9 flex items-center text-xs text-ink-3 truncate">
              <span className="truncate">{inviteLink || '로그인 후 이용할 수 있어요'}</span>
            </div>
            <button
              onClick={handleCopyInviteLink}
              disabled={!inviteLink}
              className="btn-secondary size-9 !h-9 !px-0"
            >
              {copied ? (
                <Check size={16} strokeWidth={1.5} className="text-positive" />
              ) : (
                <Copy size={16} strokeWidth={1.5} className="text-ink-2" />
              )}
            </button>
          </div>
        </div>

        {/* Menu Items */}
        <div className="p-2">
          <ProfileMenuItem href="/settings" icon={User} label="프로필 관리" onClose={onClose} />
          <ProfileMenuItem href="/settings" icon={Settings} label="앱 설정" onClose={onClose} />
          <ProfileMenuItem href="/help" icon={HelpCircle} label="고객센터와 도움말" onClose={onClose} />
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-line">
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full flex h-9 items-center gap-3 px-3 text-sm text-negative rounded-lg hover:bg-negative-soft transition-colors"
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
      className="flex h-9 items-center gap-3 px-3 rounded-lg text-sm text-ink hover:bg-raised transition-colors"
    >
      <Icon size={16} strokeWidth={1.5} className="text-ink-3" />
      <span className="flex-1">{label}</span>
      <ChevronRight size={16} strokeWidth={1.5} className="text-ink-3" />
    </Link>
  );
}
