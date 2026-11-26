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
  User,
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

/** 창을 연 뒤 바뀐 것이 있는지 비교할 때 쓰는 값 */
const formKeyOf = (f: {
  title: string; date: string; time: string; endDate: string; endTime: string; location: string; memo: string;
  groupId: string; participantIds: (string | undefined)[]; memoIds: string[];
}) => JSON.stringify(f);

type FieldError = { field: 'title' | 'time' | 'memo'; message: string } | null;

/** 참여자 멘션 목록의 '전체' 항목 (모임 멤버를 한 번에 넣는다) */
const ALL_MEMBERS_ID = '__all__';

export default function AppointmentModal({ isOpen, onClose, initialDate, onSuccess, initialSchedule, defaultGroupId }: AppointmentModalProps) {
  const { data: session } = useSession();
  const { toast, confirm } = useAlert();
  const mapContainer = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<HTMLInputElement>(null);
  const memoRef = useRef<HTMLTextAreaElement>(null);
  const locationBoxRef = useRef<HTMLDivElement>(null);
  // 창을 열었을 때의 값. 지금 값과 다르면 닫기 전에 묻는다.
  const initialKey = useRef('');
  const isConfirmingClose = useRef(false);
  const [fieldError, setFieldError] = useState<FieldError>(null);
  // 글자 수 상한에 걸려 뒷부분을 잘랐는지
  const [cut, setCut] = useState<{ title: boolean; memo: boolean }>({ title: false, memo: false });
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
  const { map, isMapLoading, updatePosition, hideMarker } = useKakaoMap(mapContainer, isOpen);
  const { searchResults, isSearching, recommendations, isRecommending, searchPlaces, fetchRecommendations, clearSearchResults } = usePlaceSearch();
  const {
    showMemoMentions, setShowMemoMentions, filteredMemos,
    showParticipantMentions, setShowParticipantMentions, filteredParticipants,
    handleInputChange, closeMentions
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
      return [{ id: ALL_MEMBERS_ID, nickname: `전체 (${remainingMembers.length}명)`, icon: <Users size={14} strokeWidth={1.5} /> }, ...people];
    }
    return people;
  }, [filteredParticipants, participants, participantInput, remainingMembers]);

  // 후보가 아예 없을 때(검색 결과가 없는 것과 구분)
  const participantEmptyText = useMemo(() => {
    if (selectedGroupId) {
      const members = userGroups.find((g) => g.id === selectedGroupId)?.members ?? [];
      if (!members.some((m) => m.id !== currentUserId)) return '모임에 다른 멤버가 없어요';
    } else if (friends.length === 0) {
      return '아직 친구가 없어요';
    }
    return participants.length > 1 && !(participantInput.split('@').pop() ?? '').trim() ? '모두 골랐어요' : '찾는 결과가 없어요';
  }, [selectedGroupId, userGroups, currentUserId, friends.length, participants.length, participantInput]);

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
      // 지도는 저장된 좌표로 옮긴다(아래 coords 효과). 장소 이름으로 검색하면 목록이 저절로 떠서 하지 않는다.
      initialKey.current = formKeyOf({
        title: initialSchedule.title, date: format(start, 'yyyy-MM-dd'), time: format(start, 'HH:mm'),
        endDate: format(end, 'yyyy-MM-dd'), endTime: format(end, 'HH:mm'), location: initialSchedule.location || '',
        memo: initialSchedule.description || '', groupId: initialSchedule.groupId || '',
        participantIds: (initialSchedule.participants || []).map((p) => p.id), memoIds: (initialSchedule.taggedMemos || []).map((m) => m.id),
      });
    } else if (isOpen) {
      const day = initialDate || format(new Date(), 'yyyy-MM-dd');
      // 오늘이면 다음 정시부터 한 시간(23시 넘으면 23:00), 다른 날이면 12:00–13:00
      const now = new Date();
      const nextHour = Math.min(now.getHours() + 1, 23);
      const start = day === format(now, 'yyyy-MM-dd') ? `${String(nextHour).padStart(2, '0')}:00` : '12:00';
      const endAt = addHours(toDateTime(day, start), 1);
      const eDay = format(endAt, 'yyyy-MM-dd'), eTime = format(endAt, 'HH:mm');
      setTitle(''); setMemo(''); setLocation(''); setCoords(null);
      setDate(day); setTime(start);
      setEndDate(eDay); setEndTime(eTime);
      setSelectedGroupId(defaultGroupId || '');
      setTaggedMemos([]);
      setParticipants(currentUserId ? [{ id: currentUserId, nickname: '나', profileImage: currentUserImage }] : []);
      initialKey.current = formKeyOf({
        title: '', date: day, time: start, endDate: eDay, endTime: eTime, location: '', memo: '',
        groupId: defaultGroupId || '', participantIds: currentUserId ? [currentUserId] : [], memoIds: [],
      });
    }
    if (isOpen) {
      setParticipantInput(''); setMemoMentionInput(''); setRecommendAt(null);
      setFieldError(null); setCut({ title: false, memo: false }); clearSearchResults();
    }
  }, [isOpen, initialSchedule, initialDate, defaultGroupId, currentUserId, currentUserImage, clearSearchResults]);

  // 마우스로 쓰는 기기에서는 창을 열면 제목 칸에 바로 쓸 수 있게 한다(터치 기기는 키보드가 갑자기 올라오지 않게 두지 않음).
  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => {
      if (window.matchMedia?.('(pointer: fine)').matches) titleRef.current?.focus();
    }, 50);
    return () => clearTimeout(id);
  }, [isOpen]);

  // 지도 핀: 좌표가 있으면 그 자리로, 없으면 숨긴다(장소를 고르기 전·직접 고쳐 쓴 뒤).
  useEffect(() => {
    if (!map) return;
    if (coords) updatePosition(coords.lat, coords.lng);
    else hideMarker();
  }, [map, coords, updatePosition, hideMarker]);

  // 장소 검색 목록: 바깥을 누르면 닫는다.
  useEffect(() => {
    if (!searchResults.length) return;
    const onDown = (e: PointerEvent) => {
      if (!locationBoxRef.current?.contains(e.target as Node)) clearSearchResults();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [searchResults.length, clearSearchResults]);

  const formKey = formKeyOf({
    title, date, time, endDate, endTime, location, memo, groupId: selectedGroupId,
    participantIds: participants.map((p) => p.id), memoIds: taggedMemos.map((m) => m.id),
  });
  const isDirty = isOpen && formKey !== initialKey.current;

  /** 바깥 누르기·Esc·닫기·취소: 바꾼 것이 있으면 묻는다. */
  const requestClose = useCallback(async () => {
    if (isConfirmingClose.current) return;
    if (isDirty) {
      isConfirmingClose.current = true;
      const ok = await confirm('입력한 내용이 저장되지 않아요. 창을 닫을까요?', undefined, '닫기', '계속 쓰기');
      isConfirmingClose.current = false;
      if (!ok) return;
    }
    onClose();
  }, [isDirty, confirm, onClose]);

  // Esc: 장소 목록 → 멘션 목록(MentionList 가 먼저 받는다) → 창 닫기 순서.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || isConfirmingClose.current) return;
      if (searchResults.length) { clearSearchResults(); return; }
      requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, searchResults.length, clearSearchResults, requestClose]);

  /** 모임을 바꾸면 새 모임(또는 개인 일정이면 친구)에 없는 참여자를 뺀다. */
  const changeGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    closeMentions();
    const allowed = groupId
      ? new Set((userGroups.find((g) => g.id === groupId)?.members ?? []).map((m) => m.id))
      : new Set(friends.map((f) => f.userId));
    const kept = participants.filter((p) => !p.id || p.id === currentUserId || allowed.has(p.id));
    const removed = participants.length - kept.length;
    if (removed > 0) {
      setParticipants(kept);
      toast.info(groupId
        ? `이 모임 멤버가 아닌 ${removed}명을 참여자에서 뺐어요.`
        : `친구가 아닌 ${removed}명을 참여자에서 뺐어요.`);
    }
  };

  // ─── Handlers ────────────────────────────────────────────────────
  /** 시작을 바꾸면 기간을 유지한 채 종료도 같이 옮긴다. */
  const changeStart = (nextDate: string, nextTime: string) => {
    if (fieldError?.field === 'time') setFieldError(null);
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

  /** 검증 오류는 토스트 대신 그 칸 아래에 적고 그 칸으로 포커스를 옮긴다(토스트가 쌓여 제목을 가리지 않게). */
  const fail = (field: 'title' | 'time' | 'memo', message: string) => {
    setFieldError({ field, message });
    const el = field === 'title' ? titleRef.current : field === 'time' ? startTimeRef.current : memoRef.current;
    el?.focus();
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (isSaving) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return fail('title', '제목을 입력해 주세요.');
    if (codePointLength(trimmedTitle) > SCHEDULE_TITLE_MAX) return fail('title', `제목은 ${SCHEDULE_TITLE_MAX}자까지 쓸 수 있어요.`);
    if (codePointLength(memo) > SCHEDULE_DESCRIPTION_MAX) return fail('memo', '설명은 5,000자까지 쓸 수 있어요.');
    // 빈 시간 칸을 00:00 으로 바꿔 저장하지 않는다.
    if (!date || !time || !endDate || !endTime) return fail('time', '날짜와 시간을 모두 입력해 주세요.');
    const start = toDateTime(date, time);
    const end = toDateTime(endDate, endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return fail('time', '날짜와 시간을 확인해 주세요.');
    }
    if (end < start) return fail('time', '종료 시각은 시작 시각보다 빠를 수 없어요.');
    setFieldError(null);

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
      toast.success(initialSchedule ? '일정을 고쳤어요.' : '일정을 만들었어요.');
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
  const memoLength = codePointLength(memo);
  const errorOf = (field: 'title' | 'time' | 'memo') =>
    fieldError?.field === field ? <p role="alert" className="mt-1.5 text-[13px] text-negative">{fieldError.message}</p> : null;

  const footer = (
    <>
      <button onClick={requestClose} disabled={isSaving} className="btn-secondary">취소</button>
      <button onClick={handleSave} disabled={isSaving} className="btn-primary">
        {isSaving && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
        {isSaving ? '저장 중…' : '저장'}
      </button>
    </>
  );

  return (
    <Modal
      open={isOpen}
      onClose={requestClose}
      closeOnEsc={false}
      title={initialSchedule ? '일정 수정' : '새 일정'}
      size="md"
      zIndex="z-[120]"
      footer={footer}
      bodyClassName="space-y-6"
    >
          {/* 제목 (주아). 아래 행들과 시작선을 맞추려고 아이콘 칸만큼 비운다 */}
          <div className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-3">
            <span aria-hidden />
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="appt-title" className="text-[13px] font-medium text-ink-2">일정 제목</label>
                {titleLength >= SCHEDULE_TITLE_MAX - 30 && <span className={`stamp ${titleLength >= SCHEDULE_TITLE_MAX ? 'text-negative' : ''}`}>{titleLength}/{SCHEDULE_TITLE_MAX}</span>}
              </div>
              <input
                ref={titleRef}
                id="appt-title"
                type="text"
                value={title}
                aria-invalid={fieldError?.field === 'title'}
                onChange={(e) => {
                  const v = e.target.value;
                  setCut((c) => ({ ...c, title: codePointLength(v) > SCHEDULE_TITLE_MAX }));
                  setTitle(truncateCodePoints(v, SCHEDULE_TITLE_MAX));
                  if (fieldError?.field === 'title') setFieldError(null);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); handleSave(); } }}
                placeholder="어떤 약속인가요"
                className={`form-input h-11 font-display text-lg ${fieldError?.field === 'title' ? 'border-negative' : ''}`}
              />
              {errorOf('title')}
              {cut.title && <p className="text-[13px] text-negative">제목은 {SCHEDULE_TITLE_MAX}자까지라 뒷부분은 넣지 않았어요.</p>}
            </div>
          </div>

          {/* 시간 */}
          <Row icon={Clock} label="시간">
            {/* 모바일은 입력 글자가 16px 라(확대 방지, globals.css) 라벨 칸·간격을 줄여 시간 칸을 128px 로 둔다.
                360px 보다 좁으면 날짜가 잘리므로 시간을 날짜 아래 줄로 내린다. 높이는 h-10 으로 고정(날짜·시간 칸 높이가 1px 달랐다). */}
            <div className="space-y-2">
              {([
                { label: '시작', d: date, t: time, onD: (v: string) => changeStart(v, time), onT: (v: string) => changeStart(date, v), min: undefined, ref: startTimeRef },
                { label: '종료', d: endDate, t: endTime, onD: (v: string) => { setEndDate(v); if (fieldError?.field === 'time') setFieldError(null); }, onT: (v: string) => { setEndTime(v); if (fieldError?.field === 'time') setFieldError(null); }, min: date, ref: undefined },
              ] as const).map((r) => (
                <div key={r.label} className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-x-1.5 gap-y-2 min-[360px]:grid-cols-[28px_minmax(0,1fr)_128px] md:grid-cols-[32px_minmax(0,1fr)_minmax(128px,40%)] md:gap-x-2">
                  <span className="text-[13px] text-ink-3">{r.label}</span>
                  <input type="date" aria-label={`${r.label} 날짜`} value={r.d} min={r.min} onChange={(e) => r.onD(e.target.value)} aria-invalid={fieldError?.field === 'time'} className="form-input h-10 px-2 tabular-nums md:px-3" />
                  <input ref={r.ref} type="time" aria-label={`${r.label} 시간`} value={r.t} onChange={(e) => r.onT(e.target.value)} aria-invalid={fieldError?.field === 'time'} className="form-input h-10 px-2 tabular-nums col-start-2 min-[360px]:col-start-auto md:px-3" />
                </div>
              ))}
              {errorOf('time')}
              {!initialSchedule && date && date < format(new Date(), 'yyyy-MM-dd') && !fieldError && (
                <p className="text-[13px] text-ink-3">지난 날짜예요. 이미 지난 일정으로 저장돼요.</p>
              )}
            </div>
          </Row>

          {/* 모임 */}
          <Row icon={Users} label="모임">
            <div className="relative">
              <select aria-label="모임" value={selectedGroupId} onChange={(e) => changeGroup(e.target.value)} className="form-input h-10 appearance-none truncate pr-9">
                <option value="">모임 없음 (개인 일정)</option>
                {userGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <ChevronDown size={16} strokeWidth={1.5} className="text-ink-3 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </Row>

          {/* 장소 + 지도 */}
          <Row icon={MapPin} label="장소">
            <div ref={locationBoxRef} className="relative">
              <input type="text" aria-label="장소" value={location} onChange={(e) => { const v = truncateCodePoints(e.target.value, SCHEDULE_LOCATION_MAX); setLocation(v); setCoords(null); setRecommendAt(null); searchPlaces(v); }} onBlur={(e) => { if (e.relatedTarget && !locationBoxRef.current?.contains(e.relatedTarget as Node)) clearSearchResults(); }} placeholder="장소를 검색해요" className="form-input h-10 pr-10" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3">{isSearching ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Search size={16} strokeWidth={1.5} />}</div>
              {searchResults.length > 0 && (
                <div className="absolute z-20 w-full top-full mt-1 bg-surface rounded-[10px] shadow-float border border-line overflow-hidden max-h-52 overflow-y-auto md:max-h-60">
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
              {/* 목록은 @ 를 쳐야 뜬다. 안내문도 그렇게 쓰고 모바일 폭(약 290px)에 들어가게 짧게 둔다 */}
              <input type="text" aria-label="참여자" value={participantInput} onFocus={() => setShowMemoMentions(false)} onChange={(e) => { setParticipantInput(e.target.value); handleInputChange(e.target.value, 'participant'); }} placeholder={selectedGroupId ? '@를 눌러 모임원을 골라요' : '@를 눌러 친구를 골라요'} className="form-input h-10" />
              {showParticipantMentions && (
                <MentionList
                  items={participantCandidates}
                  emptyText={participantEmptyText}
                  onClose={() => setShowParticipantMentions(false)}
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
                    icon={p.id && p.id === currentUserId ? <User size={12} strokeWidth={1.5} /> : undefined}
                    onRemove={p.id && p.id === currentUserId ? undefined : () => setParticipants(participants.filter(item => item !== p))}
                  />
                ))}
              </div>
            )}
          </Row>

          {/* 연결할 메모 */}
          <Row icon={FileText} label="연결할 메모">
            <div className="relative">
              <input type="text" aria-label="연결할 메모" value={memoMentionInput} onFocus={() => setShowParticipantMentions(false)} onChange={(e) => { setMemoMentionInput(e.target.value); handleInputChange(e.target.value, 'memo'); }} placeholder={selectedGroupId ? '@를 눌러 내 메모·모임 메모를 골라요' : '@를 눌러 메모를 골라요'} className="form-input h-10" />
              {showMemoMentions && (
                <MentionList
                  items={memoCandidates}
                  emptyText={mentionableMemos.length === 0 ? '연결할 메모가 없어요' : '찾는 결과가 없어요'}
                  onClose={() => setShowMemoMentions(false)}
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
            <textarea
              ref={memoRef}
              aria-label="설명"
              value={memo}
              aria-invalid={fieldError?.field === 'memo'}
              onChange={(e) => {
                const v = e.target.value;
                setCut((c) => ({ ...c, memo: codePointLength(v) > SCHEDULE_DESCRIPTION_MAX }));
                setMemo(truncateCodePoints(v, SCHEDULE_DESCRIPTION_MAX));
                if (fieldError?.field === 'memo') setFieldError(null);
              }}
              placeholder="일정에 대한 설명을 남겨요"
              className="form-input min-h-[120px] resize-none leading-relaxed"
            />
            {(memoLength >= SCHEDULE_DESCRIPTION_MAX - 500 || cut.memo) && (
              <div className="mt-1.5 flex items-start justify-between gap-2 text-[13px]">
                <span className="text-negative">{cut.memo ? `설명은 ${SCHEDULE_DESCRIPTION_MAX.toLocaleString()}자까지라 뒷부분은 넣지 않았어요.` : ''}</span>
                <span className={`stamp shrink-0 ${memoLength >= SCHEDULE_DESCRIPTION_MAX ? 'text-negative' : ''}`}>{memoLength.toLocaleString()}/{SCHEDULE_DESCRIPTION_MAX.toLocaleString()}</span>
              </div>
            )}
            {errorOf('memo')}
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
    <button type="button" onClick={onClick} className="w-40 shrink-0 cursor-pointer overflow-hidden rounded-[10px] border border-line bg-surface text-left transition-colors hover:bg-raised focus-visible:border-accent focus-visible:outline-none">
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
    </button>
  );
}