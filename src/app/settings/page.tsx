'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import { User as UserIcon, Bell, Lock, Eye, Globe, LogOut, ChevronRight, Loader2 } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { userApi } from '@/lib/user-api';
import { getApiErrorMessage } from '@/lib/axios';
import ProfileSection from './_components/ProfileSection';
import NotificationSection from './_components/NotificationSection';
import SecuritySection from './_components/SecuritySection';
import DisplaySection from './_components/DisplaySection';
import LanguageSection from './_components/LanguageSection';
import { LoadError } from './_components/ui';

const menuItems = [
  { id: 'profile', label: '프로필', icon: UserIcon },
  { id: 'notif', label: '알림', icon: Bell },
  { id: 'security', label: '계정 및 보안', icon: Lock },
  { id: 'display', label: '화면', icon: Eye },
  { id: 'language', label: '언어 및 지역', icon: Globe },
] as const;

type MenuId = (typeof menuItems)[number]['id'];

const NEEDS_USER: MenuId[] = ['profile', 'security'];

export default function SettingsPage() {
  const { data: session } = useSession();
  const [activeMenu, setActiveMenu] = useState<MenuId>('profile');

  const userQuery = useQuery({
    queryKey: ['user', 'me'],
    queryFn: () => userApi.getMe(session),
    enabled: !!session?.user?.accessToken,
  });

  const renderContent = () => {
    if (NEEDS_USER.includes(activeMenu)) {
      if (userQuery.isLoading || (!userQuery.data && !userQuery.isError)) {
        return (
          <div className="flex justify-center py-20">
            <Loader2 size={24} strokeWidth={1.5} className="animate-spin text-ink-3" />
          </div>
        );
      }
      if (userQuery.isError || !userQuery.data) {
        return (
          <div className="card">
            <LoadError
              message={getApiErrorMessage(userQuery.error, '내 정보를 불러오지 못했어요.')}
              onRetry={() => userQuery.refetch()}
            />
          </div>
        );
      }
    }

    switch (activeMenu) {
      case 'profile':
        return <ProfileSection user={userQuery.data!} />;
      case 'notif':
        return <NotificationSection />;
      case 'security':
        return <SecuritySection user={userQuery.data!} />;
      case 'display':
        return <DisplaySection />;
      case 'language':
        return <LanguageSection />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-canvas text-ink overflow-hidden font-sans">
      <Navbar />

      <main className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* 넓은 화면: 왼쪽 메뉴 */}
        <aside className="w-72 bg-surface border-r border-line p-6 flex-col gap-6 hidden lg:flex shrink-0">
          <div>
            <h2 className="text-2xl font-semibold text-ink">설정</h2>
            <p className="text-sm text-ink-2 mt-1">앱 환경을 원하는 대로 바꿔 보세요.</p>
          </div>

          <nav className="flex flex-col gap-1" aria-label="설정 메뉴">
            {menuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveMenu(item.id)}
                aria-current={activeMenu === item.id ? 'page' : undefined}
                className={`flex h-9 items-center justify-between px-3 rounded-lg text-sm transition-colors ${activeMenu === item.id ? 'bg-raised text-ink font-medium' : 'text-ink-2 hover:bg-raised hover:text-ink'}`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={16} strokeWidth={1.5} className={activeMenu === item.id ? 'text-accent' : 'text-ink-3'} />
                  <span>{item.label}</span>
                </div>
                <ChevronRight size={16} strokeWidth={1.5} className={`text-ink-3 ${activeMenu === item.id ? 'opacity-100' : 'opacity-0'}`} />
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="mt-auto flex h-9 items-center gap-3 px-3 text-negative hover:bg-negative-soft rounded-lg transition-colors"
          >
            <LogOut size={16} strokeWidth={1.5} />
            <span className="text-sm">로그아웃</span>
          </button>
        </aside>

        {/* 좁은 화면: 위쪽 가로 메뉴 */}
        <nav
          className="lg:hidden shrink-0 border-b border-line bg-surface px-4 pt-4"
          aria-label="설정 메뉴"
        >
          <h2 className="text-xl font-semibold text-ink">설정</h2>
          <div className="no-scrollbar -mx-4 mt-3 flex gap-1 overflow-x-auto px-4 pb-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveMenu(item.id)}
                aria-current={activeMenu === item.id ? 'page' : undefined}
                className={`flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm transition-colors ${activeMenu === item.id ? 'bg-raised text-ink font-medium' : 'text-ink-2'}`}
              >
                <item.icon size={16} strokeWidth={1.5} className={activeMenu === item.id ? 'text-accent' : 'text-ink-3'} />
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 pb-24 sm:p-6 lg:p-12">
          <div className="max-w-2xl mx-auto">
            <div className="animate-in fade-in duration-200">{renderContent()}</div>

            <div className="mt-10 flex justify-center lg:hidden">
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="btn-ghost !text-negative"
              >
                <LogOut size={16} strokeWidth={1.5} />
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
