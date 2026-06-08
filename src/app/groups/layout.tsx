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
    <div className="h-screen flex flex-col bg-[#F8F9FB] text-gray-900 overflow-hidden font-sans">
      <Navbar />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Group Navigation Sidebar (Discord Style) */}
        <aside className="w-20 bg-white border-r border-gray-100 flex flex-col items-center py-6 gap-4 shrink-0 overflow-y-auto no-scrollbar z-20 shadow-sm">
          {/* Create Group Button */}
          <button 
            onClick={openCreateModal}
            className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all duration-300 shadow-sm group outline-none"
            title="새 모임 만들기"
          >
            <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
          </button>

          <div className="w-8 h-px bg-gray-100 my-2" />

          {/* Group Icons */}
          {loading ? (
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-gray-200" />
              </div>
            </div>
          ) : (
            groups.map((group) => {
              const isActive = activeGroupId === group.id;
              const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
              const profileSrc = group.profileImage ? (group.profileImage.startsWith('/uploads/') ? `${apiUrl}${group.profileImage}` : group.profileImage) : null;
              
              const themeColors = {
                indigo: 'bg-indigo-500',
                blue: 'bg-blue-500',
                emerald: 'bg-emerald-500',
                orange: 'bg-orange-500',
                rose: 'bg-rose-500',
                amber: 'bg-amber-500'
              };

              return (
                <div key={group.id} className="relative flex items-center">
                  {isActive && (
                    <div className="absolute -left-0 w-1 h-8 bg-indigo-600 rounded-r-full" />
                  )}
                  <button
                    onClick={() => router.push(`/groups/${group.id}`)}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg transition-all duration-300 shadow-sm relative overflow-hidden group outline-none
                      ${isActive ? 'rounded-xl scale-110 shadow-indigo-100 shadow-lg' : 'hover:rounded-xl hover:scale-105'}
                      ${!profileSrc ? (themeColors[group.colorTheme as keyof typeof themeColors] || 'bg-indigo-500') : ''}`}
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
                    <div className={`absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity`} />
                  </button>
                </div>
              );
            })
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden flex flex-col relative bg-[#F8F9FB]">
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