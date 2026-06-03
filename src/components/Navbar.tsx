'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Home,
  Calendar,
  FileText,
  Users,
  UserPlus,
  Bell,
  Settings
} from 'lucide-react';
import ProfileModal from './ProfileModal';

const navItems = [
  { name: '홈', href: '/home', icon: Home },
  { name: '일정', href: '/schedule', icon: Calendar },
  { name: '메모', href: '/memo', icon: FileText },
  { name: '모임', href: '/groups', icon: Users },
  { name: '친구', href: '/friends', icon: UserPlus },
  { name: '알림', href: '/notifications', icon: Bell, badge: 3 },
  { name: '설정', href: '/settings', icon: Settings },
];

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full items-center justify-between px-4 sm:px-6">
        {/* Left: Logo */}
        <div className="flex items-center gap-4 lg:gap-10">
          <Link href="/home" className="flex items-center gap-2 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-[#6366F1] flex items-center justify-center shadow-sm">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-800 hidden xs:block">모여로그</span>
          </Link>
        </div>

        {/* Center: Menu (Hidden on mobile/tablet, shown on XL screens) */}
        <div className="hidden xl:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive
                  ? 'bg-[#F0F2FF] text-[#6366F1]'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
              >
                <div className="relative">
                  <item.icon className="w-5 h-5" />
                  {item.badge && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold border-2 border-white">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Right: User */}
        <div className="flex items-center gap-4">
          <Link href="/notifications" className="relative p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
            <Bell className="w-6 h-6" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white"></span>
          </Link>

          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="h-8 w-8 rounded-full bg-[#D1D5DB] flex items-center justify-center text-xs font-bold text-white overflow-hidden border border-gray-100 hover:ring-2 hover:ring-indigo-100 transition-all"
          >
            {session?.user?.image ? (
              <Image src={session.user.image} alt="User" width={32} height={32} />
            ) : (
              <span>{session?.user?.name?.[0] || '나'}</span>
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
