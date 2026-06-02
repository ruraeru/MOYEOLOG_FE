'use client';

import React, { createContext, useContext, useState } from 'react';

interface GroupModalContextType {
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  openCreateModal: () => void;
}

const GroupModalContext = createContext<GroupModalContextType | undefined>(undefined);

export function GroupModalProvider({ children }: { children: React.ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openCreateModal = () => setIsModalOpen(true);

  return (
    <GroupModalContext.Provider value={{ isModalOpen, setIsModalOpen, openCreateModal }}>
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
