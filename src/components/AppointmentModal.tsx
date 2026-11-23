'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { scheduleApi, type ScheduleResponse } from '@/lib/schedule-api';
import { groupApi } from '@/lib/group-api';
import { memoApi, type MemoResponse } from '@/lib/memo-api';
import { friendApi } from '@/lib/friend-api';
import { getApiErrorMessage } from '@/lib/axios';
import { toLocalDateTimeString } from '@/lib/utils';
import {
  SCHEDULE_DESCRIPTION_MAX,
  SCHEDULE_LOCATION_MAX,
  SCHEDULE_TITLE_MAX,
  codePointLength,
  truncateCodePoints,
} from '@/lib/schedule-utils';
import { addHours, addMilliseconds, format, parseISO } from 'date-fns';
import { useKakaoMap } from '@/hooks/useKakaoMap';
import { usePlaceSearch } from '@/hooks/usePlaceSearch';
import { useMentions } from '@/hooks/useMentions';
import { useAlert } from '@/hooks/useAlert';
import { Chip, MentionList } from './Mentions';
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
  /** 새 일정을 만들 때 미리 선택할 모임 (모임 화면에서 열 때) */
  defaultGroupId?: string;
}

type Participant = { id?: string; nickname: string; profileImage?: string };
type TaggedMemo = { id: string; title: string };

const toDateTime = (d: string, t: string) => parseISO(`${d}T${t || '00:00'}`);

