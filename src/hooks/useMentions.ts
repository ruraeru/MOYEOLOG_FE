import { useState, useCallback, useMemo } from 'react';
import type { MemoResponse } from '@/lib/memo-api';
import type { FriendResponse } from '@/lib/friend-api';
import type { GroupResponse } from '@/lib/group-api';
import type { ScheduleResponse } from '@/lib/schedule-api';

interface UseMentionsProps {
  allMemos: MemoResponse[];
  friends: FriendResponse[];
  userGroups: GroupResponse[];
  schedules?: ScheduleResponse[];
  selectedGroupId?: string;
  currentUserId?: string;
}

export function useMentions({ allMemos, friends, userGroups, schedules = [], selectedGroupId, currentUserId }: UseMentionsProps) {
  const [showMemoMentions, setShowMemoMentions] = useState(false);
  const [memoQuery, setMemoQuery] = useState('');
  
  const [showParticipantMentions, setShowParticipantMentions] = useState(false);
  const [participantQuery, setParticipantQuery] = useState('');

  const [showScheduleMentions, setShowScheduleMentions] = useState(false);
  const [scheduleQuery, setScheduleQuery] = useState('');

  const handleInputChange = useCallback((value: string, type: 'memo' | 'participant' | 'schedule') => {
    const lastChar = value.slice(-1);
    if (lastChar === '@') {
      if (type === 'memo') {
        setShowMemoMentions(true);
        setMemoQuery('');
      } else if (type === 'schedule') {
        setShowScheduleMentions(true);
        setScheduleQuery('');
      } else {
        setShowParticipantMentions(true);
        setParticipantQuery('');
      }
    } else if (!value.includes('@')) {
      // @ 를 지웠거나(입력칸을 비운 경우 포함) 처음부터 없으면 목록을 닫아요.
      if (type === 'memo') setShowMemoMentions(false);
      else if (type === 'schedule') setShowScheduleMentions(false);
      else setShowParticipantMentions(false);
    } else {
      const parts = value.split('@');
      const query = parts[parts.length - 1];
      if (type === 'memo' && showMemoMentions) setMemoQuery(query);
      if (type === 'schedule' && showScheduleMentions) setScheduleQuery(query);
      if (type === 'participant' && showParticipantMentions) setParticipantQuery(query);
    }
  }, [showMemoMentions, showParticipantMentions, showScheduleMentions]);

  /** 모든 멘션 목록을 닫아요(등록·전송 뒤 등). */
  const closeMentions = useCallback(() => {
    setShowMemoMentions(false);
    setShowParticipantMentions(false);
    setShowScheduleMentions(false);
  }, []);

  const filteredMemos = useMemo(() => 
    allMemos.filter((m) => m.title.toLowerCase().includes(memoQuery.toLowerCase())),
  [allMemos, memoQuery]);

  const filteredSchedules = useMemo(() => 
    schedules.filter((s) => s.title.toLowerCase().includes(scheduleQuery.toLowerCase())),
  [schedules, scheduleQuery]);

  const mentionCandidates = useMemo(() => {
    const candidates = selectedGroupId 
      ? userGroups.find(g => g.id === selectedGroupId)?.members || []
      : friends.map(f => ({ id: f.userId, nickname: f.nickname, profileImage: f.profileImage }));
    
    return candidates.filter(m => m.id !== currentUserId);
  }, [selectedGroupId, userGroups, friends, currentUserId]);

  const filteredParticipants = useMemo(() => 
    mentionCandidates.filter(m => m.nickname.toLowerCase().includes(participantQuery.toLowerCase())),
  [mentionCandidates, participantQuery]);

  return {
    showMemoMentions, setShowMemoMentions, filteredMemos,
    showParticipantMentions, setShowParticipantMentions, filteredParticipants,
    showScheduleMentions, setShowScheduleMentions, filteredSchedules,
    handleInputChange, closeMentions
  };
}