'use client';

import React, { useState } from 'react';
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
  ChevronRight
} from 'lucide-react';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
}

export default function AppointmentModal({ isOpen, onClose, initialDate }: AppointmentModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate || '2026-04-11');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [memo, setMemo] = useState('');
  const [participants, setParticipants] = useState(['나']);
  const [participantInput, setParticipantInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

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

  const recommendations = [
    {
      id: 1,
      name: '스타벅스 강남점',
      category: '카페',
      rating: 4.5,
      distance: '500m',
      desc: '넓은 좌석과 안정적인 와이파이로 스터디에 최적화된 공간입니다.',
      tags: ['#스터디_최적', '#조용함', '#WiFi'],
      image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=200&auto=format&fit=crop'
    },
    {
      id: 2,
      name: '홍대 파스타 하우스',
      category: '식당',
      rating: 4.8,
      distance: '1.2km',
      desc: '아늑한 분위기와 합리적인 가격으로 친구들과 모임하기 좋습니다.',
      tags: ['#데이트_추천', '#분위기_좋음', '#가성비'],
      image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?q=80&w=200&auto=format&fit=crop'
    },
    {
      id: 3,
      name: 'CGV 신촌',
      category: '영화관',
      rating: 4.2,
      distance: '1.5km',
      desc: '최신 시설과 다양한 상영관으로 쾌적한 영화 관람이 가능합니다.',
      tags: ['#주말_추천', '#최신시설'],
      image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=200&auto=format&fit=crop'
    }
  ];

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
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              장소
            </label>
            <input 
              type="text" 
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="장소를 검색하거나 입력하세요"
              className="w-full bg-gray-50 border border-transparent rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none"
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
            <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
              {recommendations.map((rec) => (
                <div key={rec.id} className="min-w-[240px] bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:border-indigo-200 transition-all group cursor-pointer">
                  <div className="relative h-28 overflow-hidden">
                    <img src={rec.image} alt={rec.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
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
              ))}
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
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              참여자
            </label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={participantInput}
                onChange={(e) => setParticipantInput(e.target.value)}
                placeholder="참여자 이름 입력"
                className="flex-1 bg-gray-50 border border-transparent rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none"
                onKeyPress={(e) => e.key === 'Enter' && handleAddParticipant()}
              />
              <button 
                onClick={handleAddParticipant}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                추가
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {participants.map(p => (
                <div key={p} className="bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5">
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

          {/* Memo */}
          <div className="space-y-2 pb-4">
            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              메모
            </label>
            <textarea 
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="추가 메모를 입력하세요"
              className="w-full bg-gray-50 border border-transparent rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none min-h-[100px] resize-none"
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
