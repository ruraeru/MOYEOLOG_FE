'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Calendar,
  FileText,
  Users,
  UserPlus
} from 'lucide-react';

const navItems = [
  { name: '홈', href: '/home', icon: Home },
  { name: '일정', href: '/schedule', icon: Calendar },
  { name: '메모', href: '/memo', icon: FileText },
  { name: '모임', href: '/groups', icon: Users },
  { name: '친구', href: '/friends', icon: UserPlus },
];

export default function BottomNavbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] lg:hidden bg-surface border-t border-line pb-safe">
      <div className="flex h-16 items-center justify-around px-2 gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 w-full h-12 rounded-lg transition-[background-color,transform] active:scale-[0.98] ${
                isActive ? 'bg-raised text-ink' : 'text-ink-3'
              }`}
            >
              <item.icon size={18} strokeWidth={1.5} className={isActive ? 'text-accent' : ''} />
              <span className="text-xs">
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
