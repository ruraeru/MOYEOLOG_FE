'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { useLiveTopics } from '@/lib/live';

interface GroupModalContextType {
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  openCreateModal: () => void;
  /** 사이드바 모임 목록. 상세 화면에서 수정·나가기·삭제 후 refreshGroups 로 즉시 갱신한다. */
  groups: GroupResponse[];
  groupsLoading: boolean;
  groupsError: boolean;
  /** silent: 자동 갱신(실시간·재접속). 실패해도 오류·로딩 표시를 바꾸지 않고 보던 목록을 둔다. */
  refreshGroups: (opts?: { silent?: boolean }) => Promise<void>;
}

const GroupModalContext = createContext<GroupModalContextType | undefined>(undefined);

export function GroupModalProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState(false);

  const openCreateModal = () => setIsModalOpen(true);

  const refreshGroups = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!session) return;
    try {
      const data = await groupApi.getAll(session);
      setGroups(data);
      setGroupsError(false);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
      if (!opts.silent) setGroupsError(true);
    } finally {
      if (!opts.silent) setGroupsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    refreshGroups();
  }, [refreshGroups]);

  // 실시간 갱신: 가입·탈퇴·내보내짐·수정·삭제를 사이드바 목록에 바로 반영한다
  useLiveTopics(['groups'], () => refreshGroups({ silent: true }), !!session);

  return (
    <GroupModalContext.Provider
      value={{ isModalOpen, setIsModalOpen, openCreateModal, groups, groupsLoading, groupsError, refreshGroups }}
    >
      {children}
    </GroupModalContext.Provider>
  );
}

export function useGroupModal() {
  const context = useContext(GroupModalContext);
  if (!context) {
    throw new Error('useGroupModal must be used within a GroupModalProvider');
  }
  return context;
}