export default function AppointmentModal({ isOpen, onClose, initialDate, onSuccess, initialSchedule, defaultGroupId }: AppointmentModalProps) {
  const { data: session } = useSession();
  const { toast } = useAlert();
  const mapContainer = useRef<HTMLDivElement>(null);
  const currentUserId = session?.user?.id;
  const currentUserImage = session?.user?.image || undefined;

  // ─── States ──────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate || format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState('12:00');
  const [endDate, setEndDate] = useState(initialDate || format(new Date(), 'yyyy-MM-dd'));
  const [endTime, setEndTime] = useState('13:00');
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

  // 모임 일정이면 그 모임의 메모(회의록 등)도 언급할 수 있게 한다.
  const { data: groupMemos = [] } = useQuery({
    queryKey: ['groups', selectedGroupId, 'memos'],
    queryFn: () => groupApi.getGroupMemos(selectedGroupId, session!),
    enabled: !!session && isOpen && !!selectedGroupId
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendApi.getFriends(session!),
    enabled: !!session && isOpen
  });

  const mentionableMemos = useMemo(() => {
    const map = new Map<string, MemoResponse>();
    allMemos.forEach((m) => map.set(m.id, m));
    if (selectedGroupId) groupMemos.forEach((m) => map.set(m.id, m));
    return [...map.values()];
  }, [allMemos, groupMemos, selectedGroupId]);

  // Selection states
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [taggedMemos, setTaggedMemos] = useState<TaggedMemo[]>([]);

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
  } = useMentions({ allMemos: mentionableMemos, friends, userGroups, selectedGroupId, currentUserId });

  // 이미 추가한 참여자·메모는 후보에서 뺀다.
  const participantCandidates = useMemo(() => {
    const chosen = new Set(participants.map((p) => p.id).filter(Boolean));
    return filteredParticipants.filter((m) => !chosen.has(m.id));
  }, [filteredParticipants, participants]);

  const memoCandidates = useMemo(() => {
    const chosen = new Set(taggedMemos.map((m) => m.id));
    return filteredMemos.filter((m) => !chosen.has(m.id));
  }, [filteredMemos, taggedMemos]);

  // 모달이 열릴 때 한 번 초기화한다(세션 객체가 갱신돼도 입력 중인 값은 유지).
  useEffect(() => {
    if (isOpen && initialSchedule) {
      setTitle(initialSchedule.title);
      const start = parseISO(initialSchedule.startTime);
      const parsedEnd = parseISO(initialSchedule.endTime);
      const end = Number.isNaN(parsedEnd.getTime()) || parsedEnd < start ? addHours(start, 1) : parsedEnd;
      setDate(format(start, 'yyyy-MM-dd'));
      setTime(format(start, 'HH:mm'));
      setEndDate(format(end, 'yyyy-MM-dd'));
      setEndTime(format(end, 'HH:mm'));
      setLocation(initialSchedule.location || '');
      setMemo(initialSchedule.description || '');
      setSelectedGroupId(initialSchedule.groupId || '');
      setParticipants(initialSchedule.participants || []);
      setTaggedMemos((initialSchedule.taggedMemos || []).map((m) => ({ id: m.id, title: m.title })));

      // 지도 이동 (기존 장소가 있는 경우)
      if (initialSchedule.location) {
        searchPlaces(initialSchedule.location);
      }
    } else if (isOpen) {
      const day = initialDate || format(new Date(), 'yyyy-MM-dd');
      setTitle(''); setMemo(''); setLocation('');
      setDate(day); setTime('12:00');
      setEndDate(day); setEndTime('13:00');
      setSelectedGroupId(defaultGroupId || '');
      setTaggedMemos([]);
      setParticipants(currentUserId ? [{ id: currentUserId, nickname: '나', profileImage: currentUserImage }] : []);
    }
    if (isOpen) {
      setParticipantInput(''); setMemoMentionInput('');
    }
  }, [isOpen, initialSchedule, initialDate, defaultGroupId, currentUserId, currentUserImage, searchPlaces]);

  // ─── Handlers ────────────────────────────────────────────────────
  /** 시작을 바꾸면 기간을 유지한 채 종료도 같이 옮긴다. */
  const changeStart = (nextDate: string, nextTime: string) => {
    const prevStart = toDateTime(date, time);
    const prevEnd = toDateTime(endDate, endTime);
    const nextStart = toDateTime(nextDate, nextTime);
    setDate(nextDate);
    setTime(nextTime);
    if (Number.isNaN(nextStart.getTime())) return;
    const duration = prevEnd.getTime() - prevStart.getTime();
    const nextEnd = Number.isNaN(duration) || duration < 0 ? addHours(nextStart, 1) : addMilliseconds(nextStart, duration);
    setEndDate(format(nextEnd, 'yyyy-MM-dd'));
    setEndTime(format(nextEnd, 'HH:mm'));
  };

  const handleLocationSelect = useCallback((place: { place_name?: string, name?: string, y: string, x: string }) => {
    setLocation(truncateCodePoints(place.place_name || place.name || '', SCHEDULE_LOCATION_MAX));
    updatePosition(parseFloat(place.y), parseFloat(place.x));
    fetchRecommendations(parseFloat(place.y), parseFloat(place.x));
    clearSearchResults();
  }, [updatePosition, fetchRecommendations, clearSearchResults]);

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return toast.warning('제목을 입력해 주세요.');
    if (codePointLength(trimmedTitle) > SCHEDULE_TITLE_MAX) return toast.warning(`제목은 ${SCHEDULE_TITLE_MAX}자까지 쓸 수 있어요.`);
    if (codePointLength(memo) > SCHEDULE_DESCRIPTION_MAX) return toast.warning('상세 메모는 5,000자까지 쓸 수 있어요.');
    const start = toDateTime(date, time);
    const end = toDateTime(endDate, endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return toast.warning('날짜와 시간을 확인해 주세요.');
    }
    if (end < start) return toast.warning('종료 시각은 시작 시각보다 늦어야 해요.');

    setIsSaving(true);
    try {
      // 오프셋 없는 로컬 시각으로 전송 (19:00으로 저장한 일정은 19:00으로 돌아옵니다)
      const payload = {
        title: trimmedTitle, description: memo, startTime: toLocalDateTimeString(start),
        endTime: toLocalDateTimeString(end),
        location, groupId: selectedGroupId || undefined,
        taggedMemoIds: [...new Set(taggedMemos.map(m => m.id))],
        participantIds: [...new Set(participants.filter(p => p.id).map(p => p.id!))],
      };
      if (initialSchedule) await scheduleApi.update(initialSchedule.id, payload, session);
      else await scheduleApi.create(payload, session);
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const titleLength = codePointLength(title);

  return (
    <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center bg-black/40 p-0 md:p-4 overflow-hidden" onClick={onClose}>
      <div className="bg-surface text-ink rounded-t-2xl md:rounded-2xl border border-line w-full max-w-xl flex flex-col shadow-float overflow-hidden max-h-[92dvh] md:max-h-[90vh] animate-slide-up md:animate-none" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 md:px-6 py-4 border-b border-line flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-ink">{initialSchedule ? '일정 수정' : '새 일정'}</h2>
          <button onClick={onClose} className="btn-ghost" aria-label="닫기"><X size={18} strokeWidth={1.5} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-5 md:p-6 space-y-6">
          <Section label="일정 제목" aside={titleLength >= SCHEDULE_TITLE_MAX - 30 ? <span className="stamp">{titleLength}/{SCHEDULE_TITLE_MAX}</span> : undefined}>
            <input type="text" value={title} onChange={(e) => setTitle(truncateCodePoints(e.target.value, SCHEDULE_TITLE_MAX))} placeholder="어떤 약속인가요" className="form-input text-base" />
          </Section>

          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <Section label="시작 날짜" icon={<Calendar size={16} strokeWidth={1.5} />}>
              <input type="date" value={date} onChange={(e) => changeStart(e.target.value, time)} className="form-input" />
            </Section>
            <Section label="시작 시간" icon={<Clock size={16} strokeWidth={1.5} />}>
              <input type="time" value={time} onChange={(e) => changeStart(date, e.target.value)} className="form-input" />
            </Section>
            <Section label="종료 날짜" icon={<Calendar size={16} strokeWidth={1.5} />}>
              <input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} className="form-input" />
            </Section>
            <Section label="종료 시간" icon={<Clock size={16} strokeWidth={1.5} />}>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="form-input" />
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
              <input type="text" value={location} onChange={(e) => { const v = truncateCodePoints(e.target.value, SCHEDULE_LOCATION_MAX); setLocation(v); searchPlaces(v); }} placeholder="장소를 검색해요" className="form-input pr-10" />
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
              <div ref={mapContainer} className="w-full h-[180px] md:h-[220px]" />
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
                <MentionList
                  items={participantCandidates}
                  onSelect={(m) => {
                    if (!participants.some((p) => p.id === m.id)) {
                      setParticipants([...participants, { id: m.id, nickname: m.nickname || '', profileImage: m.profileImage }]);
                    }
                    setShowParticipantMentions(false);
                    setParticipantInput('');
                  }}
                />
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {participants.map((p, i) => (
                <Chip
                  key={p.id || `p-${i}`}
                  label={p.id && p.id === currentUserId ? '나' : p.nickname}
                  image={p.profileImage}
                  onRemove={p.id && p.id === currentUserId ? undefined : () => setParticipants(participants.filter(item => item !== p))}
                />
              ))}
            </div>
          </Section>

          {/* Memos */}
          <Section label="관련 메모 언급 (@멘션)" icon={<FileText size={16} strokeWidth={1.5} />}>
            <div className="relative">
              <input type="text" value={memoMentionInput} onChange={(e) => { setMemoMentionInput(e.target.value); handleInputChange(e.target.value, 'memo'); }} placeholder={selectedGroupId ? '내 메모나 모임 메모 제목을 입력하거나 @를 눌러요' : '메모 제목을 입력하거나 @를 눌러요'} className="form-input" />
              {showMemoMentions && (
                <MentionList
                  items={memoCandidates}
                  onSelect={(m) => {
                    if (!taggedMemos.some((t) => t.id === m.id)) {
                      setTaggedMemos([...taggedMemos, { id: m.id, title: m.title || '' }]);
                    }
                    setShowMemoMentions(false);
                    setMemoMentionInput('');
                  }}
                  isMemo
                />
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {taggedMemos.map(m => <Chip key={m.id} label={m.title} icon={<FileText size={16} strokeWidth={1.5} />} onRemove={() => setTaggedMemos(taggedMemos.filter(item => item.id !== m.id))} />)}
            </div>
          </Section>

          <Section label="상세 메모" icon={<FileText size={16} strokeWidth={1.5} />}>
            <textarea value={memo} onChange={(e) => setMemo(truncateCodePoints(e.target.value, SCHEDULE_DESCRIPTION_MAX))} placeholder="일정에 대한 메모를 남겨요" className="form-input min-h-[120px] resize-none leading-relaxed" />
          </Section>
        </div>

        {/* Footer */}
        <div className="px-5 md:px-6 py-4 border-t border-line flex justify-end gap-2 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button onClick={onClose} disabled={isSaving} className="btn-secondary">취소</button>
          <button onClick={handleSave} disabled={isSaving} className="btn-primary">{isSaving ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Check size={16} strokeWidth={1.5} />}{isSaving ? '저장 중…' : '저장'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub Components ─────────────────────────────────────────────

function Section({ label, icon, aside, children }: { label: string, icon?: React.ReactNode, aside?: React.ReactNode, children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-ink-2 flex items-center gap-1.5"><span className="text-ink-3">{icon}</span>{label}</label>
        {aside}
      </div>
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