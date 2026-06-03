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
    <nav className="fixed bottom-0 left-0 right-0 z-[100] lg:hidden bg-white/80 backdrop-blur-xl border-t border-gray-100 pb-safe shadow-[0_-1px_10px_rgba(0,0,0,0.02)]">
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-all active:scale-95 ${
                isActive ? 'text-indigo-600' : 'text-gray-400'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-indigo-50' : ''}`}>
                <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              </div>
              <span className={`text-[10px] font-black tracking-tight ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
