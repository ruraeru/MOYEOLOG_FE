'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  User,
  Settings,
  HelpCircle,
  LogOut,
  X,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { signOut } from 'next-auth/react';

interface User {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User;
}

export default function ProfileModal({ isOpen, onClose, user }: ProfileModalProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute top-16 right-4 z-[100] w-80 animate-in fade-in slide-in-from-top-4 duration-200">
      {/* Backdrop for closing */}
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header/User Profile */}
        <div className="p-6 pb-4 bg-gradient-to-br from-[#6366F1] to-[#818CF8]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Verified Account
            </span>
            <button onClick={onClose} className="p-1 text-white/50 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/20 shadow-lg relative bg-white/10">
              {user?.image ? (
                <Image
                  src={user.image}
                  alt={user.name || 'User Avatar'}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-black text-xl">
                  {user?.name?.[0] || '나'}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{user?.name || '박민수'}</h3>
              <p className="text-xs text-white/70 font-medium truncate w-40">{user?.email || 'minsoo@example.com'}</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="p-4 space-y-1">
          <ProfileMenuItem
            href="/settings"
            icon={User}
            label="프로필 관리"
            color="text-blue-500"
            bg="bg-blue-50"
            onClose={onClose}
          />
          <ProfileMenuItem
            href="/settings"
            icon={Settings}
            label="앱 설정"
            color="text-indigo-500"
            bg="bg-indigo-50"
            onClose={onClose}
          />
          <ProfileMenuItem
            href="/help"
            icon={HelpCircle}
            label="고객센터 및 도움말"
            color="text-emerald-500"
            bg="bg-emerald-50"
            onClose={onClose}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-50 bg-gray-50/50">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-gray-100 text-red-500 font-bold text-sm rounded-2xl hover:bg-red-50 hover:border-red-100 transition-all shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}

interface ProfileMenuItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
  color: string;
  bg: string;
  onClose: () => void;
}

function ProfileMenuItem({ href, icon: Icon, label, color, bg, onClose }: ProfileMenuItemProps) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center transition-transform group-hover:scale-110`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <span className="text-sm font-bold text-gray-700">{label}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:translate-x-1 transition-transform" />
    </Link>
  );
}
