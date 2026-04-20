'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
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
  Loader2
} from 'lucide-react';

interface KakaoMap {
  setCenter: (coords: unknown) => void;
  getCenter: () => unknown;
}

interface KakaoMarker {
  setMap: (map: unknown) => void;
  setPosition: (coords: unknown) => void;
}

declare global {
  interface Window {
    kakao: {
      maps: {
        load: (callback: () => void) => void;
        LatLng: new (lat: number | string, lng: number | string) => unknown;
        Map: new (container: HTMLElement, options: unknown) => KakaoMap;
        Marker: new (options: unknown) => KakaoMarker;
        services: {
          Status: {
            OK: string;
            ZERO_RESULT: string;
            ERROR: string;
          };
          Places: new () => {
            categorySearch: (
              categoryCode: string,
              callback: (data: SearchResult[], status: string) => void,
              options?: {
                location?: unknown;
                radius?: number;
              }
            ) => void;
            keywordSearch: (
              keyword: string,
              callback: (data: SearchResult[], status: string) => void
            ) => void;
          };
        };
      };
    };
  }
}

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
}

interface Recommendation {
  id: string | number;
  name: string;
  category: string;
  rating: string;
  distance: string;
  desc: string;
  tags: string[];
  image: string;
}

interface SearchResult {
  place_name: string;
  address_name: string;
  road_address_name?: string;
  x: string;
  y: string;
  id: string;
  category_group_name?: string;
  distance?: string;
}

