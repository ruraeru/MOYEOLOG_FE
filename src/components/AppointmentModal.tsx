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
import { usePlaceWeather } from '@/hooks/useWeather';
import { recommendFor, weatherAt } from '@/lib/weather';
import { WeatherLine } from '@/components/Weather';
import { useMentions } from '@/hooks/useMentions';
import { useAlert } from '@/hooks/useAlert';
import { Chip, MentionList } from './Mentions';
import ImageWithFallback from './ImageWithFallback';
import { Modal } from './ui';
import {
  Clock,
  MapPin,
  Users,
  UserPlus,
  FileText,
  AlignLeft,
  ChevronDown,
  Search,
  Loader2,
  type LucideIcon,
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

/** 참여자 멘션 목록의 '전체' 항목 (모임 멤버를 한 번에 넣는다) */
const ALL_MEMBERS_ID = '__all__';

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

  // 지도에서 고른 장소의 좌표(날씨·저장용). 장소를 직접 고쳐 쓰면 지운다.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  // 주변 추천을 보여 줄 좌표. 이 모달에서 장소를 고른 뒤에만 채운다(수정 화면을 열기만 해서는 추천하지 않음).
  const [recommendAt, setRecommendAt] = useState<{ lat: number; lng: number } | null>(null);

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

  // 모임 일정에서 '전체'로 한 번에 넣을 사람들: 그 모임의 멤버 중 나와 이미 고른 사람을 뺀 나머지
  const remainingMembers = useMemo(() => {
    if (!selectedGroupId) return [];
    const chosen = new Set(participants.map((p) => p.id).filter(Boolean));
    const members = userGroups.find((g) => g.id === selectedGroupId)?.members ?? [];
    return members.filter((m) => m.id !== currentUserId && !chosen.has(m.id));
  }, [selectedGroupId, userGroups, participants, currentUserId]);

  // 이미 추가한 참여자·메모는 후보에서 뺀다.
  // 모임 일정이고 아직 안 고른 멤버가 있으면 맨 위에 '전체'를 둔다 ('@', '@전', '@전체' 일 때). 둘뿐인 모임에서도 나온다.
  const participantCandidates = useMemo(() => {
    const chosen = new Set(participants.map((p) => p.id).filter(Boolean));
    const people = filteredParticipants.filter((m) => !chosen.has(m.id));
    const typed = (participantInput.split('@').pop() ?? '').trim();
    if (remainingMembers.length >= 1 && '전체'.includes(typed)) {
      return [{ id: ALL_MEMBERS_ID, nickname: `전체 (${remainingMembers.length}명)` }, ...people];
    }
    return people;
  }, [filteredParticipants, participants, participantInput, remainingMembers]);

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
      setCoords(initialSchedule.latitude != null && initialSchedule.longitude != null
        ? { lat: initialSchedule.latitude, lng: initialSchedule.longitude } : null);
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
      setTitle(''); setMemo(''); setLocation(''); setCoords(null);
      setDate(day); setTime('12:00');
      setEndDate(day); setEndTime('13:00');
      setSelectedGroupId(defaultGroupId || '');
      setTaggedMemos([]);
      setParticipants(currentUserId ? [{ id: currentUserId, nickname: '나', profileImage: currentUserImage }] : []);
    }
    if (isOpen) {
      setParticipantInput(''); setMemoMentionInput(''); setRecommendAt(null);
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
    const picked = { lat: parseFloat(place.y), lng: parseFloat(place.x) };
    updatePosition(picked.lat, picked.lng);
    setCoords(picked);
    setRecommendAt(picked);
    clearSearchResults();
  }, [updatePosition, clearSearchResults]);

  // 일정 시작 시각의 그 장소 날씨. 예보 범위(10일) 밖이거나 날씨를 못 받으면 null.
  const { data: forecast, isLoading: isWeatherLoading } = usePlaceWeather(coords?.lat, coords?.lng);
  const startText = `${date}T${time}:00`;
  const weather = forecast ? weatherAt(forecast, startText) : null;
  const recommend = recommendFor(weather);
  const categoryKey = recommend.categories.join(',');

  // 장소를 고르면 날씨가 정해진 뒤 한 번, 시작 시각을 바꿔 날씨가 달라지면 다시 추천한다.
  useEffect(() => {
    if (!recommendAt || isWeatherLoading) return;
    fetchRecommendations(recommendAt.lat, recommendAt.lng, categoryKey.split(','));
  }, [recommendAt, isWeatherLoading, categoryKey, fetchRecommendations]);

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return toast.warning('제목을 입력해 주세요.');
    if (codePointLength(trimmedTitle) > SCHEDULE_TITLE_MAX) return toast.warning(`제목은 ${SCHEDULE_TITLE_MAX}자까지 쓸 수 있어요.`);
    if (codePointLength(memo) > SCHEDULE_DESCRIPTION_MAX) return toast.warning('설명은 5,000자까지 쓸 수 있어요.');
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
        location, latitude: coords?.lat ?? null, longitude: coords?.lng ?? null,
        groupId: selectedGroupId || undefined,
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

  const footer = (
    <>
      <button onClick={onClose} disabled={isSaving} className="btn-secondary">취소</button>
      <button onClick={handleSave} disabled={isSaving} className="btn-primary">
        {isSaving && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
        {isSaving ? '저장 중…' : '저장'}
      </button>
    </>
  );

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={initialSchedule ? '일정 수정' : '새 일정'}
      size="md"
      zIndex="z-[120]"
      footer={footer}
      bodyClassName="space-y-6"
    >
          {/* 제목 (주아) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="appt-title" className="text-[13px] font-medium text-ink-2">일정 제목</label>
              {titleLength >= SCHEDULE_TITLE_MAX - 30 && <span className="stamp">{titleLength}/{SCHEDULE_TITLE_MAX}</span>}
            </div>
            <input id="appt-title" type="text" value={title} onChange={(e) => setTitle(truncateCodePoints(e.target.value, SCHEDULE_TITLE_MAX))} placeholder="어떤 약속인가요" className="form-input h-11 font-display text-lg" />
          </div>

          {/* 시간 */}
          <Row icon={Clock} label="시간">
            <div className="space-y-2">
              <div className="grid grid-cols-[32px_minmax(0,1fr)_minmax(128px,40%)] items-center gap-2">
                <span className="text-[13px] text-ink-3">시작</span>
                <input type="date" aria-label="시작 날짜" value={date} onChange={(e) => changeStart(e.target.value, time)} className="form-input tabular-nums" />
                <input type="time" aria-label="시작 시간" value={time} onChange={(e) => changeStart(date, e.target.value)} className="form-input tabular-nums" />
              </div>
              <div className="grid grid-cols-[32px_minmax(0,1fr)_minmax(128px,40%)] items-center gap-2">
                <span className="text-[13px] text-ink-3">종료</span>
                <input type="date" aria-label="종료 날짜" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} className="form-input tabular-nums" />
                <input type="time" aria-label="종료 시간" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="form-input tabular-nums" />
              </div>
            </div>
          </Row>

          {/* 모임 */}
          <Row icon={Users} label="모임">
            <div className="relative">
              <select aria-label="모임" value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className="form-input appearance-none pr-9">
                <option value="">모임 없음 (개인 일정)</option>
                {userGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <ChevronDown size={16} strokeWidth={1.5} className="text-ink-3 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </Row>

          {/* 장소 + 지도 */}
          <Row icon={MapPin} label="장소">
            <div className="relative">
              <input type="text" aria-label="장소" value={location} onChange={(e) => { const v = truncateCodePoints(e.target.value, SCHEDULE_LOCATION_MAX); setLocation(v); setCoords(null); setRecommendAt(null); searchPlaces(v); }} placeholder="장소를 검색해요" className="form-input pr-10" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3">{isSearching ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Search size={16} strokeWidth={1.5} />}</div>
              {searchResults.length > 0 && (
                <div className="absolute z-20 w-full top-full mt-1 bg-surface rounded-[10px] shadow-float border border-line overflow-hidden max-h-60 overflow-y-auto">
                  {searchResults.map((r, i) => (
                    <button key={i} type="button" onClick={() => handleLocationSelect(r)} className="w-full text-left px-3 py-2.5 hover:bg-raised transition-colors border-b border-line last:border-0">
                      <span className="block text-sm font-medium text-ink">{r.place_name}</span>
                      <span className="mt-0.5 block text-xs text-ink-3">{r.address_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-[10px] overflow-hidden border border-line bg-raised relative mt-2">
              <div ref={mapContainer} className="w-full h-[180px] md:h-[220px]" />
              {isMapLoading && <div className="absolute inset-0 bg-surface/70 flex flex-col items-center justify-center gap-2 z-10"><Loader2 size={18} strokeWidth={1.5} className="text-ink-3 animate-spin" /><p className="text-xs text-ink-2">위치를 확인하는 중이에요</p></div>}
            </div>

            {weather && (
              <p className="mt-2 text-[13px] text-ink-2">
                <span className="text-ink-3">일정 시각 날씨 </span>
                <WeatherLine weather={weather} />
              </p>
            )}

            {recommendAt && (isRecommending || recommendations.length > 0) && (
              <div className="mt-4">
                <p className="mb-2 text-[13px] font-medium text-ink-2">
                  주변 추천
                  {recommend.reason && <span className="ml-2 font-normal text-ink-3">{recommend.reason}</span>}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {isRecommending ? (
                    <div className="flex h-20 w-full items-center justify-center rounded-[10px] border border-line"><Loader2 size={16} strokeWidth={1.5} className="animate-spin text-ink-3" /></div>
                  ) : recommendations.map((rec, idx) => (
                    <RecommendationCard key={`${rec.id}-${idx}`} rec={rec} onClick={() => handleLocationSelect(rec)} />
                  ))}
                </div>
              </div>
            )}
          </Row>

          {/* 참여자 */}
          <Row icon={UserPlus} label="참여자">
            <div className="relative">
              <input type="text" aria-label="참여자" value={participantInput} onChange={(e) => { setParticipantInput(e.target.value); handleInputChange(e.target.value, 'participant'); }} placeholder={selectedGroupId ? '모임원 이름을 입력하거나 @를 눌러요. @전체도 돼요' : '친구 이름을 입력하거나 @를 눌러요'} className="form-input" />
              {showParticipantMentions && (
                <MentionList
                  items={participantCandidates}
                  onSelect={(m) => {
                    if (m.id === ALL_MEMBERS_ID) {
                      setParticipants([
                        ...participants,
                        ...remainingMembers.map((x) => ({ id: x.id, nickname: x.nickname || '', profileImage: x.profileImage })),
                      ]);
                    } else if (!participants.some((p) => p.id === m.id)) {
                      setParticipants([...participants, { id: m.id, nickname: m.nickname || '', profileImage: m.profileImage }]);
                    }
                    setShowParticipantMentions(false);
                    setParticipantInput('');
                  }}
                />
              )}
            </div>
            {participants.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {participants.map((p, i) => (
                  <Chip
                    key={p.id || `p-${i}`}
                    label={p.id && p.id === currentUserId ? '나' : p.nickname}
                    image={p.profileImage}
                    onRemove={p.id && p.id === currentUserId ? undefined : () => setParticipants(participants.filter(item => item !== p))}
                  />
                ))}
              </div>
            )}
          </Row>

          {/* 연결할 메모 */}
          <Row icon={FileText} label="연결할 메모">
            <div className="relative">
              <input type="text" aria-label="연결할 메모" value={memoMentionInput} onChange={(e) => { setMemoMentionInput(e.target.value); handleInputChange(e.target.value, 'memo'); }} placeholder={selectedGroupId ? '내 메모나 모임 메모 제목을 입력하거나 @를 눌러요' : '메모 제목을 입력하거나 @를 눌러요'} className="form-input" />
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
            {taggedMemos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {taggedMemos.map(m => <Chip key={m.id} label={m.title} icon={<FileText size={16} strokeWidth={1.5} />} onRemove={() => setTaggedMemos(taggedMemos.filter(item => item.id !== m.id))} />)}
              </div>
            )}
          </Row>

          {/* 설명 */}
          <Row icon={AlignLeft} label="설명">
            <textarea aria-label="설명" value={memo} onChange={(e) => setMemo(truncateCodePoints(e.target.value, SCHEDULE_DESCRIPTION_MAX))} placeholder="일정에 대한 설명을 남겨요" className="form-input min-h-[120px] resize-none leading-relaxed" />
          </Row>
    </Modal>
  );
}

// ─── Sub Components ─────────────────────────────────────────────

/** 아이콘 + 라벨 + 입력 행 */
function Row({ icon: Icon, label, children }: { icon: LucideIcon, label: string, children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-3">
      <Icon size={16} strokeWidth={1.5} className="mt-0.5 text-ink-3" aria-hidden />
      <div className="min-w-0">
        <p className="mb-1.5 text-[13px] font-medium text-ink-2">{label}</p>
        {children}
      </div>
    </div>
  );
}

function RecommendationCard({ rec, onClick }: { rec: { id: string | number, name: string, image: string, category: string, distance: string, y: string, x: string, desc: string }, onClick: () => void }) {
  return (
    <div onClick={onClick} className="w-40 shrink-0 cursor-pointer overflow-hidden rounded-[10px] border border-line bg-surface transition-colors hover:bg-raised">
      <div className="relative h-20 w-full bg-raised">
        <ImageWithFallback 
          src={rec.image} 
          alt={rec.name} 
          fill 
          containerClassName="w-full h-full"
          className="object-cover" 
        />
      </div>
      <div className="px-3 py-2"><p className="truncate text-[13px] font-medium text-ink">{rec.name}</p><p className="truncate text-xs text-ink-3">{rec.category} · {rec.distance}</p></div>
    </div>
  );
}