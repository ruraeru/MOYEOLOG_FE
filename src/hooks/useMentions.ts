import { useState, useCallback, useMemo } from 'react';
import type { MemoResponse } from '@/lib/memo-api';
import type { FriendResponse } from '@/lib/friend-api';
import type { GroupResponse } from '@/lib/group-api';

interface UseMentionsProps {
  allMemos: MemoResponse[];
  friends: FriendResponse[];
  userGroups: GroupResponse[];
  selectedGroupId?: string;
  currentUserId?: string;
}

export function useMentions({ allMemos, friends, userGroups, selectedGroupId, currentUserId }: UseMentionsProps) {
  const [showMemoMentions, setShowMemoMentions] = useState(false);
  const [memoQuery, setMemoQuery] = useState('');
  const [showParticipantMentions, setShowParticipantMentions] = useState(false);
  const [participantQuery, setParticipantQuery] = useState('');

  const handleInputChange = useCallback((value: string, type: 'memo' | 'participant') => {
    const lastChar = value.slice(-1);
    if (lastChar === '@') {
      if (type === 'memo') {
        setShowMemoMentions(true);
        setMemoQuery('');
      } else {
        setShowParticipantMentions(true);
        setParticipantQuery('');
      }
    } else {
      const parts = value.split('@');
      const query = parts[parts.length - 1];
      if (type === 'memo' && showMemoMentions) setMemoQuery(query);
      if (type === 'participant' && showParticipantMentions) setParticipantQuery(query);
    }
  }, [showMemoMentions, showParticipantMentions]);

  const filteredMemos = useMemo(() => 
    allMemos.filter((m) => m.title.toLowerCase().includes(memoQuery.toLowerCase())),
  [allMemos, memoQuery]);

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
    handleInputChange
  };
}
