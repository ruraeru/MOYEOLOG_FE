'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { User as UserIcon, Bell, Lock, Monitor, Globe, LogOut, Loader2 } from 'lucide-react';
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
  { id: 'display', label: '화면', icon: Monitor },
  { id: 'language', label: '언어 및 지역', icon: Globe },
] as const;

type MenuId = (typeof menuItems)[number]['id'];

const NEEDS_USER: MenuId[] = ['profile', 'security'];

export default function SettingsPage() {
  const { data: session } = useSession();
  const [activeMenu, setActiveMenu] = useState<MenuId>('profile');

  // ?menu=security 처럼 메뉴를 지정해 들어온 경우(카카오 연결·이메일 인증 뒤 돌아올 때). 서버 렌더와 어긋나지 않게 마운트 뒤에 바꾼다.
  useEffect(() => {
    const menu = new URLSearchParams(window.location.search).get('menu');
    const found = menuItems.find((item) => item.id === menu);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (found) setActiveMenu(found.id);
  }, []);

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
              message={getApiErrorMessage(userQuery.error, '내 정보를 불러오지 못했어요')}
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
        {/* 넓은 화면: 왼쪽 메뉴 (폭 264, 오른쪽 hairline) */}
        <aside className="hidden w-[264px] shrink-0 flex-col border-r border-line px-4 py-8 lg:flex">
          <h1 className="px-3 font-display text-2xl leading-8 text-ink">설정</h1>

          <nav className="mt-5 flex flex-col gap-1" aria-label="설정 메뉴">
            {menuItems.map((item) => {
              const active = activeMenu === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveMenu(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm transition-colors ${
                    active ? 'bg-surface font-medium text-ink shadow-[inset_0_0_0_1px_var(--line)]' : 'text-ink-2 hover:bg-raised hover:text-ink'
                  }`}
                >
                  <item.icon size={16} strokeWidth={1.5} className={active ? 'text-ink' : 'text-ink-3'} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="mt-auto flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm text-ink-2 transition-colors hover:bg-raised hover:text-ink"
          >
            <LogOut size={16} strokeWidth={1.5} className="text-ink-3" aria-hidden />
            로그아웃
          </button>
        </aside>

        {/* 좁은 화면: 위쪽 가로 메뉴 */}
        <nav
          className="lg:hidden shrink-0 border-b border-line px-4 pt-5"
          aria-label="설정 메뉴"
        >
          <h1 className="font-display text-2xl leading-8 text-ink">설정</h1>
          <div className="mt-3 flex flex-wrap gap-1.5 pb-3">
            {menuItems.map((item) => {
              const active = activeMenu === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveMenu(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`touch-hit flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors ${
                    active ? 'bg-accent-soft font-medium text-accent' : 'bg-surface text-ink-2 shadow-[inset_0_0_0_1px_var(--line)]'
                  }`}
                >
                  <item.icon size={16} strokeWidth={1.5} aria-hidden />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-6 pb-24 sm:px-6 lg:px-12 lg:py-10">
          <div className="max-w-[720px]">
            {renderContent()}

            <div className="mt-10 flex lg:hidden">
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="btn-secondary w-full"
              >
                <LogOut size={16} strokeWidth={1.5} aria-hidden />
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
