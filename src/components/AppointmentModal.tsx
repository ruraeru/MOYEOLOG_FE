'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { scheduleApi, type ScheduleResponse } from '@/lib/schedule-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { memoApi, type MemoResponse } from '@/lib/memo-api';
import { friendApi, type FriendResponse } from '@/lib/friend-api';
import { format, parseISO } from 'date-fns';
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

export default function AppointmentModal({ isOpen, onClose, initialDate, onSuccess, initialSchedule }: AppointmentModalProps) {
  const { data: session } = useSession();
  const mapContainer = useRef<HTMLDivElement>(null);

  // ─── States ──────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate || format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState('12:00');
  const [location, setLocation] = useState('');
  const [memo, setMemo] = useState(''); 
  const [isSaving, setIsSaving] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [userGroups, setUserGroups] = useState<GroupResponse[]>([]);
  const [allMemos, setAllMemos] = useState<MemoResponse[]>([]);
  const [friends, setFriends] = useState<FriendResponse[]>([]);

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

  // ─── Data Synchronization ─────────────────────────────────────────
  useEffect(() => {
    if (isOpen && session) {
      Promise.all([
        groupApi.getAll(session),
        memoApi.getAll(session),
        friendApi.getFriends(session)
      ]).then(([groups, memos, friendData]) => {
        setUserGroups(groups);
        setAllMemos(memos);
        setFriends(friendData);
      }).catch(console.error);
    }
  }, [isOpen, session]);

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
    if (!title.trim()) return alert('제목을 입력해주세요.');
    setIsSaving(true);
    try {
      const start = new Date(`${date}T${time || '00:00'}`);
      const payload = {
        title, description: memo, startTime: start.toISOString(),
        endTime: new Date(start.getTime() + 3600000).toISOString(),
        location, groupId: selectedGroupId || undefined,
        taggedMemoIds: taggedMemos.map(m => m.id),
        participantIds: participants.filter(p => p.id).map(p => p.id!),
      };
      if (initialSchedule) await scheduleApi.update(initialSchedule.id, payload, session);
      else await scheduleApi.create(payload, session);
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      alert('일정 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-hidden" onClick={onClose}>
      <div className="bg-white rounded-[2rem] w-full max-w-xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Calendar className="w-5 h-5" /></div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">{initialSchedule ? '일정 수정하기' : '일정 만들기'}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><X className="w-6 h-6" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-10">
          <Section label="일정 제목">
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="어떤 약속인가요?" className="form-input text-base" />
          </Section>

          <div className="grid grid-cols-2 gap-4">
            <Section label="날짜" icon={<Calendar className="w-3.5 h-3.5" />}>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="form-input" />
            </Section>
            <Section label="시간" icon={<Clock className="w-3.5 h-3.5" />}>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="form-input" />
            </Section>
          </div>

          <Section label="모임 선택" icon={<Users className="w-3.5 h-3.5" />}>
            <div className="relative">
              <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className="form-input appearance-none">
                <option value="">모임을 선택하세요 (개인 일정)</option>
                {userGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <ChevronRight className="w-4 h-4 text-gray-400 absolute right-6 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
            </div>
          </Section>

          {/* Location Picker */}
          <Section label="장소 지정" icon={<MapPin className="w-3.5 h-3.5 text-rose-500" />}>
            <div className="relative">
              <input type="text" value={location} onChange={(e) => { setLocation(e.target.value); searchPlaces(e.target.value); }} placeholder="장소를 검색해보세요" className="form-input pr-14" />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">{isSearching ? <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" /> : <Search className="w-5 h-5 text-gray-400" />}</div>
              {searchResults.length > 0 && (
                <div className="absolute z-20 w-full top-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-h-60 overflow-y-auto">
                  {searchResults.map((r, i) => (
                    <button key={i} type="button" onClick={() => handleLocationSelect(r)} className="w-full text-left px-5 py-3.5 hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0 font-bold text-sm text-gray-800">
                      {r.place_name}<div className="text-[10px] text-gray-400 font-medium mt-0.5">{r.address_name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-3xl overflow-hidden border-2 border-gray-100 shadow-inner bg-gray-50 relative mt-4">
              <div ref={mapContainer} className="w-full h-[220px]" />
              {isMapLoading && <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center z-10"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-2" /><p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">위치 확인 중...</p></div>}
            </div>
          </Section>

          {/* Recommendations */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1"><Star className="w-3 h-3 text-amber-400 fill-amber-400" /> 주변 핫플레이스 추천</h4>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-2 px-2">
              {isRecommending ? <div className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 w-full text-center"><Loader2 className="w-4 h-4 animate-spin text-indigo-500 mx-auto" /></div> : recommendations.map((rec, idx) => (
                <RecommendationCard key={`${rec.id}-${idx}`} rec={rec} onClick={() => handleLocationSelect(rec)} />
              ))}
            </div>
          </div>

          {/* Participants */}
          <Section label="참여자" icon={<Users className="w-3.5 h-3.5 text-blue-500" />}>
            <div className="relative">
              <input type="text" value={participantInput} onChange={(e) => { setParticipantInput(e.target.value); handleInputChange(e.target.value, 'participant'); }} placeholder="친구 이름을 입력하거나 @를 눌러보세요" className="form-input" />
              {showParticipantMentions && (
                <MentionList items={filteredParticipants} onSelect={(m) => { setParticipants([...participants, { id: m.id, nickname: m.nickname || '', profileImage: m.profileImage }]); setShowParticipantMentions(false); setParticipantInput(''); }} />
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {participants.map((p, i) => <Chip key={i} label={p.nickname} image={p.profileImage} onRemove={p.nickname !== '나' ? () => setParticipants(participants.filter(item => item !== p)) : undefined} />)}
            </div>
          </Section>

          {/* Memos */}
          <Section label="관련 메모 언급 (@멘션)" icon={<FileText className="w-3.5 h-3.5" />}>
            <div className="relative">
              <input type="text" value={memoMentionInput} onChange={(e) => { setMemoMentionInput(e.target.value); handleInputChange(e.target.value, 'memo'); }} placeholder="메모 제목을 입력하거나 @를 눌러보세요" className="form-input" />
              {showMemoMentions && <MentionList items={filteredMemos} onSelect={(m) => { setTaggedMemos([...taggedMemos, allMemos.find(memo => memo.id === m.id)!]); setShowMemoMentions(false); setMemoMentionInput(''); }} isMemo />}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {taggedMemos.map(m => <Chip key={m.id} label={m.title} icon={<FileText className="w-3 h-3" />} onRemove={() => setTaggedMemos(taggedMemos.filter(item => item.id !== m.id))} />)}
            </div>
          </Section>

          <Section label="상세 메모" icon={<FileText className="w-3.5 h-3.5" />}>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="일정에 대한 추가 메모를 남겨보세요" className="form-input min-h-[120px] resize-none leading-relaxed" />
          </Section>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-gray-100 bg-gray-50/30 flex gap-3 shrink-0">
          <button onClick={onClose} disabled={isSaving} className="flex-1 btn-secondary">취소</button>
          <button onClick={handleSave} disabled={isSaving} className="flex-[2] btn-primary">{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-5 h-5" />}{isSaving ? '저장 중…' : '일정 저장하기'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub Components ─────────────────────────────────────────────

function Section({ label, icon, children }: { label: string, icon?: React.ReactNode, children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-1">{icon} {label}</label>
      {children}
    </div>
  );
}

function RecommendationCard({ rec, onClick }: { rec: { id: string | number, name: string, image: string, rating: string, category: string, distance: string, y: string, x: string, desc: string }, onClick: () => void }) {
  const [imgSrc, setImgSrc] = useState(rec.image);
  
  return (
    <div onClick={onClick} className="flex-shrink-0 w-44 bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-indigo-200 hover:shadow-lg transition-all cursor-pointer group">
      <div className="relative h-24 w-full bg-gray-100">
        <ImageWithFallback 
          src={imgSrc} 
          alt={rec.name} 
          fill 
          className="object-cover group-hover:scale-110 transition-transform duration-500" 
          unoptimized 
          onError={() => setImgSrc('https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200&h=140&fit=crop')}
        />
        <div className="absolute top-1.5 right-1.5 z-10 bg-white/90 text-gray-800 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5"><Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" /> {rec.rating}</div>
      </div>
      <div className="p-2.5"><h4 className="font-black text-gray-800 text-xs truncate">{rec.name}</h4><p className="text-[10px] text-gray-400">{rec.category} · {rec.distance}</p></div>
    </div>
  );
}