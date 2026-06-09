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
  { name: '알림', href: '/notifications', icon: Bell, badge: 3 },
  { name: '설정', href: '/settings', icon: Settings },
];

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full items-center justify-between px-6 lg:px-10">
        {/* Left: Logo */}
        <div className="flex items-center gap-8">
          <Link href="/home" className="flex items-center gap-2.5 shrink-0 group">
            <div className="h-9 w-9 rounded-xl bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors duration-300">
              <Calendar className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-extrabold text-gray-800 tracking-tight leading-none">모여로그</span>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Moyeolog</span>
            </div>
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
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${isActive
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  }`}
              >
                <div className="relative">
                  <item.icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                  {item.badge && (
                    <span className="absolute -top-2 -right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-400 text-[8px] text-white font-bold border-2 border-white">
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
        <div className="flex items-center gap-5">
          <Link href="/notifications" className="relative p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full bg-red-400 border border-white"></span>
          </Link>

          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="h-10 w-10 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-sm font-bold text-gray-400 hover:border-indigo-100 hover:text-indigo-500 transition-all overflow-hidden"
          >
            {session?.user?.image ? (
              <ImageWithFallback 
                src={session.user.image} 
                alt="User" 
                width={40} 
                height={40} 
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
