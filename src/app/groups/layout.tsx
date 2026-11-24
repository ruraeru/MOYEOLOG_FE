'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Plus, Loader2, RotateCw, Link as LinkIcon } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import GroupCreateModal from '@/components/GroupCreateModal';
import { GroupAvatar } from '@/components/groups/GroupIdentity';
import { SideItem, SideLabel } from '@/components/ui';
import { InviteCodeModal } from '@/components/groups/InviteCodeModal';
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

function GroupsLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const { isModalOpen, setIsModalOpen, openCreateModal, groups, groupsLoading, groupsError, refreshGroups } = useGroupModal();
  const [isCodeOpen, setIsCodeOpen] = useState(false);
  const activeGroupId = params?.id as string;

  return (
    <div className="h-screen flex flex-col bg-canvas text-ink overflow-hidden font-sans">
      <Navbar />

      <div className="flex-1 flex overflow-hidden">
        {/* 데스크톱 모임 상세: '내 모임' 목록. 모바일·목록 화면은 본문이 모임 목록을 보여 준다 */}
        {activeGroupId && (
          <aside className="hidden lg:flex w-[264px] shrink-0 flex-col border-r border-line" aria-label="내 모임">
            <nav className="flex-1 overflow-y-auto no-scrollbar px-4 pt-8 pb-4">
              <SideLabel>내 모임</SideLabel>
              <div className="flex flex-col gap-0.5">
                {groupsLoading ? (
                  <div className="flex h-9 items-center gap-2 px-3 text-sm text-ink-3">
                    <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> 불러오는 중
                  </div>
                ) : groupsError ? (
                  <SideItem
                    icon={RotateCw}
                    label="목록을 불러오지 못했어요. 다시 시도"
                    onClick={() => refreshGroups()}
                  />
                ) : (
                  groups.map((group) => (
                    <SideItem
                      key={group.id}
                      as={Link}
                      href={`/groups/${group.id}`}
                      label={
                        <span className="flex min-w-0 items-center gap-2.5">
                          <GroupAvatar name={group.name} src={group.profileImage} theme={group.colorTheme} size="xs" />
                          <span className="min-w-0 truncate">{group.name}</span>
                        </span>
                      }
                      count={group.memberCount}
                      active={activeGroupId === group.id}
                    />
                  ))
                )}
              </div>
            </nav>
            <div className="flex flex-col gap-0.5 px-4 pb-6 pt-2">
              <SideItem icon={Plus} label="모임 만들기" onClick={openCreateModal} />
              <SideItem icon={LinkIcon} label="초대 코드 입력" onClick={() => setIsCodeOpen(true)} />
            </div>
          </aside>
        )}

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
      <InviteCodeModal open={isCodeOpen} onClose={() => setIsCodeOpen(false)} />
    </div>
  );
}
