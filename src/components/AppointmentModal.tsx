'use client';

import { useState, useEffect, useRef } from 'react';
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

interface KakaoMap {
  setCenter: (latlng: unknown) => void;
  relayout: () => void;
}

interface KakaoMarker {
  setMap: (map: unknown) => void;
  setPosition: (latlng: unknown) => void;
}

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
  rating: number;
  reviews: number;
  image: string;
  tags: string[];
}

interface KakaoPlace {
  place_name: string;
  address_name: string;
  category_name: string;
  id: string;
  category_group_name?: string;
  distance?: string;
  y: string;
  x: string;
}

declare global {
  interface Window {
    kakao: unknown;
  }
}

export default function AppointmentModal({ isOpen, onClose, initialDate, onSuccess }: AppointmentModalProps) {
  const { data: session } = useSession();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate || '2026-04-11');
  const [time, setTime] = useState('12:00');
  const [location, setLocation] = useState('');
  const [memo, setMemo] = useState(''); 
  const [participants, setParticipants] = useState(['나']);
  const [participantInput, setParticipantInput] = useState('');
  const [taggedMemos, setTaggedMemos] = useState<string[]>([]);
  const [memoTagInput, setMemoTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [userGroups, setUserGroups] = useState<GroupResponse[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 초기 날짜 동기화
  useEffect(() => {
    if (isOpen && initialDate) {
      setDate(initialDate);
    }
  }, [isOpen, initialDate]);

  // 유저 그룹 목록 가져오기
  useEffect(() => {
    if (isOpen && session) {
      groupApi.getAll(session).then(setUserGroups).catch(console.error);
    }
  }, [isOpen, session]);

  // Mentions States
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [activeMentionField, setActiveMentionField] = useState<'participants' | 'memos' | null>(null);

  // Kakao Map States
  const [map, setMap] = useState<KakaoMap | null>(null);
  const [marker, setMarker] = useState<KakaoMarker | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loadingRecs, setLoadingLoadingRecs] = useState(false);
  const mapContainer = useRef<HTMLDivElement>(null);

  const mockFriends = ['김철수', '이영희', '박지민', '최수연'];
  const mockMemos = ['프로젝트 기획안', '3월 회의록', '강남 맛집 리스트', '제주도 여행 일정'];

  useEffect(() => {
    if (isOpen && mapContainer.current) {
      const script = document.createElement('script');
      script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=YOUR_KAKAO_MAP_KEY&autoload=false&libraries=services`;
      script.async = true;
      document.head.appendChild(script);

      script.onload = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const kakao = (window as any).kakao;
        kakao.maps.load(() => {
          const options = {
            center: new kakao.maps.LatLng(37.566826, 126.9786567),
            level: 3
          };
          const newMap = new kakao.maps.Map(mapContainer.current, options);
          const newMarker = new kakao.maps.Marker({
            position: options.center
          });
          newMarker.setMap(newMap);
          setMap(newMap as KakaoMap);
          setMarker(newMarker as KakaoMarker);

          // Initial recommendations
          fetchRecommendations();
        });
      };
    }
  }, [isOpen]);

  const fetchRecommendations = async () => {
    setLoadingLoadingRecs(true);
    setTimeout(() => {
      setRecommendations([
        {
          id: 1,
          name: '카페 무드',
          category: '카페',
          distance: '150m',
          rating: 4.8,
          reviews: 124,
          image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=100&h=100&fit=crop',
          tags: ['조용한', '카공하기좋은', '커피맛집']
        },
        {
          id: 2,
          name: '정식당',
          category: '음식점',
          distance: '320m',
          rating: 4.9,
          reviews: 89,
          image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100&h=100&fit=crop',
          tags: ['미슐랭', '특별한날', '분위기']
        }
      ]);
      setLoadingLoadingRecs(false);
    }, 800);
  };

  const handleSearchLocation = () => {
    if (!location || !map) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kakao = (window as any).kakao;
    const ps = new kakao.maps.services.Places();
    ps.keywordSearch(location, (data: KakaoPlace[], status: string) => {
      if (status === kakao.maps.services.Status.OK) {
        const lat = parseFloat(data[0].y);
        const lng = parseFloat(data[0].x);
        const realCoords = new kakao.maps.LatLng(lat, lng);

        map.setCenter(realCoords);
        if (marker) {
          marker.setPosition(realCoords);
        }
        fetchRecommendations();
      }
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, field: 'participants' | 'memos') => {
    const value = e.target.value;
    if (field === 'participants') setParticipantInput(value);
    else setMemoTagInput(value);

    const lastChar = value.slice(-1);
    if (lastChar === '@') {
      setActiveMentionField(field);
      setShowMentions(true);
      setMentionQuery('');
    } else if (showMentions) {
      const parts = value.split('@');
      setMentionQuery(parts[parts.length - 1]);
    }
  };

  const insertMention = (item: string) => {
    if (activeMentionField === 'participants') {
      if (!participants.includes(item)) setParticipants([...participants, item]);
      setParticipantInput(participantInput.split('@')[0]);
    } else {
      if (!taggedMemos.includes(item)) setTaggedMemos([...taggedMemos, item]);
      setMemoTagInput(memoTagInput.split('@')[0]);
    }
    setShowMentions(false);
    setActiveMentionField(null);
  };

  const filteredItems = activeMentionField === 'participants'
    ? mockFriends.filter(f => f.toLowerCase().includes(mentionQuery.toLowerCase()))
    : mockMemos.filter(m => m.toLowerCase().includes(mentionQuery.toLowerCase()));

  const handleSave = async () => {
    if (!title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const start = new Date(`${date}T${time || '00:00'}`);
      const end = new Date(start.getTime() + 60 * 60 * 1000);

      await scheduleApi.create({
        title,
        description: memo,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        location,
        groupId: selectedGroupId || undefined,
      }, session);

      setTitle('');
      setMemo('');
      setLocation('');
      setSelectedGroupId('');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to save schedule:', error);
      alert('일정 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const handleAddTag = () => {
    if (tagInput && !tags.includes(tagInput)) {
      setTags([...tags, `#${tagInput.replace(/^#/, '')}`]);
      setTagInput('');
    }
  };

  const handleRecommendationSelect = (rec: Recommendation) => {
    setLocation(rec.name);
    if (map && marker) {
      handleSearchLocation();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[2.5rem] w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_420px] shadow-2xl overflow-hidden h-full max-h-[840px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Side: Map & Place Recommendations */}
        <div className="flex flex-col h-full border-r border-gray-100 bg-gray-50/30 overflow-hidden">
          <div ref={mapContainer} className="h-[280px] lg:h-[400px] w-full shrink-0 border-b border-gray-100" />

          <div className="flex-1 p-8 overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400 fill-current" />
                장소 추천
              </h3>
              <div className="flex gap-2">
                {['전체', '맛집', '카페'].map(cat => (
                  <button key={cat} className="px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors shadow-sm">
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {loadingRecs ? (
                <div className="py-20 flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <p className="text-sm text-gray-400 font-bold">근처 핫플레이스 찾는 중...</p>
                </div>
              ) : (
                recommendations.map(rec => (
                  <div
                    key={rec.id}
                    onClick={() => handleRecommendationSelect(rec)}
                    className="flex gap-5 p-4 bg-white rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-lg transition-all cursor-pointer group"
                  >
                    <div className="relative w-24 h-24 rounded-xl overflow-hidden shrink-0 shadow-sm">
                      <Image src={rec.image} alt={rec.name} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-wider">{rec.category}</span>
                          <span className="text-[10px] text-gray-400 font-bold">{rec.distance}</span>
                        </div>
                        <h4 className="font-black text-gray-800 text-base truncate group-hover:text-indigo-600 transition-colors">{rec.name}</h4>
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-current" />
                          <span className="text-xs font-black text-gray-700">{rec.rating}</span>
                          <span className="text-[10px] text-gray-400 font-bold">({rec.reviews})</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {rec.tags.map(tag => (
                          <span key={tag} className="text-[9px] text-gray-400 font-bold border border-gray-100 px-1.5 py-0.5 rounded">#{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Appointment Form */}
        <div className="flex flex-col h-full bg-white overflow-hidden">
          <div className="px-8 py-7 border-b border-gray-50 flex items-center justify-between shrink-0">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">일정 만들기</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-9">
            {/* Title Input */}
            <div className="space-y-2.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="일정 제목을 입력하세요"
                className="w-full bg-gray-50 border border-transparent rounded-2xl px-5 py-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold shadow-sm"
              />
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" /> 날짜
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-gray-50 border border-transparent rounded-2xl px-5 py-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold shadow-sm"
                />
              </div>
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> 시간
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-gray-50 border border-transparent rounded-2xl px-5 py-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold shadow-sm"
                />
              </div>
            </div>

            {/* Location Search */}
            <div className="space-y-2.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" /> 장소
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchLocation()}
                  placeholder="장소를 검색해보세요"
                  className="w-full bg-gray-50 border border-transparent rounded-2xl pl-5 pr-12 py-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold shadow-sm"
                />
                <button onClick={handleSearchLocation} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors">
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Group Select */}
            <div className="space-y-2.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> 모임 선택
              </label>
              <div className="relative">
                <select 
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full bg-gray-50 border border-transparent rounded-2xl px-5 py-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none appearance-none font-bold shadow-sm"
                >
                  <option value="">모임을 선택하세요 (개인 일정)</option>
                  {userGroups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
                <ChevronRight className="w-4 h-4 text-gray-400 absolute right-5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
              </div>
            </div>

            {/* Participants with Mentions */}
            <div className="space-y-2.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> 참여자 추가 (@멘션)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={participantInput}
                  onChange={(e) => handleInputChange(e, 'participants')}
                  placeholder="친구 이름을 입력하거나 @를 눌러보세요"
                  className="w-full bg-gray-50 border border-transparent rounded-2xl px-5 py-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold shadow-sm"
                />
                {showMentions && activeMentionField === 'participants' && (
                  <div className="absolute z-20 bottom-full mb-2 w-full bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden py-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {filteredItems.map(friend => (
                      <button key={friend} onClick={() => insertMention(friend)} className="w-full px-5 py-3 text-left text-sm hover:bg-indigo-50 flex items-center gap-3 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 border border-indigo-200">
                          {friend[0]}
                        </div>
                        <span className="font-bold text-gray-700">{friend}</span>
                      </button>
                    ))}
                    {filteredItems.length === 0 && (
                      <div className="p-5 text-center text-xs text-gray-400 font-medium">친구가 없습니다.</div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2.5 mt-3">
                {participants.map(p => (
                  <div key={p} className="bg-indigo-50 text-indigo-700 text-[11px] font-black px-4 py-2 rounded-full flex items-center gap-2 border border-indigo-100 shadow-sm">
                    <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center text-[8px] font-black shadow-inner">{p[0]}</div>
                    {p}
                    <button onClick={() => setParticipants(participants.filter(item => item !== p))} className="hover:text-red-500 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Memo Tagging with Mentions */}
            <div className="space-y-2.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> 관련 메모 태그 (@멘션)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={memoTagInput}
                  onChange={(e) => handleInputChange(e, 'memos')}
                  placeholder="관련 메모를 태그해보세요"
                  className="w-full bg-gray-50 border border-transparent rounded-2xl px-5 py-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold shadow-sm"
                />
                {showMentions && activeMentionField === 'memos' && (
                  <div className="absolute z-20 bottom-full mb-2 w-full bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden py-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {filteredItems.map(memoTitle => (
                      <button key={memoTitle} onClick={() => insertMention(memoTitle)} className="w-full px-5 py-3 text-left text-sm hover:bg-indigo-50 flex items-center gap-3 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 border border-emerald-200">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span className="text-sm text-gray-700 font-bold truncate">{memoTitle}</span>
                      </button>
                    ))}
                    {filteredItems.length === 0 && (
                      <div className="p-5 text-center text-xs text-gray-400 font-medium">메모가 없습니다.</div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2.5 mt-3">
                {taggedMemos.map(m => (
                  <div key={m} className="bg-emerald-50 text-emerald-700 text-[11px] font-black px-4 py-2 rounded-full flex items-center gap-2 border border-emerald-100 shadow-sm">
                    <FileText className="w-3.5 h-3.5" />
                    {m}
                    <button onClick={() => setTaggedMemos(taggedMemos.filter(item => item !== m))} className="hover:text-red-500 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Tag className="w-3.5 h-3.5" /> 태그
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="태그 입력"
                  className="flex-1 bg-gray-50 border border-transparent rounded-2xl px-5 py-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold shadow-sm"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                />
                <button
                  onClick={handleAddTag}
                  className="bg-gray-900 text-white px-6 py-3 rounded-2xl text-sm font-black hover:bg-gray-800 transition-all flex items-center gap-2 shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  추가
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {tags.map(tag => (
                  <span key={tag} className="text-[11px] font-black text-indigo-600 bg-white border border-indigo-100 px-4 py-1.5 rounded-xl shadow-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Additional Notes */}
            <div className="space-y-2.5 pb-6">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> 기타 사항
              </label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="일정에 대한 추가 메모나 기타 사항을 입력하세요"
                className="w-full bg-gray-50 border border-transparent rounded-2xl px-5 py-5 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none min-h-[140px] resize-none font-medium shadow-sm leading-relaxed"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-8 border-t border-gray-100 bg-gray-50/50 flex gap-4 shrink-0">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-4 bg-white border border-gray-200 text-gray-600 rounded-[1.25rem] text-sm font-black hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm active:scale-95"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-[2] px-4 py-4 bg-indigo-600 text-white rounded-[1.25rem] text-sm font-black hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-70 flex items-center justify-center gap-2 active:scale-95"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-5 h-5" />}
              {isSaving ? '저장 중…' : '일정 저장하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
