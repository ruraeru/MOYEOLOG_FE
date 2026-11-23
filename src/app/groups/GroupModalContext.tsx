'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { groupApi, type GroupResponse } from '@/lib/group-api';

interface GroupModalContextType {
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  openCreateModal: () => void;
  /** 사이드바 모임 목록. 상세 화면에서 수정·나가기·삭제 후 refreshGroups 로 즉시 갱신한다. */
  groups: GroupResponse[];
  groupsLoading: boolean;
  groupsError: boolean;
  refreshGroups: () => Promise<void>;
}

const GroupModalContext = createContext<GroupModalContextType | undefined>(undefined);

export function GroupModalProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState(false);

  const openCreateModal = () => setIsModalOpen(true);

  const refreshGroups = useCallback(async () => {
    if (!session) return;
    try {
      const data = await groupApi.getAll(session);
      setGroups(data);
      setGroupsError(false);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
      setGroupsError(true);
    } finally {
      setGroupsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    refreshGroups();
  }, [refreshGroups]);

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
