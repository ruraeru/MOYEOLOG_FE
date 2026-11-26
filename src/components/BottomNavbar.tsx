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
} from 'lucide-react';

const navItems = [
  { name: '홈', href: '/home', icon: Home },
  { name: '일정', href: '/schedule', icon: Calendar },
  { name: '메모', href: '/memo', icon: FileText },
  { name: '모임', href: '/groups', icon: Users },
  { name: '친구', href: '/friends', icon: UserPlus },
];
// 메시지·알림은 위쪽 막대의 아이콘으로 연다 (하단 탭은 5칸)

export default function BottomNavbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] border-t border-line bg-surface pb-safe lg:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              // 지금 화면의 칸을 다시 누르면 맨 위로 올린다
              onClick={isActive && pathname === item.href ? () => window.scrollTo({ top: 0, behavior: 'smooth' }) : undefined}
              className={`relative flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 transition-transform active:scale-[0.97] ${
                isActive ? 'text-ink' : 'text-ink-3'
              }`}
            >
              {/* 선택 칸: 위쪽 주황 막대(데스크톱 상단 메뉴의 밑줄과 같은 표시) */}
              <span
                aria-hidden
                className={`absolute -top-2 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-mark ${isActive ? 'opacity-100' : 'opacity-0'}`}
              />
              <item.icon size={22} strokeWidth={isActive ? 2 : 1.5} />
              <span className={`text-[11px] ${isActive ? 'font-medium' : ''}`}>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
