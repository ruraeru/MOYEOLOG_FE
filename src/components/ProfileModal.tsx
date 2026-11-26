'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { signOut, useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { initialOf } from '@/lib/utils';
import { userApi } from '@/lib/user-api';

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
  const { data: session } = useSession();
  const panelRef = useRef<HTMLDivElement>(null);
  // 세션에는 이메일이 실리지 않는다(이메일 로그인·나중에 바꾼 이메일). 메뉴를 열 때 내 정보에서 읽는다.
  const meQuery = useQuery({
    queryKey: ['user', 'me'],
    queryFn: () => userApi.getMe(session),
    enabled: isOpen && !!session?.user?.accessToken,
  });
  const email = meQuery.data?.email ?? user?.email ?? null;

  // Esc 로 닫고, 열릴 때 메뉴로 초점을 옮긴다.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const inviteLink = user?.customId ? `${window.location.origin}/invite/friend?code=${user.customId}` : '';

  const handleCopyInviteLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 상단 막대(backdrop-blur)와 애니메이션(transform)이 fixed 의 기준 상자가 되므로 body 에 붙인다.
  // 바깥 막은 화면 전체를 덮어, 바깥을 누르면 닫기만 하고 밑의 화면은 눌리지 않게 한다.
  return createPortal(
    <>
      <div className="fixed inset-0 z-[99]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label="내 프로필과 설정"
        className="fixed right-4 top-[60px] z-[100] w-[min(20rem,calc(100vw-2rem))] animate-slide-down outline-none lg:top-[68px]"
      >
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
            <p className="mt-0.5 truncate text-xs text-ink-3">{email || (meQuery.isLoading ? '\u00a0' : '등록된 이메일이 없어요')}</p>
          </div>
          <button onClick={onClose} className="btn-icon -mr-1 -mt-1 size-11 shrink-0 lg:size-8" aria-label="닫기">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* 친구 초대 링크 */}
        <div className="border-b border-line p-4">
          <p className="mb-2 text-xs font-medium text-ink-2">내 친구 초대 링크</p>
          <div className="flex gap-2">
            <div className="flex h-11 min-w-0 flex-1 items-center rounded-[10px] lg:h-9 border border-line-strong bg-surface px-3 text-xs text-ink-3">
              <span className="truncate">{inviteLink || '로그인 후 이용할 수 있어요'}</span>
            </div>
            <button
              onClick={handleCopyInviteLink}
              disabled={!inviteLink}
              className="btn-secondary size-11 !px-0 lg:size-9"
              title={copied ? '복사했어요' : '링크 복사'}
              aria-label={copied ? '복사했어요' : '링크 복사'}
            >
              {copied ? <Check size={16} strokeWidth={1.5} /> : <Copy size={16} strokeWidth={1.5} />}
            </button>
          </div>
          {copied && <p role="status" className="mt-1.5 text-xs text-ink-2">링크를 복사했어요</p>}
        </div>

        {/* 메뉴 */}
        <div className="p-1.5">
          <ProfileMenuItem href="/settings" icon={Settings} label="설정" onClose={onClose} />
          <ProfileMenuItem href="/help" icon={HelpCircle} label="도움말" onClose={onClose} />
        </div>

        <div className="border-t border-line p-1.5">
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex h-11 w-full items-center gap-2.5 rounded-lg px-3 text-sm text-negative lg:h-9 transition-colors hover:bg-negative-soft"
          >
            <LogOut size={16} strokeWidth={1.5} />
            로그아웃
          </button>
        </div>
      </div>
      </div>
    </>,
    document.body
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
      className="flex h-11 items-center gap-2.5 rounded-lg px-3 text-sm text-ink transition-colors hover:bg-raised lg:h-9"
    >
      <Icon size={16} strokeWidth={1.5} className="text-ink-3" />
      <span className="flex-1">{label}</span>
    </Link>
  );
}
