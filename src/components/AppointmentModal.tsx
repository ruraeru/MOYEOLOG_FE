'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { scheduleApi } from '@/lib/schedule-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { memoApi, type MemoResponse } from '@/lib/memo-api';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Star,
  Users,
  Tag,
  FileText,
  Plus,
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
}

interface Recommendation {
  id: string | number;
  name: string;
  category: string;
  distance: string;
  rating: string;
  desc: string;
  image: string;
  tags: string[];
}

interface KakaoPlace {
  place_name: string;
  address_name: string;
  road_address_name?: string;
  category_name: string;
  category_group_name?: string;
  id: string;
  distance?: string;
  y: string;
  x: string;
}

export default function AppointmentModal({ isOpen, onClose, initialDate, onSuccess }: AppointmentModalProps) {
  const { data: session } = useSession();

  // Form states
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate || '2026-04-11');
  const [time, setTime] = useState('12:00');
  const [location, setLocation] = useState('');
  const [memo, setMemo] = useState(''); 
  const [participants, setParticipants] = useState(['나']);
  const [participantInput, setParticipantInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [userGroups, setUserGroups] = useState<GroupResponse[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Memo Mentions states
  const [allMemos, setAllMemos] = useState<MemoResponse[]>([]);
  const [taggedMemos, setTaggedMemos] = useState<MemoResponse[]>([]);
  const [memoMentionInput, setMemoMentionInput] = useState('');
  const [showMemoMentions, setShowMemoMentions] = useState(false);
  const [memoQuery, setMemoQuery] = useState('');

  // Map & Search States
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<KakaoPlace[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isRecommending, setIsRecommending] = useState(false);
  const mapContainer = useRef<HTMLDivElement>(null);

  // ─── 데이터 로드 (그룹 & 메모) ──────────────────────────────────
  useEffect(() => {
    if (isOpen && session) {
      groupApi.getAll(session).then(setUserGroups).catch(console.error);
      memoApi.getAll(session).then(setAllMemos).catch(console.error);
    }
  }, [isOpen, session]);

  // ─── 날짜 동기화 ──────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && initialDate) {
      setDate(initialDate);
    }
  }, [isOpen, initialDate]);

  // ─── 지도 초기화 (현위치 기반) ──────────────────────────────────
  useEffect(() => {
    if (!isOpen || !mapContainer.current) return;

    const setupMap = (lat: number, lng: number) => {
      const kakao = (window as any).kakao;
      if (!kakao || !kakao.maps) return;

      kakao.maps.load(() => {
        const container = document.getElementById('modal-location-map');
        if (!container) return;

        const options = {
          center: new kakao.maps.LatLng(lat, lng),
          level: 3
        };
        const newMap = new kakao.maps.Map(container, options);
        const newMarker = new kakao.maps.Marker({
          position: newMap.getCenter()
        });
        newMarker.setMap(newMap);
        setMap(newMap);
        setMarker(newMarker);
        fetchRecommendations(lat, lng);
        setTimeout(() => newMap.relayout(), 300);
      });
    };

    const initMap = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setupMap(pos.coords.latitude, pos.coords.longitude),
          () => setupMap(37.5665, 126.9780) // fallback: 서울시청
        );
      } else {
        setupMap(37.5665, 126.9780);
      }
    };

    if (!(window as any).kakao || !(window as any).kakao.maps) {
      setTimeout(initMap, 500);
    } else {
      initMap();
    }

    return () => {
      setMap(null);
      setMarker(null);
    };
  }, [isOpen]);

  // ─── 장소 검색 로직 ───────────────────────────────────────────
  const searchPlaces = (keyword: string) => {
    if (!keyword.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const kakao = (window as any).kakao;
    if (!kakao || !kakao.maps || !kakao.maps.services) return;

    setIsSearching(true);
    const ps = new kakao.maps.services.Places();
    ps.keywordSearch(keyword, (data: KakaoPlace[], status: string) => {
      if (status === kakao.maps.services.Status.OK) {
        setSearchResults(data);
        setShowResults(true);
      } else {
        setSearchResults([]);
      }
      setIsSearching(false);
    });
  };

  const handleLocationSelect = (place: KakaoPlace) => {
    setLocation(place.place_name);
    setShowResults(false);
    if (map && marker) {
      const kakao = (window as any).kakao;
      const coords = new kakao.maps.LatLng(parseFloat(place.y), parseFloat(place.x));
      map.setCenter(coords);
      marker.setPosition(coords);
      fetchRecommendations(parseFloat(place.y), parseFloat(place.x));
    }
  };

  // ─── 주변 장소 추천 ──────────────────────────────────────────────
  const fetchRecommendations = (lat: number, lng: number) => {
    const kakao = (window as any).kakao;
    if (!kakao || !kakao.maps || !kakao.maps.services) return;

    setIsRecommending(true);
    const ps = new kakao.maps.services.Places();

    ps.categorySearch('CE7', async (data: any, status: any) => {
      if (status === kakao.maps.services.Status.OK) {
        const results = await Promise.all(
          data.slice(0, 5).map(async (place: any) => {
            let imageUrl = 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200&h=140&fit=crop';
            try {
              const res = await fetch(`/api/search-image?query=${encodeURIComponent(place.place_name)}`);
              const json = await res.json();
              if (json.imageUrl) imageUrl = json.imageUrl;
            } catch {}
            return {
              id: place.id,
              name: place.place_name,
              category: place.category_group_name || '카페',
              rating: (4.0 + Math.random() * 0.9).toFixed(1),
              distance: `${place.distance}m`,
              desc: place.address_name,
              image: imageUrl,
            } as Recommendation;
          })
        );
        setRecommendations(results);
      } else {
        setRecommendations([]);
      }
      setIsRecommending(false);
    }, {
      location: new kakao.maps.LatLng(lat, lng),
      radius: 1000,
    });
  };

  // ─── 메모 멘션 로직 ───────────────────────────────────────────
  const handleMemoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMemoMentionInput(value);

    const lastChar = value.slice(-1);
    if (lastChar === '@') {
      setShowMemoMentions(true);
      setMemoQuery('');
    } else if (showMemoMentions) {
      const parts = value.split('@');
      setMemoQuery(parts[parts.length - 1]);
    }
  };

  const insertMemoMention = (m: MemoResponse) => {
    if (!taggedMemos.find((item) => item.id === m.id)) {
      setTaggedMemos([...taggedMemos, m]);
    }
    setMemoMentionInput(memoMentionInput.split('@')[0]);
    setShowMemoMentions(false);
  };

  const filteredMemos = allMemos.filter((m) =>
    m.title.toLowerCase().includes(memoQuery.toLowerCase())
  );

  // ─── 저장 ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }
    setIsSaving(true);
    try {
      const start = new Date(`${date}T${time || '00:00'}`);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      await scheduleApi.create(
        {
          title,
          description: memo,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          location,
          groupId: selectedGroupId || undefined,
          taggedMemoIds: taggedMemos.map((m) => m.id),
        },
        session
      );
      // 폼 초기화
      setTitle(''); setMemo(''); setLocation('');
      setSelectedGroupId(''); setTags([]); setParticipants(['나']);
      setTaggedMemos([]); setMemoMentionInput('');
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Failed to save schedule:', err);
      alert('일정 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddParticipant = () => {
    if (participantInput && !participants.includes(participantInput)) {
      setParticipants([...participants, participantInput]);
      setParticipantInput('');
    }
  };

  const handleAddTag = () => {
    if (tagInput && !tags.includes(tagInput)) {
      setTags([...tags, `#${tagInput.replace(/^#/, '')}`]);
      setTagInput('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-hidden" onClick={onClose}>
      <div className="bg-white rounded-[2rem] w-full max-w-xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Calendar className="w-5 h-5" /></div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">일정 만들기</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><X className="w-6 h-6" /></button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-10">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">일정 제목</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="어떤 약속인가요?" className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-base focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-indigo-500" /> 날짜</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-indigo-500" /> 시간</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2"><Users className="w-3.5 h-3.5 text-indigo-500" /> 모임 선택</label>
            <div className="relative">
              <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none appearance-none font-bold">
                <option value="">모임을 선택하세요 (개인 일정)</option>
                {userGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
              <ChevronRight className="w-4 h-4 text-gray-400 absolute right-6 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
            </div>
          </div>

          {/* 장소 & 지도 */}
          <div className="space-y-4 relative">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-rose-500" /> 장소 지정</label>
            <div className="relative">
              <input type="text" value={location} onChange={(e) => { setLocation(e.target.value); searchPlaces(e.target.value); }} placeholder="장소를 검색해보세요" className="w-full bg-gray-50 border-2 border-transparent rounded-2xl pl-6 pr-14 py-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold shadow-sm" />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">{isSearching ? <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" /> : <Search className="w-5 h-5 text-gray-400" />}</div>
            </div>

            {showResults && searchResults.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-h-60 overflow-y-auto">
                {searchResults.map((result, idx) => (
                  <button key={idx} onClick={() => handleLocationSelect(result)} className="w-full text-left px-5 py-3.5 hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0 font-bold text-sm text-gray-800">{result.place_name}<div className="text-[10px] text-gray-400 font-medium mt-0.5">{result.address_name}</div></button>
                ))}
              </div>
            )}

            <div className="rounded-3xl overflow-hidden border-2 border-gray-100 shadow-inner bg-gray-50"><div id="modal-location-map" className="h-[220px] w-full" /></div>

            {/* Recommendations */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2"><Star className="w-3 h-3 text-amber-400 fill-amber-400" /> 주변 핫플레이스 추천</h4>
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-2 px-2">
                {isRecommending ? <div className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 w-full text-center"><Loader2 className="w-4 h-4 animate-spin text-indigo-500 mx-auto" /></div> : recommendations.map(rec => (
                  <div key={rec.id} onClick={() => handleLocationSelect({ place_name: rec.name, y: (rec as any).y, x: (rec as any).x } as any)} className="flex-shrink-0 w-44 bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-indigo-200 hover:shadow-lg transition-all cursor-pointer group">
                    <div className="relative h-24 w-full overflow-hidden">
                      <Image src={rec.image} alt={rec.name} fill sizes="176px" className="object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute top-1.5 right-1.5 bg-white/90 text-gray-800 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5"><Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" /> {rec.rating}</div>
                    </div>
                    <div className="p-2.5"><h4 className="font-black text-gray-800 text-xs truncate">{rec.name}</h4><p className="text-[10px] text-gray-400">{rec.category} · {rec.distance}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 참여자 */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-1"><Users className="w-3.5 h-3.5 text-blue-500" /> 참여자</label>
            <div className="flex gap-2">
              <input type="text" value={participantInput} onChange={(e) => setParticipantInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddParticipant()} placeholder="참여자 이름 입력" className="flex-1 bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold" />
              <button onClick={handleAddParticipant} className="bg-indigo-600 text-white px-4 py-3 rounded-2xl text-sm font-black hover:bg-indigo-700"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-wrap gap-2">
              {participants.map((p) => (
                <div key={p} className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-indigo-100">{p}{p !== '나' && <button onClick={() => setParticipants(participants.filter((item) => item !== p))}><X className="w-3 h-3" /></button>}</div>
              ))}
            </div>
          </div>

          {/* 메모 언급 (@멘션) */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-indigo-500" /> 관련 메모 언급 (@멘션)
            </label>
            <div className="relative">
              <input
                type="text"
                value={memoMentionInput}
                onChange={handleMemoInputChange}
                placeholder="메모 제목을 입력하거나 @를 눌러보세요"
                className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold"
              />
              {showMemoMentions && (
                <div className="absolute z-30 bottom-full mb-2 w-full bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden py-2 max-h-48 overflow-y-auto">
                  {filteredMemos.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => insertMemoMention(m)}
                      className="w-full text-left px-5 py-3 hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0 font-bold text-sm text-gray-800"
                    >
                      {m.title}
                    </button>
                  ))}
                  {filteredMemos.length === 0 && (
                    <div className="p-4 text-center text-xs text-gray-400">검색 결과가 없습니다.</div>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {taggedMemos.map((m) => (
                <div key={m.id} className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-indigo-100">
                  <FileText className="w-3 h-3" />
                  {m.title}
                  <button onClick={() => setTaggedMemos(taggedMemos.filter((item) => item.id !== m.id))}>
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 태그 */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-1"><Tag className="w-3.5 h-3.5 text-gray-400" /> 태그</label>
            <div className="flex gap-2">
              <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddTag()} placeholder="태그 입력 후 Enter" className="flex-1 bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold" />
              <button onClick={handleAddTag} className="bg-indigo-600 text-white px-4 py-3 rounded-2xl text-sm font-black hover:bg-indigo-700"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => <span key={tag} className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-3 py-1.5 rounded-full border border-indigo-100 flex items-center gap-1.5 cursor-pointer" onClick={() => setTags(tags.filter((t) => t !== tag))}>{tag} <X className="w-3 h-3" /></span>)}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-gray-400" /> 상세 메모</label>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="일정에 대한 추가 메모를 남겨보세요" className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-5 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none min-h-[120px] resize-none font-medium leading-relaxed" />
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-gray-100 bg-gray-50/30 flex gap-3 shrink-0">
          <button onClick={onClose} disabled={isSaving} className="flex-1 px-4 py-4 bg-white border-2 border-gray-100 text-gray-500 rounded-2xl text-sm font-black hover:bg-gray-50 transition-all active:scale-95">취소</button>
          <button onClick={handleSave} disabled={isSaving} className="flex-[2] px-4 py-4 bg-indigo-600 text-white rounded-2xl text-base font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all disabled:opacity-70 flex items-center justify-center gap-2 active:scale-95">{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-5 h-5" />}{isSaving ? '저장 중…' : '일정 저장하기'}</button>
        </div>
      </div>
    </div>
  );
}
