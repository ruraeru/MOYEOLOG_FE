'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Calendar,
  FileText,
  Users,
  UserPlus,
  MessageCircle,
  Bell
} from 'lucide-react';
import { useUnreadCounts, badgeText } from '@/lib/notification-api';

const navItems = [
  { name: '홈', href: '/home', icon: Home },
  { name: '일정', href: '/schedule', icon: Calendar },
  { name: '메모', href: '/memo', icon: FileText },
  { name: '모임', href: '/groups', icon: Users },
  { name: '친구', href: '/friends', icon: UserPlus },
  { name: '메시지', href: '/messages', icon: MessageCircle },
  { name: '알림', href: '/notifications', icon: Bell },
];

export default function BottomNavbar() {
  const pathname = usePathname();
  const unread = useUnreadCounts();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] lg:hidden bg-surface border-t border-line pb-safe">
      <div className="flex h-16 items-center justify-around px-1 gap-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const count =
            item.href === '/messages' ? unread.messages : item.href === '/notifications' ? unread.notifications : 0;
          return (
            <Link
              key={item.name}
              href={item.href}
              aria-label={count > 0 ? `${item.name}, 안 읽음 ${count}개` : item.name}
              className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 h-12 rounded-lg transition-[background-color,transform] active:scale-[0.98] ${
                isActive ? 'bg-raised text-ink' : 'text-ink-3'
              }`}
            >
              <span className="relative">
                <item.icon size={18} strokeWidth={1.5} className={isActive ? 'text-accent' : ''} />
                {count > 0 && (
                  <span
                    aria-hidden
                    className="absolute -top-1.5 left-3 min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[10px] leading-4 text-center tabular-nums"
                  >
                    {badgeText(count)}
                  </span>
                )}
              </span>
              <span className="text-[11px] truncate max-w-full">
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
