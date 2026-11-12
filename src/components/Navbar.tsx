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
  Settings
} from 'lucide-react';
import ProfileModal from './ProfileModal';

const navItems = [
  { name: '홈', href: '/home', icon: Home },
  { name: '일정', href: '/schedule', icon: Calendar },
  { name: '메모', href: '/memo', icon: FileText },
  { name: '모임', href: '/groups', icon: Users },
  { name: '친구', href: '/friends', icon: UserPlus },
  { name: '알림', href: '/notifications', icon: Bell },
  { name: '설정', href: '/settings', icon: Settings },
];

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

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
            const isActive = pathname === item.href;
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
              </Link>
            );
          })}
        </div>

        {/* Right: User */}
        <div className="flex items-center gap-2">
          <Link href="/notifications" className="btn-ghost size-9 !px-0">
            <Bell size={18} strokeWidth={1.5} />
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
