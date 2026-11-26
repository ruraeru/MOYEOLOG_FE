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
import GroupInviteModal from '@/components/GroupInviteModal';
import { groupStyle } from './GroupIdentity';

/**
 * 모임 일정 탭에서 만든 일정이 그 모임 일정으로 저장되도록 defaultGroupId 를 넘긴다.
 * (prop 은 fe-schedule 이 AppointmentModal 에 추가한다. 추가 전후 모두 타입 검사가 통과하게 넓힌 타입으로 쓴다.)
 */
/** 같은 이유로 넓힌 타입: fe-schedule 이 추가한 groups prop (모임 색 점) */
const GroupAppointmentListModal = AppointmentListModal as React.ComponentType<
  React.ComponentProps<typeof AppointmentListModal> & { groups?: GroupResponse[] }
>;
const GroupAppointmentModal = AppointmentModal as React.ComponentType<
  React.ComponentProps<typeof AppointmentModal> & { defaultGroupId?: string }
>;

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
  isInviteModalOpen: boolean;
  setIsInviteModalOpen: (o: boolean) => void;
  groupId: string; 
  group: GroupResponse; 
  session: Session | null;
  selectedDate: string; 
  selectedSchedule: ScheduleResponse | null;
  selectedTopic: TopicResponse | null;
  /** 상세 모달로 열 토픽 ID (목록 클릭 또는 ?topic= 쿼리) */
  selectedTopicId: string | null;
  onTopicDetailClose: () => void;
  onSuccess: () => void; 
  /** 모임 정보 수정 후 (상세 + 사이드바 갱신) */
  onGroupUpdated: () => void;
  onGroupDeleted: () => void;
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
  isInviteModalOpen,
  setIsInviteModalOpen,
  groupId, 
  group, 
  session, 
  selectedDate, 
  selectedSchedule, 
  selectedTopic, 
  selectedTopicId,
  onTopicDetailClose,
  onSuccess, 
  onGroupUpdated,
  onGroupDeleted,
  handleTopicEdit, 
  handleMemoClick, 
  handleEdit, 
  handleScheduleClick, 
  schedules, 
  setSelectedSchedule 
}: GroupModalsProps) {
  // 창들도 모임 색 토큰(bg-group 등)을 받도록 모임 색 변수를 깐다. contents 라 배치에는 영향이 없다
  return (
    <div className="contents" style={groupStyle(group.colorTheme)}>
      <MemoCreateModal 
        isOpen={isMemoModalOpen} 
        onClose={() => setIsMemoModalOpen(false)} 
        userId={session?.user?.id || ''} 
        groupId={groupId} 
        onSuccess={onSuccess} 
      />
      <GroupAppointmentModal 
        isOpen={isScheduleModalOpen} 
        onClose={() => { setIsScheduleModalOpen(false); setSelectedSchedule(null); }} 
        initialDate={selectedDate} 
        onSuccess={onSuccess} 
        initialSchedule={selectedSchedule} 
        defaultGroupId={groupId}
      />
      <GroupAppointmentListModal 
        isOpen={isListModalOpen} 
        groups={[group]}
        onClose={() => setIsListModalOpen(false)} 
        date={selectedDate} 
        appointments={schedules.filter(s => isSameDay(parseISO(s.startTime), parseISO(selectedDate)))} 
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
      {isEditModalOpen && <GroupEditModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        group={group} 
        onSuccess={onGroupUpdated} 
        onDeleted={onGroupDeleted}
      />}
      <GroupTopicCreateModal 
        isOpen={isTopicModalOpen} 
        onClose={() => setIsTopicModalOpen(false)} 
        groupId={groupId} 
        onSuccess={onSuccess} 
        initialTopic={selectedTopic} 
      />
      <GroupTopicDetailModal 
        isOpen={isTopicDetailOpen} 
        onClose={onTopicDetailClose} 
        topicId={selectedTopicId} 
        onDelete={onSuccess} 
        onEdit={handleTopicEdit} 
        onMemoClick={handleMemoClick} 
        group={group}
      />
      {isInviteModalOpen && <GroupInviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        groupId={groupId}
        groupName={group.name}
        memberIds={group.members.map(m => m.id)}
        inviteCode={group.inviteCode}
      />}
    </div>
  );
}
