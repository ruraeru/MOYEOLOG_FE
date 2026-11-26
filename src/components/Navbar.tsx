'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import ImageWithFallback from './ImageWithFallback';
import { Logo } from './Logo';
import { usePathname } from 'next/navigation';
import {
  Home,
  Calendar,
  FileText,
  Users,
  UserPlus,
  Bell,
  MessageCircle
} from 'lucide-react';
import ProfileModal from './ProfileModal';
import { useUnreadCounts, badgeText } from '@/lib/notification-api';
import { initialOf } from '@/lib/utils';

const navItems = [
  { name: '홈', href: '/home', icon: Home },
  { name: '일정', href: '/schedule', icon: Calendar },
  { name: '메모', href: '/memo', icon: FileText },
  { name: '모임', href: '/groups', icon: Users },
  { name: '친구', href: '/friends', icon: UserPlus },
  { name: '메시지', href: '/messages', icon: MessageCircle },
];
// 설정은 오른쪽 위 내 프로필 메뉴에서 연다

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const closeProfile = useCallback(() => setIsProfileOpen(false), []);
  const unread = useUnreadCounts();
  const guest = status === 'unauthenticated';
  // 설정·도움말은 프로필 메뉴 안에 있으므로, 그 화면에서는 프로필 버튼을 선택 상태로 보인다.
  const inProfileMenu = pathname.startsWith('/settings') || pathname.startsWith('/help');
  const iconActive = 'bg-raised text-ink';

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-line bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/85">
      <div className="relative mx-auto flex h-14 w-full items-center justify-between px-4 lg:h-16 lg:px-8">
        {/* 로고: 2×2 초성 아이콘 + 가로 한 줄 "모여로그" 그림 (이름이 그림 안에 있다) */}
        <Link href="/home" className="flex shrink-0 items-center">
          <Logo height={32} className="h-[30px] w-auto lg:h-8" />
        </Link>

        {/* 가운데 메뉴 (넓은 화면): 글자만, 선택은 주아 + 주황 밑줄 */}
        {/* 좌우 묶음 폭이 달라도 화면 가운데에 오도록 absolute 로 둔다 */}
        <div className={`absolute inset-y-0 left-1/2 hidden -translate-x-1/2 items-stretch gap-7 ${guest ? '' : 'lg:flex'}`}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const count = item.href === '/messages' ? unread.messages : 0;
            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                aria-label={count > 0 ? `${item.name}, 안 읽음 ${count}개` : undefined}
                onClick={isActive && pathname === item.href ? () => window.scrollTo({ top: 0, behavior: 'smooth' }) : undefined}
                className="relative flex items-center gap-1.5"
              >
                <span className={isActive ? 'font-display text-[15px] text-ink' : 'text-sm text-ink-2 transition-colors hover:text-ink'}>
                  {item.name}
                </span>
                {count > 0 && (
                  <span className="min-w-4 h-4 rounded-full bg-mark px-1 text-center text-[10px] leading-4 text-white tabular-nums">
                    {badgeText(count)}
                  </span>
                )}
                <span
                  aria-hidden
                  className={`absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-mark ${isActive ? 'opacity-100' : 'opacity-0'}`}
                />
              </Link>
            );
          })}
        </div>

        {/* 오른쪽: (좁은 화면) 메시지 · 알림 · 내 프로필. 로그인하지 않았으면 로그인 버튼만 */}
        {guest ? (
          <Link href={`/?callbackUrl=${encodeURIComponent(pathname)}`} className="btn-primary">
            로그인
          </Link>
        ) : (
        <div className="flex items-center gap-2">
          <Link
            href="/messages"
            aria-label={unread.messages > 0 ? `메시지, 안 읽음 ${unread.messages}개` : '메시지'}
            aria-current={pathname.startsWith('/messages') ? 'page' : undefined}
            className={`btn-icon size-11 relative lg:hidden ${pathname.startsWith('/messages') ? iconActive : ''}`}
          >
            <MessageCircle size={20} strokeWidth={1.5} />
            {unread.messages > 0 && <span aria-hidden className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-mark" />}
          </Link>
          <Link
            href="/notifications"
            aria-label={unread.notifications > 0 ? `알림, 안 읽음 ${unread.notifications}개` : '알림'}
            aria-current={pathname.startsWith('/notifications') ? 'page' : undefined}
            className={`btn-icon size-11 relative lg:size-9 ${pathname.startsWith('/notifications') ? iconActive : ''}`}
          >
            <Bell size={20} strokeWidth={1.5} />
            {unread.notifications > 0 && (
              <>
                {/* 좁은 화면은 점, 넓은 화면은 메시지 메뉴와 같은 숫자 배지 */}
                <span aria-hidden className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-mark lg:hidden" />
                <span aria-hidden className="absolute -right-0.5 -top-0.5 hidden h-4 min-w-4 rounded-full bg-mark px-1 text-center text-[10px] leading-4 text-white tabular-nums lg:block">
                  {badgeText(unread.notifications)}
                </span>
              </>
            )}
          </Link>

          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            aria-label="내 프로필과 설정"
            aria-expanded={isProfileOpen}
            aria-current={inProfileMenu ? 'page' : undefined}
            className="flex size-11 items-center justify-center rounded-full lg:size-9"
          >
            <span
              className={`flex size-8 items-center justify-center overflow-hidden rounded-full bg-raised text-[13px] font-medium text-ink-2 transition-shadow ${
                inProfileMenu || isProfileOpen
                  ? 'shadow-[inset_0_0_0_2px_var(--line-strong)]'
                  : 'shadow-[inset_0_0_0_1px_var(--line)] hover:shadow-[inset_0_0_0_1px_var(--line-strong)]'
              }`}
            >
              {session?.user?.image ? (
                <ImageWithFallback
                  src={session.user.image}
                  alt="내 프로필"
                  width={32}
                  height={32}
                  containerClassName="w-full h-full"
                  className="object-cover"
                />
              ) : (
                <span>{initialOf(session?.user?.name, '나')}</span>
              )}
            </span>
          </button>
        </div>
        )}
      </div>

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={closeProfile}
        user={session?.user}
      />
    </nav>
  );
}
