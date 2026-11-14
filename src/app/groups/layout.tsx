'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import { Plus, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { useRouter, useParams } from 'next/navigation';
import ImageWithFallback from '@/components/ImageWithFallback';
import GroupCreateModal from '@/components/GroupCreateModal';
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
  const { data: session } = useSession();
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const { isModalOpen, setIsModalOpen, openCreateModal } = useGroupModal();
  const activeGroupId = params?.id as string;

  const fetchGroups = useCallback(async () => {
    if (!session) return;
    try {
      setLoading(true);
      const data = await groupApi.getAll(session);
      setGroups(data);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  return (
    <div className="h-screen flex flex-col bg-canvas text-ink overflow-hidden font-sans">
      <Navbar />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Group Navigation Sidebar */}
        <aside className="w-20 bg-surface border-r border-line flex flex-col items-center py-6 gap-4 shrink-0 overflow-y-auto no-scrollbar z-20">
          {/* Create Group Button */}
          <button 
            onClick={openCreateModal}
            className="size-12 rounded-xl bg-raised text-ink-2 flex items-center justify-center hover:bg-accent-soft hover:text-accent transition-colors duration-150 ease-out"
            title="새 모임 만들기"
          >
            <Plus size={18} strokeWidth={1.5} />
          </button>

          <div className="w-8 h-px bg-line" />

          {/* Group Icons */}
          {loading ? (
            <div className="flex flex-col gap-4">
              <div className="size-12 rounded-xl bg-raised flex items-center justify-center">
                <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-ink-3" />
              </div>
            </div>
          ) : (
            groups.map((group) => {
              const isActive = activeGroupId === group.id;
              const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
              const profileSrc = group.profileImage ? (group.profileImage.startsWith('/uploads/') ? `${apiUrl}${group.profileImage}` : group.profileImage) : null;
              
              return (
                <div key={group.id} className="relative flex items-center">
                  {isActive && (
                    <div className="absolute left-0 w-1 h-8 bg-accent rounded-r-full" />
                  )}
                  <button
                    onClick={() => router.push(`/groups/${group.id}`)}
                    className={`size-12 rounded-xl flex items-center justify-center font-semibold text-lg transition-colors duration-150 ease-out relative overflow-hidden group
                      ${!profileSrc ? (isActive ? 'bg-accent text-white' : 'bg-raised text-ink hover:bg-accent-soft hover:text-accent') : ''}`}
                    title={group.name}
                  >
                    {profileSrc ? (
                      <ImageWithFallback 
                        src={profileSrc} 
                        alt={group.name} 
                        fill 
                        containerClassName="w-full h-full"
                        className="object-cover" 
                      />
                    ) : (
                      group.name.substring(0, 1)
                    )}
                    {profileSrc && (
                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-out" />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden flex flex-col relative bg-canvas">
          {children}
        </main>
      </div>

      <GroupCreateModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchGroups}
      />
    </div>
  );
}