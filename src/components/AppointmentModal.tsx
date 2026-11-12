'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { scheduleApi, type ScheduleResponse } from '@/lib/schedule-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { memoApi, type MemoResponse } from '@/lib/memo-api';
import { friendApi, type FriendResponse } from '@/lib/friend-api';
import { toLocalDateTimeString } from '@/lib/utils';
import { addHours, format, parseISO } from 'date-fns';
import { useKakaoMap } from '@/hooks/useKakaoMap';
import { usePlaceSearch } from '@/hooks/usePlaceSearch';
import { useMentions } from '@/hooks/useMentions';
import { Chip, MentionList, type MentionItem } from './Mentions';
import ImageWithFallback from './ImageWithFallback';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Star,
  Users,
  FileText,
  ChevronRight,
  Search,
  Loader2,
  Check
} from 'lucide-react';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  onSuccess?: () => void;
  initialSchedule?: ScheduleResponse | null;
}

import { useAlert } from '@/hooks/useAlert';

export default function AppointmentModal({ isOpen, onClose, initialDate, onSuccess, initialSchedule }: AppointmentModalProps) {
  const { data: session } = useSession();
  const { toast } = useAlert();
  const mapContainer = useRef<HTMLDivElement>(null);

  // ─── States ──────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate || format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState('12:00');
  const [location, setLocation] = useState('');
  const [memo, setMemo] = useState(''); 
  const [isSaving, setIsSaving] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const queryClient = useQueryClient();

  // ─── React Query Data Synchronization ──────────────────────────────
  const { data: userGroups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupApi.getAll(session!),
    enabled: !!session && isOpen
  });

  const { data: allMemos = [] } = useQuery({
    queryKey: ['memos'],
    queryFn: () => memoApi.getAll(session!),
    enabled: !!session && isOpen
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendApi.getFriends(session!),
    enabled: !!session && isOpen
  });

  // Selection states
  const [participants, setParticipants] = useState<Array<{ id?: string, nickname: string, profileImage?: string }>>([]);
  const [taggedMemos, setTaggedMemos] = useState<MemoResponse[]>([]);

  // Input states
  const [participantInput, setParticipantInput] = useState('');
  const [memoMentionInput, setMemoMentionInput] = useState('');

  // ─── Custom Hooks ────────────────────────────────────────────────
  const { isMapLoading, updatePosition } = useKakaoMap(mapContainer, isOpen);
  const { searchResults, isSearching, recommendations, isRecommending, searchPlaces, fetchRecommendations, clearSearchResults } = usePlaceSearch();
  const { 
    showMemoMentions, setShowMemoMentions, filteredMemos,
    showParticipantMentions, setShowParticipantMentions, filteredParticipants,
    handleInputChange
  } = useMentions({ allMemos, friends, userGroups, selectedGroupId, currentUserId: session?.user?.id });

  useEffect(() => {
    if (isOpen && initialDate) setDate(initialDate);
  }, [isOpen, initialDate]);

  useEffect(() => {
    if (isOpen && initialSchedule) {
      setTitle(initialSchedule.title);
      const start = parseISO(initialSchedule.startTime);
      setDate(format(start, 'yyyy-MM-dd'));
      setTime(format(start, 'HH:mm'));
      setLocation(initialSchedule.location || '');
      setMemo(initialSchedule.description || '');
      setSelectedGroupId(initialSchedule.groupId || '');
      setParticipants(initialSchedule.participants || []);
      setTaggedMemos(initialSchedule.taggedMemos || []);
      
      // 지도 이동 (기존 장소가 있는 경우)
      if (initialSchedule.location) {
        searchPlaces(initialSchedule.location);
      }
    } else if (isOpen) {
      setTitle(''); setMemo(''); setLocation(''); setSelectedGroupId('');
      setTaggedMemos([]);
      if (session?.user) {
        setParticipants([{ id: session.user.id, nickname: '나', profileImage: session.user.image || undefined }]);
      }
    }
  }, [isOpen, initialSchedule, session, searchPlaces]);

  // ─── Handlers ────────────────────────────────────────────────────
  const handleLocationSelect = useCallback((place: { place_name?: string, name?: string, y: string, x: string }) => {
    setLocation(place.place_name || place.name || '');
    updatePosition(parseFloat(place.y), parseFloat(place.x));
    fetchRecommendations(parseFloat(place.y), parseFloat(place.x));
    clearSearchResults();
  }, [updatePosition, fetchRecommendations, clearSearchResults]);

  const handleSave = async () => {
    if (!title.trim()) return toast.warning('제목을 입력해주세요.');
    setIsSaving(true);
    try {
      const start = parseISO(`${date}T${time || '00:00'}`);
      if (Number.isNaN(start.getTime())) {
        toast.warning('날짜와 시간을 확인해주세요.');
        return;
      }
      // 오프셋 없는 로컬 시각으로 전송 (19:00으로 저장한 일정은 19:00으로 돌아옵니다)
      const payload = {
        title, description: memo, startTime: toLocalDateTimeString(start),
        endTime: toLocalDateTimeString(addHours(start, 1)),
        location, groupId: selectedGroupId || undefined,
        taggedMemoIds: taggedMemos.map(m => m.id),
        participantIds: participants.filter(p => p.id).map(p => p.id!),
      };
      if (initialSchedule) await scheduleApi.update(initialSchedule.id, payload, session);
      else await scheduleApi.create(payload, session);
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('일정 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40 p-0 md:p-4 overflow-hidden" onClick={onClose}>
      <div className="bg-surface text-ink rounded-t-2xl md:rounded-2xl border border-line w-full max-w-xl flex flex-col shadow-float overflow-hidden max-h-[90vh] animate-slide-up md:animate-none" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-ink">{initialSchedule ? '일정 수정' : '새 일정'}</h2>
          <button onClick={onClose} className="btn-ghost"><X size={18} strokeWidth={1.5} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
          <Section label="일정 제목">
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="어떤 약속인가요" className="form-input text-base" />
          </Section>

          <div className="grid grid-cols-2 gap-4">
            <Section label="날짜" icon={<Calendar size={16} strokeWidth={1.5} />}>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="form-input" />
            </Section>
            <Section label="시간" icon={<Clock size={16} strokeWidth={1.5} />}>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="form-input" />
            </Section>
          </div>

          <Section label="모임 선택" icon={<Users size={16} strokeWidth={1.5} />}>
            <div className="relative">
              <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className="form-input appearance-none">
                <option value="">모임을 선택하세요 (개인 일정)</option>
                {userGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <ChevronRight size={16} strokeWidth={1.5} className="text-ink-3 absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
            </div>
          </Section>

          {/* Location Picker */}
          <Section label="장소 지정" icon={<MapPin size={16} strokeWidth={1.5} />}>
            <div className="relative">
              <input type="text" value={location} onChange={(e) => { setLocation(e.target.value); searchPlaces(e.target.value); }} placeholder="장소를 검색해요" className="form-input pr-10" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">{isSearching ? <Loader2 size={16} strokeWidth={1.5} className="text-ink-3 animate-spin" /> : <Search size={16} strokeWidth={1.5} className="text-ink-3" />}</div>
              {searchResults.length > 0 && (
                <div className="absolute z-20 w-full top-full mt-2 bg-surface rounded-[10px] shadow-float border border-line overflow-hidden max-h-60 overflow-y-auto">
                  {searchResults.map((r, i) => (
                    <button key={i} type="button" onClick={() => handleLocationSelect(r)} className="w-full text-left px-4 py-3 hover:bg-raised transition-colors duration-150 ease-out border-b border-line last:border-0 font-medium text-sm text-ink">
                      {r.place_name}<div className="text-xs text-ink-3 font-normal mt-0.5">{r.address_name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-[10px] overflow-hidden border border-line bg-raised relative mt-3">
              <div ref={mapContainer} className="w-full h-[220px]" />
              {isMapLoading && <div className="absolute inset-0 bg-surface/70 flex flex-col items-center justify-center z-10"><Loader2 size={18} strokeWidth={1.5} className="text-ink-3 animate-spin mb-2" /><p className="text-xs text-ink-2">위치를 확인하는 중이에요</p></div>}
            </div>
          </Section>

          {/* Recommendations */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-ink-2 flex items-center gap-1.5"><Star size={16} strokeWidth={1.5} className="text-ink-3" /> 주변 장소 추천</h4>
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
              {isRecommending ? <div className="p-4 bg-raised rounded-[10px] w-full text-center"><Loader2 size={16} strokeWidth={1.5} className="animate-spin text-ink-3 mx-auto" /></div> : recommendations.map((rec, idx) => (
                <RecommendationCard key={`${rec.id}-${idx}`} rec={rec} onClick={() => handleLocationSelect(rec)} />
              ))}
            </div>
          </div>

          {/* Participants */}
          <Section label="참여자" icon={<Users size={16} strokeWidth={1.5} />}>
            <div className="relative">
              <input type="text" value={participantInput} onChange={(e) => { setParticipantInput(e.target.value); handleInputChange(e.target.value, 'participant'); }} placeholder="친구 이름을 입력하거나 @를 눌러요" className="form-input" />
              {showParticipantMentions && (
                <MentionList items={filteredParticipants} onSelect={(m) => { setParticipants([...participants, { id: m.id, nickname: m.nickname || '', profileImage: m.profileImage }]); setShowParticipantMentions(false); setParticipantInput(''); }} />
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {participants.map((p, i) => <Chip key={i} label={p.nickname} image={p.profileImage} onRemove={p.nickname !== '나' ? () => setParticipants(participants.filter(item => item !== p)) : undefined} />)}
            </div>
          </Section>

          {/* Memos */}
          <Section label="관련 메모 언급 (@멘션)" icon={<FileText size={16} strokeWidth={1.5} />}>
            <div className="relative">
              <input type="text" value={memoMentionInput} onChange={(e) => { setMemoMentionInput(e.target.value); handleInputChange(e.target.value, 'memo'); }} placeholder="메모 제목을 입력하거나 @를 눌러요" className="form-input" />
              {showMemoMentions && <MentionList items={filteredMemos} onSelect={(m) => { setTaggedMemos([...taggedMemos, allMemos.find(memo => memo.id === m.id)!]); setShowMemoMentions(false); setMemoMentionInput(''); }} isMemo />}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {taggedMemos.map(m => <Chip key={m.id} label={m.title} icon={<FileText size={16} strokeWidth={1.5} />} onRemove={() => setTaggedMemos(taggedMemos.filter(item => item.id !== m.id))} />)}
            </div>
          </Section>

          <Section label="상세 메모" icon={<FileText size={16} strokeWidth={1.5} />}>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="일정에 대한 메모를 남겨요" className="form-input min-h-[120px] resize-none leading-relaxed" />
          </Section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-line flex justify-end gap-2 shrink-0">
          <button onClick={onClose} disabled={isSaving} className="btn-secondary">취소</button>
          <button onClick={handleSave} disabled={isSaving} className="btn-primary">{isSaving ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Check size={16} strokeWidth={1.5} />}{isSaving ? '저장 중…' : '저장'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub Components ─────────────────────────────────────────────

function Section({ label, icon, children }: { label: string, icon?: React.ReactNode, children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-ink-2 flex items-center gap-1.5"><span className="text-ink-3">{icon}</span>{label}</label>
      {children}
    </div>
  );
}

function RecommendationCard({ rec, onClick }: { rec: { id: string | number, name: string, image: string, rating: string, category: string, distance: string, y: string, x: string, desc: string }, onClick: () => void }) {
  return (
    <div onClick={onClick} className="flex-shrink-0 w-44 bg-surface border border-line rounded-[10px] overflow-hidden hover:bg-raised transition-colors duration-150 ease-out cursor-pointer">
      <div className="relative h-24 w-full bg-raised">
        <ImageWithFallback 
          src={rec.image} 
          alt={rec.name} 
          fill 
          containerClassName="w-full h-full"
          className="object-cover" 
        />
        <div className="absolute top-1.5 right-1.5 z-10 bg-surface/90 text-ink text-xs tabular-nums px-1.5 py-0.5 rounded-md flex items-center gap-1"><Star size={12} strokeWidth={1.5} className="text-ink-3" /> {rec.rating}</div>
      </div>
      <div className="p-3"><h4 className="font-medium text-ink text-xs truncate">{rec.name}</h4><p className="text-xs text-ink-3">{rec.category} · {rec.distance}</p></div>
    </div>
  );
}