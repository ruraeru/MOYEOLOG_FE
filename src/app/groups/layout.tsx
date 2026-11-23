'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import { Plus, Loader2, RotateCw } from 'lucide-react';
import { type GroupResponse } from '@/lib/group-api';
import { useRouter, useParams } from 'next/navigation';
import ImageWithFallback from '@/components/ImageWithFallback';
import GroupCreateModal from '@/components/GroupCreateModal';
import { getFileUrl } from '@/lib/utils';
import { GroupModalProvider, useGroupModal } from './GroupModalContext';

export default function GroupsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GroupModalProvider>
      <GroupsLayoutContent>{children}</GroupsLayoutContent>
    </GroupModalProvider>
  );
}

function GroupIcon({
  group,
  isActive,
  size,
  onClick,
}: {
  group: GroupResponse;
  isActive: boolean;
  size: 'sm' | 'md';
  onClick: () => void;
}) {
  const profileSrc = getFileUrl(group.profileImage);
  const sizeClass = size === 'sm' ? 'size-10 text-base' : 'size-12 text-lg';
  return (
    <button
      onClick={onClick}
      className={`${sizeClass} shrink-0 rounded-xl flex items-center justify-center font-semibold transition-colors duration-150 ease-out relative overflow-hidden group
        ${isActive && profileSrc ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}
        ${!profileSrc ? (isActive ? 'bg-accent text-white' : 'bg-raised text-ink hover:bg-accent-soft hover:text-accent') : ''}`}
      title={group.name}
      aria-label={group.name}
      aria-current={isActive ? 'page' : undefined}
    >
      {profileSrc ? (
        <ImageWithFallback
          key={profileSrc}
          src={profileSrc}
          alt={group.name}
          fill
          containerClassName="w-full h-full"
          className="object-cover"
        />
      ) : (
        [...group.name][0]
      )}
      {profileSrc && (
        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-out" />
      )}
    </button>
  );
}

function GroupsLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const { isModalOpen, setIsModalOpen, openCreateModal, groups, groupsLoading, groupsError, refreshGroups } = useGroupModal();
  const activeGroupId = params?.id as string;

  const retryButton = (sizeClass: string) => (
    <button
      onClick={() => refreshGroups()}
      className={`${sizeClass} shrink-0 rounded-xl bg-raised text-ink-3 flex items-center justify-center hover:text-ink transition-colors duration-150 ease-out`}
      title="모임 목록을 불러오지 못했어요. 다시 시도"
      aria-label="모임 목록 다시 불러오기"
    >
      <RotateCw size={16} strokeWidth={1.5} />
    </button>
  );

  return (
    <div className="h-screen flex flex-col bg-canvas text-ink overflow-hidden font-sans">
      <Navbar />

      {/* 모바일: 모임 아이콘을 가로 띠로 */}
      <nav className="md:hidden shrink-0 bg-surface border-b border-line" aria-label="내 모임">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-4 py-2">
          <button
            onClick={openCreateModal}
            className="size-10 shrink-0 rounded-xl bg-raised text-ink-2 flex items-center justify-center hover:bg-accent-soft hover:text-accent transition-colors duration-150 ease-out"
            title="새 모임 만들기"
            aria-label="새 모임 만들기"
          >
            <Plus size={18} strokeWidth={1.5} />
          </button>
          <div className="w-px h-6 bg-line shrink-0" />
          {groupsLoading ? (
            <div className="size-10 shrink-0 rounded-xl bg-raised flex items-center justify-center">
              <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-ink-3" />
            </div>
          ) : groupsError ? (
            retryButton('size-10')
          ) : (
            groups.map((group) => (
              <GroupIcon
                key={group.id}
                group={group}
                size="sm"
                isActive={activeGroupId === group.id}
                onClick={() => router.push(`/groups/${group.id}`)}
              />
            ))
          )}
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        {/* 데스크톱: 모임 사이드바 */}
        <aside className="hidden md:flex w-20 bg-surface border-r border-line flex-col items-center py-6 gap-4 shrink-0 overflow-y-auto no-scrollbar z-20">
          <button
            onClick={openCreateModal}
            className="size-12 shrink-0 rounded-xl bg-raised text-ink-2 flex items-center justify-center hover:bg-accent-soft hover:text-accent transition-colors duration-150 ease-out"
            title="새 모임 만들기"
            aria-label="새 모임 만들기"
          >
            <Plus size={18} strokeWidth={1.5} />
          </button>

          <div className="w-8 h-px bg-line shrink-0" />

          {groupsLoading ? (
            <div className="size-12 rounded-xl bg-raised flex items-center justify-center">
              <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-ink-3" />
            </div>
          ) : groupsError ? (
            retryButton('size-12')
          ) : (
            groups.map((group) => {
              const isActive = activeGroupId === group.id;
              return (
                <div key={group.id} className="relative flex items-center shrink-0">
                  {isActive && (
                    <div className="absolute -left-4 w-1 h-8 bg-accent rounded-r-full" />
                  )}
                  <GroupIcon
                    group={group}
                    size="md"
                    isActive={isActive}
                    onClick={() => router.push(`/groups/${group.id}`)}
                  />
                </div>
              );
            })
          )}
        </aside>

        <main className="flex-1 min-w-0 overflow-hidden flex flex-col relative bg-canvas">
          {children}
        </main>
      </div>

      <GroupCreateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={refreshGroups}
        onOpenGroup={(id) => router.push(`/groups/${id}`)}
      />
    </div>
  );
}
