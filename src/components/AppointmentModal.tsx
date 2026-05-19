'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { scheduleApi } from '@/lib/schedule-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
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
  const [date, setDate] = useState(initialDate || '');
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

  // Map & search states
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [map, setMap] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [marker, setMarker] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<KakaoPlace[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Recommendation states
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isRecommending, setIsRecommending] = useState(false);

  // ─── 초기 날짜 동기화 ───────────────────────────────────────────
  useEffect(() => {
    if (isOpen && initialDate) {
      setDate(initialDate);
    }
  }, [isOpen, initialDate]);

  // ─── 유저 그룹 목록 ─────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && session) {
      groupApi.getAll(session).then(setUserGroups).catch(console.error);
    }
  }, [isOpen, session]);

  // ─── 카카오맵 초기화 (id 방식으로 타이밍 문제 해결) ────────────
  useEffect(() => {
    if (!isOpen) return;

    // 이미 지도가 있으면 재초기화 불필요
    if (map) return;

    const initMap = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const kakao = (window as any).kakao;
      if (!kakao || !kakao.maps) return;

      kakao.maps.load(() => {
        // ref 대신 getElementById → 비동기 콜백 시점 DOM 보장
        const container = document.getElementById('appointment-map');
        if (!container) return;

        const setupMap = (lat: number, lng: number) => {
          const center = new kakao.maps.LatLng(lat, lng);
          const options = { center, level: 3 };
          const newMap = new kakao.maps.Map(container, options);
          const newMarker = new kakao.maps.Marker({ position: center });
          newMarker.setMap(newMap);
          setMap(newMap);
          setMarker(newMarker);
          fetchRecommendations(lat, lng);
        };

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => setupMap(pos.coords.latitude, pos.coords.longitude),
            () => setupMap(37.5665, 126.9780) // fallback: 서울시청
          );
        } else {
          setupMap(37.5665, 126.9780);
        }
      });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(window as any).kakao || !(window as any).kakao.maps) {
      // SDK 아직 로드 안 된 경우 잠시 대기
      const timer = setTimeout(initMap, 500);
      return () => clearTimeout(timer);
    } else {
      initMap();
    }
    // map을 의존성에 넣으면 무한루프 → 의도적으로 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ─── 모달 닫힐 때 지도 인스턴스 초기화 ─────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setMap(null);
      setMarker(null);
      setRecommendations([]);
      setSearchResults([]);
      setShowResults(false);
    }
  }, [isOpen]);

  // ─── 장소 검색 (디바운스) ────────────────────────────────────────
  useEffect(() => {
    if (!location.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    // 이미 선택된 장소면 재검색 스킵
    if (searchResults.some((r) => r.place_name === location)) return;

    const timer = setTimeout(() => searchPlaces(location), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const searchPlaces = (keyword: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        setShowResults(false);
      }
      setIsSearching(false);
    });
  };

  const handleLocationSelect = (place: KakaoPlace) => {
    setLocation(place.place_name);
    setShowResults(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kakao = (window as any).kakao;
    if (map && marker && kakao) {
      const coords = new kakao.maps.LatLng(parseFloat(place.y), parseFloat(place.x));
      map.setCenter(coords);
      marker.setPosition(coords);
      marker.setMap(map);
      fetchRecommendations(parseFloat(place.y), parseFloat(place.x));
    }
  };

  // ─── 주변 장소 추천 ──────────────────────────────────────────────
  const fetchRecommendations = (lat: number, lng: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kakao = (window as any).kakao;
    if (!kakao || !kakao.maps || !kakao.maps.services) return;

    setIsRecommending(true);
    const ps = new kakao.maps.services.Places();

    ps.categorySearch(
      'CE7', // 카페
      async (data: KakaoPlace[], status: string) => {
        if (status === kakao.maps.services.Status.OK) {
          const results = await Promise.all(
            data.slice(0, 5).map(async (place) => {
              let imageUrl =
                'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200&h=140&fit=crop';
              try {
                const res = await fetch(
                  `/api/search-image?query=${encodeURIComponent(place.place_name)}`
                );
                const json = await res.json();
                if (json.imageUrl) imageUrl = json.imageUrl;
              } catch {
                // 이미지 API 실패 시 기본 이미지 사용
              }
              return {
                id: place.id,
                name: place.place_name,
                category: place.category_group_name || '카페',
                rating: (4.0 + Math.random() * 0.9).toFixed(1),
                distance: `${place.distance ?? ''}m`,
                desc: place.address_name,
                tags: ['#실시간_추천', '#모임_최적'],
                image: imageUrl,
              } as Recommendation;
            })
          );
          setRecommendations(results);
        } else {
          setRecommendations([]);
        }
        setIsRecommending(false);
      },
      {
        location: new kakao.maps.LatLng(lat, lng),
        radius: 1000,
      }
    );
  };

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
        },
        session
      );
      // 폼 초기화
      setTitle(''); setMemo(''); setLocation('');
      setSelectedGroupId(''); setTags([]); setParticipants(['나']);
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[2rem] w-full max-w-xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <Calendar className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">일정 만들기</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8" style={{ scrollbarWidth: 'none' }}>

          {/* 제목 */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">일정 제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="어떤 약속인가요?"
              className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-base focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold"
            />
          </div>

          {/* 날짜 & 시간 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" /> 날짜
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-4 py-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-500" /> 시간
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-4 py-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold"
              />
            </div>
          </div>

          {/* 모임 선택 */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-indigo-500" /> 모임 선택
            </label>
            <div className="relative">
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none appearance-none font-bold"
              >
                <option value="">모임을 선택하세요 (개인 일정)</option>
                {userGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
              <ChevronRight className="w-4 h-4 text-gray-400 absolute right-5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
            </div>
          </div>

          {/* 장소 */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-rose-500" /> 장소 지정
            </label>

            {/* 검색창 */}
            <div className="relative">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="장소를 검색해보세요"
                className="w-full bg-gray-50 border-2 border-transparent rounded-2xl pl-6 pr-14 py-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center">
                {isSearching
                  ? <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                  : <Search className="w-5 h-5 text-gray-400" />}
              </div>

              {/* 검색 결과 드롭다운 */}
              {showResults && searchResults.length > 0 && (
                <div className="absolute z-30 top-full mt-2 w-full bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-h-60 overflow-y-auto">
                  {searchResults.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleLocationSelect(result)}
                      className="w-full text-left px-5 py-3 hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0"
                    >
                      <div className="font-bold text-sm text-gray-800">{result.place_name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{result.address_name || result.road_address_name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 카카오맵 — id 방식으로 참조 (ref 타이밍 문제 방지) */}
            <div
              id="appointment-map"
              className="w-full h-52 rounded-3xl overflow-hidden border-2 border-gray-100 bg-gray-100"
            />

            {/* 주변 장소 추천 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Star className="w-3.5 h-3.5 text-indigo-500 fill-indigo-500" />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">맞춤 장소 추천</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                {isRecommending ? (
                  <div className="w-full flex items-center justify-center py-8 bg-gray-50 rounded-2xl">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                      <span className="text-xs text-gray-400">주변 장소를 찾는 중…</span>
                    </div>
                  </div>
                ) : recommendations.length > 0 ? (
                  recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      onClick={() => {
                        setLocation(rec.name);
                        searchPlaces(rec.name);
                      }}
                      className="flex-shrink-0 w-44 bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-indigo-200 hover:shadow-lg transition-all cursor-pointer group"
                    >
                      <div className="relative h-24 w-full overflow-hidden">
                        <Image src={rec.image} alt={rec.name} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute top-1.5 right-1.5 bg-white/90 text-gray-800 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" /> {rec.rating}
                        </div>
                      </div>
                      <div className="p-2.5">
                        <h4 className="font-black text-gray-800 text-xs truncate">{rec.name}</h4>
                        <p className="text-[10px] text-gray-400">{rec.category} · {rec.distance}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="w-full flex items-center justify-center py-6 bg-gray-50 rounded-2xl">
                    <span className="text-xs text-gray-400">주변에 추천할 장소가 없습니다.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 참여자 */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-blue-500" /> 참여자
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={participantInput}
                onChange={(e) => setParticipantInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddParticipant()}
                placeholder="참여자 이름 입력"
                className="flex-1 bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold"
              />
              <button
                onClick={handleAddParticipant}
                className="bg-indigo-600 text-white px-4 py-3 rounded-2xl text-sm font-black hover:bg-indigo-700 transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {participants.map((p) => (
                <div key={p} className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-indigo-100">
                  {p}
                  {p !== '나' && (
                    <button onClick={() => setParticipants(participants.filter((item) => item !== p))}>
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 태그 */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-gray-400" /> 태그
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="태그 입력 후 Enter"
                className="flex-1 bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold"
              />
              <button
                onClick={handleAddTag}
                className="bg-indigo-600 text-white px-4 py-3 rounded-2xl text-sm font-black hover:bg-indigo-700 transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-3 py-1.5 rounded-full border border-indigo-100 flex items-center gap-1.5 cursor-pointer"
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                >
                  {tag} <X className="w-3 h-3" />
                </span>
              ))}
            </div>
          </div>

          {/* 메모 */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-gray-400" /> 상세 메모
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="일정에 대한 추가 메모를 남겨보세요"
              className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-5 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none min-h-[120px] resize-none font-medium leading-relaxed"
            />
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="p-6 border-t border-gray-100 bg-gray-50/30 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 px-4 py-4 bg-white border-2 border-gray-100 text-gray-500 rounded-2xl text-sm font-black hover:bg-gray-50 transition-all active:scale-95"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-[2] px-4 py-4 bg-indigo-600 text-white rounded-2xl text-base font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all disabled:opacity-70 flex items-center justify-center gap-2 active:scale-95"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            {isSaving ? '저장 중…' : '일정 저장하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
