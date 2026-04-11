'use client';

import React from 'react';
import { 
  X, 
  Share2, 
  Users, 
  Sparkles, 
  Tag as TagIcon, 
  FileText,
  MessageSquare
} from 'lucide-react';

interface MemoDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  memo: any;
}

export default function MemoDetailModal({ isOpen, onClose, memo }: MemoDetailModalProps) {
  if (!isOpen || !memo) return null;

  // Mock data for members and AI insights based on the design
  const members = [
    { name: '지민', color: 'bg-blue-500', initial: '지' },
    { name: '수진', color: 'bg-emerald-500', initial: '수' },
    { name: '태현', color: 'bg-orange-500', initial: '태' },
    { name: '민수', color: 'bg-indigo-500', initial: '민' },
  ];

  const keywords = ['홍대', '저녁', '영화', '파스타', 'CGV'];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-5xl max-h-[85vh] flex shadow-2xl overflow-hidden relative animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Main Content Area (Left) */}
        <div className="flex-1 flex flex-col p-10 overflow-y-auto no-scrollbar border-r border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black text-gray-900">{memo.title}</h2>
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 lg:hidden">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-1 mb-10 text-sm text-gray-400 font-medium">
            <p>작성자: {memo.author || '민수'}</p>
            <p>최종 수정: {memo.date} 14:30:15</p>
          </div>

          <div className="flex-1">
            <p className="text-lg text-gray-700 leading-relaxed font-medium whitespace-pre-wrap">
              {memo.description}
            </p>
          </div>
        </div>

        {/* Info Sidebar (Right) */}
        <div className="w-[360px] bg-gray-50/50 p-8 overflow-y-auto no-scrollbar flex flex-col gap-8 shrink-0">
          <div className="flex justify-end lg:absolute lg:top-8 lg:right-8">
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hidden lg:block">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Group Members */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-900 font-bold">
              <Users className="w-5 h-5 text-blue-500" />
              <span>그룹 멤버</span>
            </div>
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.name} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full ${member.color} flex items-center justify-center text-[10px] text-white font-bold`}>
                    {member.initial}
                  </div>
                  <span className="text-sm font-bold text-gray-600">{member.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Insights */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-900 font-bold">
              <Sparkles className="w-5 h-5 text-blue-500" />
              <span>AI 인사이트</span>
            </div>
            
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded uppercase">요약</span>
                <p className="text-xs text-gray-600 leading-relaxed font-medium">
                  홍대에서 저녁 식사와 영화 관람 계획. 파스타 집 예약 완료, CGV 7시 30분 예매 필요.
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase">주요 키워드</span>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map(kw => (
                    <span key={kw} className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase">감정 분석</span>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 w-[85%]" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-500 shrink-0">긍정</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-900 font-bold">
              <TagIcon className="w-5 h-5 text-blue-500" />
              <span>태그</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {['#React', '#스터디', '#프로젝트'].map(tag => (
                <span key={tag} className="text-xs font-bold text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-xl shadow-sm hover:bg-gray-50 cursor-pointer transition-all">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* OCR Result */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-900 font-bold">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              <span className="text-sm">OCR 인식 텍스트</span>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm italic text-xs text-gray-500 leading-relaxed font-medium">
              "2026년 4월 8일 저녁 7시 홍대입구역 3번 출구에서 만나요!"
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
