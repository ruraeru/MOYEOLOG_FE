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
  Settings,
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
  { name: '설정', href: '/settings', icon: Settings },
];

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const unread = useUnreadCounts();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-line bg-surface">
      <div className="mx-auto flex h-14 w-full items-center justify-between px-4 lg:px-8">
        {/* Left: Logo */}
        <div className="flex items-center gap-8">
          <Link href="/home" className="flex items-center gap-2 shrink-0">
            <div className="size-8 rounded-lg bg-accent flex items-center justify-center">
              <Calendar size={16} strokeWidth={1.5} className="text-white" />
            </div>
            <span className="text-base font-semibold text-ink">모여로그</span>
          </Link>
        </div>

        {/* Center: Menu (Visible from LG screens) */}
        <div className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const count = item.href === '/messages' ? unread.messages : 0;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex h-9 items-center gap-2 px-3 rounded-lg text-sm transition-colors duration-150 ${isActive
                  ? 'bg-raised text-ink font-medium'
                  : 'text-ink-2 hover:text-ink hover:bg-raised'
                  }`}
              >
                <item.icon size={16} strokeWidth={1.5} className={isActive ? 'text-accent' : 'text-ink-3'} />
                <span>{item.name}</span>
                {count > 0 && (
                  <span className="min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[10px] leading-4 text-center tabular-nums">
                    {badgeText(count)}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Right: User */}
        <div className="flex items-center gap-2">
          <Link
            href="/notifications"
            aria-label={unread.total > 0 ? `알림, 안 읽은 알림과 메시지 ${unread.total}개` : '알림'}
            className={`btn-ghost size-9 !px-0 relative ${pathname.startsWith('/notifications') ? 'bg-raised text-ink' : ''}`}
          >
            <Bell size={18} strokeWidth={1.5} />
            {unread.total > 0 && (
              <span
                aria-hidden
                className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[10px] leading-4 text-center tabular-nums"
              >
                {badgeText(unread.total)}
              </span>
            )}
          </Link>

          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="size-9 rounded-full bg-raised border border-line flex items-center justify-center text-sm font-medium text-ink-2 hover:border-line-strong transition-colors overflow-hidden"
          >
            {session?.user?.image ? (
              <ImageWithFallback 
                src={session.user.image} 
                alt="User" 
                width={36} 
                height={36} 
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
