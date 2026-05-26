'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  User,
  Settings,
  HelpCircle,
  LogOut,
  X,
  ChevronRight,
  ShieldCheck,
  Copy,
  Check
} from 'lucide-react';
import { signOut } from 'next-auth/react';

interface User {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  customId?: string;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User;
}

export default function ProfileModal({ isOpen, onClose, user }: ProfileModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const inviteLink = user?.customId ? `${window.location.origin}/invite/friend?code=${user.customId}` : '';

  const handleCopyInviteLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="absolute top-16 right-4 z-[100] w-80 animate-in fade-in slide-in-from-top-4 duration-200">
      {/* Backdrop for closing */}
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden">
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
            <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/20 shadow-lg relative bg-white/10 shrink-0">
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
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-white truncate">{user?.name || '게스트'}</h3>
              <div className="flex flex-col">
                <p className="text-[10px] text-white/70 font-bold tracking-wider uppercase mb-0.5">ID: {user?.customId || '--------'}</p>
                <p className="text-[10px] text-white/50 font-medium truncate w-full">{user?.email || '로그인이 필요합니다'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Invite Link Section */}
        <div className="p-4 border-b border-gray-50 bg-indigo-50/30">
          <div className="bg-white border border-indigo-100 rounded-2xl p-3 space-y-2 shadow-sm">
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest px-1">내 친구 초대 링크</p>
            <div className="flex gap-2">
              <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-[10px] text-gray-400 font-medium truncate">
                {inviteLink || '로그인 후 이용 가능'}
              </div>
              <button 
                onClick={handleCopyInviteLink}
                disabled={!inviteLink}
                className={`p-2 rounded-xl transition-all shadow-sm border ${
                  copied 
                  ? 'bg-emerald-500 text-white border-emerald-500' 
                  : 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'
                } disabled:opacity-30`}
              >
                {copied ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
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
            onClick={() => signOut({ callbackUrl: '/' })}
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
