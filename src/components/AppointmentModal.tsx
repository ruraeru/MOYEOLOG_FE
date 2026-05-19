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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[2rem] w-full max-w-xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
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

        {/* Strictly Vertical Content Flow */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-10">
          
          {/* Title */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">일정 제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="어떤 약속인가요?"
              className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-base focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold shadow-sm"
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" /> 날짜
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold shadow-sm"
            />
          </div>

          {/* Time */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-indigo-500" /> 시간
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold shadow-sm"
            />
          </div>

          {/* Group */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-indigo-500" /> 모임 선택
            </label>
            <div className="relative">
              <select 
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none appearance-none font-bold shadow-sm"
              >
                <option value="">모임을 선택하세요 (개인 일정)</option>
                {userGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
              <ChevronRight className="w-4 h-4 text-gray-400 absolute right-6 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
            </div>
          </div>

          {/* Map & Location */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-rose-500" /> 장소 지정
            </label>
            <div className="rounded-3xl overflow-hidden border-2 border-gray-100 shadow-inner bg-gray-50 mb-4">
              <div ref={mapContainer} className="h-[220px] w-full" />
            </div>
            <div className="relative">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchLocation()}
                placeholder="장소를 검색해보세요"
                className="w-full bg-gray-50 border-2 border-transparent rounded-2xl pl-6 pr-14 py-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold shadow-sm"
              />
              <button 
                onClick={handleSearchLocation}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>

            {/* Inline Recommendations */}
            <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar -mx-1 px-1 mt-4">
              {loadingRecs ? (
                <div className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 w-full text-center">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500 mx-auto" />
                </div>
              ) : recommendations.map(rec => (
                <div
                  key={rec.id}
                  onClick={() => handleRecommendationSelect(rec)}
                  className="flex-shrink-0 w-48 bg-white border border-gray-100 rounded-2xl p-3 hover:border-indigo-200 hover:shadow-lg transition-all cursor-pointer group"
                >
                  <div className="relative h-24 w-full rounded-xl overflow-hidden mb-2">
                    <Image src={rec.image} alt={rec.name} fill className="object-cover group-hover:scale-110 transition-transform" />
                  </div>
                  <h4 className="font-black text-gray-800 text-xs truncate">{rec.name}</h4>
                  <p className="text-[10px] text-gray-400 font-bold">{rec.category} · {rec.distance}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-blue-500" /> 참여자 (@멘션)
            </label>
            <div className="relative">
              <input
                type="text"
                value={participantInput}
                onChange={(e) => handleInputChange(e, 'participants')}
                placeholder="친구를 태그해보세요"
                className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold shadow-sm"
              />
              {showMentions && activeMentionField === 'participants' && (
                <div className="absolute z-30 bottom-full mb-2 w-full bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden py-2">
                  {filteredItems.map(friend => (
                    <button key={friend} onClick={() => insertMention(friend)} className="w-full px-6 py-3 text-left text-sm hover:bg-indigo-50 flex items-center gap-4 transition-colors font-bold text-gray-700">
                      {friend}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {participants.map(p => (
                <div key={p} className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-2 border border-indigo-100">
                  {p}
                  <button onClick={() => setParticipants(participants.filter(item => item !== p))}><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Content */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-gray-400" /> 상세 메모
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="일정에 대한 추가 메모를 남겨보세요"
              className="w-full bg-gray-50 border-2 border-transparent rounded-[2rem] px-6 py-6 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none min-h-[140px] resize-none font-medium shadow-sm leading-relaxed"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-gray-100 bg-gray-50/30 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 px-4 py-4 bg-white border-2 border-gray-200 text-gray-500 rounded-2xl text-sm font-black hover:bg-gray-50 transition-all active:scale-95"
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
