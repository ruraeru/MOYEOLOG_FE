'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import ImageWithFallback from './ImageWithFallback';
import { usePathname } from 'next/navigation';
import {
  Home,
  Calendar,
  FileText,
  Users,
  UserPlus,
  Bell,
  MessageCircle
} from 'lucide-react';
import ProfileModal from './ProfileModal';
import { useUnreadCounts, badgeText } from '@/lib/notification-api';
import { initialOf } from '@/lib/utils';

const navItems = [
  { name: '홈', href: '/home', icon: Home },
  { name: '일정', href: '/schedule', icon: Calendar },
  { name: '메모', href: '/memo', icon: FileText },
  { name: '모임', href: '/groups', icon: Users },
  { name: '친구', href: '/friends', icon: UserPlus },
  { name: '메시지', href: '/messages', icon: MessageCircle },
];
// 설정은 오른쪽 위 내 프로필 메뉴에서 연다

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const unread = useUnreadCounts();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-line bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/85">
      <div className="mx-auto flex h-14 w-full items-center justify-between px-4 lg:h-16 lg:px-8">
        {/* 로고: 주황 띠 + 주아 */}
        <Link href="/home" className="flex shrink-0 items-center gap-2.5">
          <span aria-hidden className="h-[18px] w-[3px] rounded-full bg-mark" />
          <span className="font-display text-[20px] leading-none text-ink lg:text-[22px]">모여로그</span>
        </Link>

        {/* 가운데 메뉴 (넓은 화면): 글자만, 선택은 주아 + 주황 밑줄 */}
        <div className="hidden h-full items-stretch gap-7 lg:flex">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const count = item.href === '/messages' ? unread.messages : 0;
            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex items-center gap-1.5"
              >
                <span className={isActive ? 'font-display text-[15px] text-ink' : 'text-sm text-ink-2 transition-colors hover:text-ink'}>
                  {item.name}
                </span>
                {count > 0 && (
                  <span className="min-w-4 h-4 rounded-full bg-mark px-1 text-center text-[10px] leading-4 text-white tabular-nums">
                    {badgeText(count)}
                  </span>
                )}
                <span
                  aria-hidden
                  className={`absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-mark ${isActive ? 'opacity-100' : 'opacity-0'}`}
                />
              </Link>
            );
          })}
        </div>

        {/* 오른쪽: (좁은 화면) 메시지 · 알림 · 내 프로필 */}
        <div className="flex items-center gap-1 lg:gap-2">
          <Link
            href="/messages"
            aria-label={unread.messages > 0 ? `메시지, 안 읽음 ${unread.messages}개` : '메시지'}
            className={`btn-icon size-9 relative lg:hidden ${pathname.startsWith('/messages') ? 'bg-raised text-ink' : ''}`}
          >
            <MessageCircle size={20} strokeWidth={1.5} />
            {unread.messages > 0 && <span aria-hidden className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-mark" />}
          </Link>
          <Link
            href="/notifications"
            aria-label={unread.notifications > 0 ? `알림, 안 읽음 ${unread.notifications}개` : '알림'}
            className={`btn-icon size-9 relative ${pathname.startsWith('/notifications') ? 'bg-surface text-ink shadow-[inset_0_0_0_1px_var(--line)]' : ''}`}
          >
            <Bell size={19} strokeWidth={1.5} />
            {unread.notifications > 0 && <span aria-hidden className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-mark" />}
          </Link>

          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            aria-label="내 프로필과 설정"
            className="ml-1 flex size-8 items-center justify-center overflow-hidden rounded-full bg-raised text-[13px] font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--line)] transition-shadow hover:shadow-[inset_0_0_0_1px_var(--line-strong)]"
          >
            {session?.user?.image ? (
              <ImageWithFallback
                src={session.user.image}
                alt="내 프로필"
                width={32}
                height={32}
                containerClassName="w-full h-full"
                className="object-cover"
              />
            ) : (
              <span>{initialOf(session?.user?.name, '나')}</span>
            )}
          </button>
        </div>
      </div>

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={session?.user}
      />
    </nav>
  );
}