export default function AppointmentModal({ isOpen, onClose, initialDate }: AppointmentModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate || '2026-04-11');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [memo, setMemo] = useState(''); // This will be used for Additional Notes
  const [participants, setParticipants] = useState(['나']);
  const [participantInput, setParticipantInput] = useState('');
  const [taggedMemos, setTaggedMemos] = useState<string[]>([]);
  const [memoTagInput, setMemoTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Mentions States
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [activeMentionField, setActiveMentionField] = useState<'participants' | 'memos' | null>(null);

  // Mock Data for Mentions
  const mockFriends = ['지민', '민수', '현우', '예진', '동휘', '서연', '도윤'];
  const mockMemos = ['다음 주 모임 계획', '회의록', '주말 계획', '식단 기록', '독서 리스트', '프로젝트 아이디어', '여행 체크리스트'];

  const handleMentionInput = (value: string, field: 'participants' | 'memos') => {
    if (field === 'participants') setParticipantInput(value);
    else setMemoTagInput(value);

    if (value.includes('@')) {
      const parts = value.split('@');
      const query = parts[parts.length - 1];
      setMentionQuery(query);
      setShowMentions(true);
      setActiveMentionField(field);
    } else {
      setShowMentions(false);
      setActiveMentionField(null);
    }
  };

  const handleMentionSelect = (item: string) => {
    if (activeMentionField === 'participants') {
      if (!participants.includes(item)) {
        setParticipants([...participants, item]);
      }
      setParticipantInput('');
    } else if (activeMentionField === 'memos') {
      if (!taggedMemos.includes(item)) {
        setTaggedMemos([...taggedMemos, item]);
      }
      setMemoTagInput('');
    }
    setShowMentions(false);
    setActiveMentionField(null);
  };

  const filteredItems = activeMentionField === 'participants'
    ? mockFriends.filter(f => f.toLowerCase().includes(mentionQuery.toLowerCase()))
    : mockMemos.filter(m => m.toLowerCase().includes(mentionQuery.toLowerCase()));

  // Kakao Map States
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [map, setMap] = useState<KakaoMap | null>(null);
  const [marker, setMarker] = useState<KakaoMarker | null>(null);

  // Debounced search logic
  useEffect(() => {
    if (!location.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    // 선택된 장소와 입력값이 같으면(이미 선택한 경우) 검색하지 않음
    if (searchResults.some(r => r.place_name === location)) {
      return;
    }

    const timer = setTimeout(() => {
      searchPlaces(location);
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // Recommendations States
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isRecommending, setIsRecommending] = useState(false);

  const fetchRecommendations = async (lat: number, lng: number) => {
    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) return;
    setIsRecommending(true);

    const ps = new window.kakao.maps.services.Places();

    // 주변 1km 반경 카페(CE7) 검색
    ps.categorySearch('CE7', async (data: SearchResult[], status: string) => {
      if (status === window.kakao.maps.services.Status.OK) {
        // 각 장소에 대해 실제 이미지 검색 수행
        const results = await Promise.all(
          data.slice(0, 5).map(async (place: SearchResult) => {
            try {
              const res = await fetch(`/api/search-image?query=${encodeURIComponent(place.place_name)}`);
              const { imageUrl } = await res.json();

              return {
                id: place.id,
                name: place.place_name,
                category: place.category_group_name || '카페',
                rating: (4.0 + Math.random() * 0.9).toFixed(1), // Mock rating
                distance: `${place.distance}m`,
                desc: place.address_name,
                tags: ['#실시간_추천', '#모임_최적'],
                image: imageUrl || 'https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=200&auto=format&fit=crop'
              };
            } catch {
              console.error('Image fetch failed for:', place.place_name);
              return null;
            }
          })
        );

        setRecommendations(results.filter(Boolean) as Recommendation[]);
      } else {
        setRecommendations([]);
      }
      setIsRecommending(false);
    }, {
      location: new window.kakao.maps.LatLng(lat, lng),
      radius: 1000
    });
  };

  useEffect(() => {
    const setupMapWithCoords = (container: HTMLElement, lat: number, lng: number) => {
      const options = {
        center: new window.kakao.maps.LatLng(lat, lng),
        level: 3
      };
      const newMap = new window.kakao.maps.Map(container, options);
      const newMarker = new window.kakao.maps.Marker({
        position: newMap.getCenter()
      });
      newMarker.setMap(newMap);
      setMap(newMap);
      setMarker(newMarker);

      // 초기 렌더링 시 주변 장소 추천 실행
      fetchRecommendations(lat, lng);
    };

    const initMap = () => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => {
          const container = document.getElementById('location-map');
          if (container && !map) {
            // 브라우저 위치 정보 가져오기 시도
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  setupMapWithCoords(container, position.coords.latitude, position.coords.longitude);
                },
                () => {
                  // 위치 권한 거부 시 기본값 (서울 시청)
                  setupMapWithCoords(container, 37.5665, 126.9780);
                }
              );
            } else {
              setupMapWithCoords(container, 37.5665, 126.9780);
            }
          }
        });
      }
    };

    if (isOpen) {
      if (!window.kakao || !window.kakao.maps) {
        setTimeout(initMap, 500);
      } else {
        initMap();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const searchPlaces = (keyword: string) => {
    if (!keyword.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) return;

    setIsSearching(true);
    const ps = new window.kakao.maps.services.Places();

    ps.keywordSearch(keyword, (data: SearchResult[], status: string) => {
      if (status === window.kakao.maps.services.Status.OK) {
        setSearchResults(data);
        setShowResults(true);
      } else {
        setSearchResults([]);
      }
      setIsSearching(false);
    });
  };

  const handleLocationSelect = (place: SearchResult) => {
    setLocation(place.place_name);
    setShowResults(false);

    if (map && marker) {
      const coords = new window.kakao.maps.LatLng(place.y, place.x);
      map.setCenter(coords);
      marker.setPosition(coords);
      marker.setMap(map);

      // 선택한 장소를 기준으로 추천 리스트 갱신
      fetchRecommendations(parseFloat(place.y), parseFloat(place.x));
    }
  };

  if (!isOpen) return null;

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

  const handleRecommendationSelect = (rec: Recommendation) => {
    setLocation(rec.name);
    if (map && marker) {
      // 추천 장소의 경우 좌표를 직접 넘겨받거나 다시 검색이 필요할 수 있지만, 
      // 현재 UI 연동을 위해 이름만 채우고 지도는 해당 이름으로 검색해주는 것이 더 확실합니다.
      searchPlaces(rec.name);
      // 검색창을 열어 장소를 선택하도록 유도하거나, 직접 좌표를 맵핑할 수 있습니다.
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-gray-800">새 일정 만들기</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 no-scrollbar">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="일정 제목을 입력하세요"
              className="w-full bg-gray-50 border border-transparent rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                날짜
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-gray-50 border border-transparent rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                시간
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-gray-50 border border-transparent rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none"
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2 relative">
            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              장소
            </label>
            <div className="relative">
              <input
                type="text"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  if (e.target.value) searchPlaces(e.target.value);
                  else setShowResults(false);
                }}
                placeholder="장소를 검색하거나 입력하세요"
                className="w-full bg-gray-50 border border-transparent rounded-xl px-4 py-3 pl-11 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none"
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                {isSearching ? (
                  <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </div>

            {/* Search Results Dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto no-scrollbar">
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleLocationSelect(result)}
                    className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <div className="font-bold text-sm text-gray-800">{result.place_name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{result.address_name || result.road_address_name}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Kakao Map Container */}
            <div
              id="location-map"
              className="w-full h-48 bg-gray-100 rounded-xl mt-3 overflow-hidden border border-gray-100"
            />
          </div>

          {/* AI Recommendations */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-indigo-600 fill-indigo-600" />
                <span className="text-sm font-bold text-gray-700">맞춤 장소 추천</span>
                <span className="text-[10px] text-gray-400 font-normal ml-1">날짜와 모임 성격에 맞춘 AI 추천</span>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar min-h-45">
              {isRecommending ? (
                <div className="w-full flex items-center justify-center bg-gray-50 rounded-xl py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                    <span className="text-xs text-gray-400">주변 장소를 찾는 중...</span>
                  </div>
                </div>
              ) : recommendations.length > 0 ? (
                recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => handleRecommendationSelect(rec)}
                    className="min-w-60 bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:border-indigo-200 transition-all group cursor-pointer"
                  >
                    <div className="relative h-28 overflow-hidden">
                      <Image
                        src={`/api/proxy-image?url=${encodeURIComponent(rec.image)}`}
                        alt={rec.name}
                        fill
                        unoptimized
                        referrerPolicy="no-referrer"
                        sizes="(max-width: 768px) 100vw, 240px"
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">{rec.category}</div>
                      <div className="absolute top-2 right-2 bg-white/90 text-gray-800 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5">
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" /> {rec.rating}
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-xs font-bold text-gray-800">{rec.name}</h4>
                        <span className="text-[10px] text-gray-400">{rec.distance}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 line-clamp-2 mb-2 leading-relaxed">{rec.desc}</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {rec.tags.map(tag => (
                          <span key={tag} className="text-[9px] text-indigo-500 font-bold">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="w-full flex items-center justify-center bg-gray-50 rounded-xl py-8">
                  <span className="text-xs text-gray-400">주변에 추천할 장소가 없습니다.</span>
                </div>
              )}
            </div>
          </div>

          {/* Group Select */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              모임 선택
            </label>
            <div className="relative">
              <select className="w-full bg-gray-50 border border-transparent rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none appearance-none">
                <option value="">모임을 선택하세요</option>
                <option value="1">대학 동기들</option>
                <option value="2">헬스 크루</option>
                <option value="3">독서 모임</option>
              </select>
              <ChevronRight className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 rotate-90" />
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-2 relative">
            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              참여자
            </label>
            <div className="relative">
              <input
                type="text"
                value={participantInput}
                onChange={(e) => handleMentionInput(e.target.value, 'participants')}
                placeholder="참여자 검색 (@를 입력하세요)"
                className="w-full bg-gray-50 border border-transparent rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none"
              />

              {/* Mentions for Participants */}
              {showMentions && activeMentionField === 'participants' && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden z-20 max-h-48 overflow-y-auto no-scrollbar">
                  <div className="p-2 border-b border-gray-50 bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase">친구 선택</div>
                  {filteredItems.map((person) => (
                    <button
                      key={person}
                      onClick={() => handleMentionSelect(person)}
                      className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors flex items-center gap-3 border-b border-gray-50 last:border-0"
                    >
                      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">{person[0]}</div>
                      <span className="text-sm text-gray-700 font-medium">{person}</span>
                    </button>
                  ))}
                  {filteredItems.length === 0 && (
                    <div className="p-4 text-center text-xs text-gray-400">친구가 없습니다.</div>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {participants.map(p => (
                <div key={p} className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-indigo-100">
                  {p}
                  {p !== '나' && (
                    <button onClick={() => setParticipants(participants.filter(item => item !== p))} className="hover:text-red-500 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tag Memos */}
          <div className="space-y-2 relative">
            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              연관 메모 태그
            </label>
            <div className="relative">
              <input
                type="text"
                value={memoTagInput}
                onChange={(e) => handleMentionInput(e.target.value, 'memos')}
                placeholder="연관된 메모 검색 (@를 입력하세요)"
                className="w-full bg-gray-50 border border-transparent rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none"
              />

              {/* Mentions for Memos */}
              {showMentions && activeMentionField === 'memos' && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden z-20 max-h-48 overflow-y-auto no-scrollbar">
                  <div className="p-2 border-b border-gray-50 bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase">메모 선택</div>
                  {filteredItems.map((memoTitle) => (
                    <button
                      key={memoTitle}
                      onClick={() => handleMentionSelect(memoTitle)}
                      className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 transition-colors flex items-center gap-3 border-b border-gray-50 last:border-0"
                    >
                      <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-sm text-gray-700 font-medium truncate">{memoTitle}</span>
                    </button>
                  ))}
                  {filteredItems.length === 0 && (
                    <div className="p-4 text-center text-xs text-gray-400">메모가 없습니다.</div>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {taggedMemos.map(m => (
                <div key={m} className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-emerald-100">
                  <FileText className="w-3 h-3" />
                  {m}
                  <button onClick={() => setTaggedMemos(taggedMemos.filter(item => item !== m))} className="hover:text-red-500 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Tag className="w-4 h-4 text-gray-400" />
              태그
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="태그 입력"
                className="flex-1 bg-gray-50 border border-transparent rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none"
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              />
              <button
                onClick={handleAddTag}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                추가
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map(tag => (
                <span key={tag} className="text-indigo-600 font-bold text-xs">{tag}</span>
              ))}
            </div>
          </div>

          {/* Additional Notes */}
          <div className="space-y-2 pb-4">
            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              기타 사항
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="일정에 대한 추가 메모나 기타 사항을 입력하세요"
              className="w-full bg-gray-50 border border-transparent rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none min-h-25 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex gap-4 shrink-0 bg-white">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
          >
            저장하기
          </button>
        </div>
      </div>
    </div>
  );
}
