'use client';

import React from 'react';
import { type Session } from 'next-auth';
import { isSameDay, parseISO } from 'date-fns';
import { type GroupResponse } from '@/lib/group-api';
import { type ScheduleResponse } from '@/lib/schedule-api';
import { type TopicResponse } from '@/types/topic';

import MemoCreateModal from '@/components/MemoCreateModal';
import AppointmentModal from '@/components/AppointmentModal';
import AppointmentListModal from '@/components/AppointmentListModal';
import AppointmentDetailModal from '@/components/AppointmentDetailModal';
import GroupEditModal from '@/components/GroupEditModal';
import GroupTopicCreateModal from '@/components/GroupTopicCreateModal';
import GroupTopicDetailModal from '@/components/GroupTopicDetailModal';

interface GroupModalsProps {
  isMemoModalOpen: boolean; 
  setIsMemoModalOpen: (o: boolean) => void;
  isScheduleModalOpen: boolean; 
  setIsScheduleModalOpen: (o: boolean) => void;
  isListModalOpen: boolean; 
  setIsListModalOpen: (o: boolean) => void;
  isDetailOpen: boolean; 
  setIsDetailOpen: (o: boolean) => void;
  isEditModalOpen: boolean; 
  setIsEditModalOpen: (o: boolean) => void;
  isTopicModalOpen: boolean; 
  setIsTopicModalOpen: (o: boolean) => void;
  isTopicDetailOpen: boolean; 
  setIsTopicDetailOpen: (o: boolean) => void;
  groupId: string; 
  group: GroupResponse; 
  session: Session | null;
  selectedDate: string; 
  selectedSchedule: ScheduleResponse | null;
  selectedTopic: TopicResponse | null;
  onSuccess: () => void; 
  handleTopicEdit: (t: TopicResponse) => void;
  handleMemoClick: (id: string) => void; 
  handleEdit: (s: ScheduleResponse) => void;
  handleScheduleClick: (s: ScheduleResponse) => void;
  schedules: ScheduleResponse[];
  setSelectedSchedule: (s: ScheduleResponse | null) => void;
}

export function GroupModals({ 
  isMemoModalOpen, 
  setIsMemoModalOpen, 
  isScheduleModalOpen, 
  setIsScheduleModalOpen, 
  isListModalOpen, 
  setIsListModalOpen, 
  isDetailOpen, 
  setIsDetailOpen, 
  isEditModalOpen, 
  setIsEditModalOpen, 
  isTopicModalOpen, 
  setIsTopicModalOpen, 
  isTopicDetailOpen, 
  setIsTopicDetailOpen, 
  groupId, 
  group, 
  session, 
  selectedDate, 
  selectedSchedule, 
  selectedTopic, 
  onSuccess, 
  handleTopicEdit, 
  handleMemoClick, 
  handleEdit, 
  handleScheduleClick, 
  schedules, 
  setSelectedSchedule 
}: GroupModalsProps) {
  return (
    <>
      <MemoCreateModal 
        isOpen={isMemoModalOpen} 
        onClose={() => setIsMemoModalOpen(false)} 
        userId={session?.user?.id || ''} 
        groupId={groupId} 
        onSuccess={onSuccess} 
      />
      <AppointmentModal 
        isOpen={isScheduleModalOpen} 
        onClose={() => { setIsScheduleModalOpen(false); setSelectedSchedule(null); }} 
        initialDate={selectedDate} 
        onSuccess={onSuccess} 
        initialSchedule={selectedSchedule} 
      />
      <AppointmentListModal 
        isOpen={isListModalOpen} 
        onClose={() => setIsListModalOpen(false)} 
        date={selectedDate} 
        appointments={schedules.filter(s => isSameDay(parseISO(s.startTime), new Date(selectedDate)))} 
        onCreateNew={() => { setSelectedSchedule(null); setIsScheduleModalOpen(true); }} 
        onAppointmentClick={handleScheduleClick} 
      />
      <AppointmentDetailModal 
        isOpen={isDetailOpen} 
        onClose={() => { setIsDetailOpen(false); setSelectedSchedule(null); }} 
        schedule={selectedSchedule} 
        onSuccess={onSuccess} 
        onEdit={handleEdit} 
      />
      <GroupEditModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        group={group} 
        onSuccess={onSuccess} 
      />
      <GroupTopicCreateModal 
        isOpen={isTopicModalOpen} 
        onClose={() => setIsTopicModalOpen(false)} 
        groupId={groupId} 
        onSuccess={onSuccess} 
        initialTopic={selectedTopic} 
      />
      <GroupTopicDetailModal 
        isOpen={isTopicDetailOpen} 
        onClose={() => setIsTopicDetailOpen(false)} 
        topicId={selectedTopic?.id || null} 
        onDelete={onSuccess} 
        onEdit={handleTopicEdit} 
        onMemoClick={handleMemoClick} 
      />
    </>
  );
}
