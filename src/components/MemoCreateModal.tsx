'use client';

import React, { useState } from 'react';
import {
  X,
  Upload,
  Type,
  Bold,
  Italic,
  Heading1,
  Heading2,
  Users,
  Tag as TagIcon,
  Sparkles,
  FileSearch,
  Lightbulb
} from 'lucide-react';

interface MemoCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MemoCreateModal({ isOpen, onClose }: MemoCreateModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-5xl flex flex-col shadow-2xl overflow-hidden relative animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-gray-800">새 메모 작성</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Container */}
        <div className="flex h-[600px]">

          {/* Main Input Area (Left) */}
          <div className="flex-1 flex flex-col p-8 border-r border-gray-100 overflow-y-auto no-scrollbar">
            <input
              type="text"
              placeholder="메모 제목을 입력하세요"
              className="text-2xl font-bold text-gray-900 placeholder:text-gray-300 border-none outline-none mb-6 w-full"
            />

            {/* Upload Area */}
            <div className="w-full border-2 border-dashed border-gray-100 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 bg-gray-50/30 hover:bg-gray-50 transition-colors cursor-pointer mb-6 group">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm text-gray-400 group-hover:text-blue-500 group-hover:scale-110 transition-all">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-gray-600">이미지를 드래그하거나 클릭하여 업로드</p>
                <p className="text-[11px] text-gray-400 mt-1">PNG, JPG, GIF (최대 10MB)</p>
              </div>
            </div>

            {/* Content Textarea Area */}
            <div className="flex-1 min-h-[200px] border border-gray-100 rounded-2xl p-5 relative bg-white">
              <textarea
                placeholder="내용을 입력하세요..."
                className="w-full h-full resize-none border-none outline-none text-sm text-gray-600 placeholder:text-gray-300 leading-relaxed"
              />
            </div>
          </div>

          {/* Sidebar Area (Right) */}
          <div className="w-[340px] bg-gray-50/30 p-8 flex flex-col gap-8 shrink-0 overflow-y-auto no-scrollbar">

            {/* Share Group */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                <Users className="w-4 h-4" />
                <span>공유할 그룹 선택</span>
              </div>
              <input
                type="text"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs outline-none focus:border-blue-400 transition-all shadow-sm"
              />
            </div>

            {/* Tags */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                <TagIcon className="w-4 h-4" />
                <span>태그</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="태그 입력"
                  className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs outline-none focus:border-blue-400 transition-all shadow-sm"
                />
                <button className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-100 shrink-0">
                  추가
                </button>
              </div>
            </div>

            {/* AI Features */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span>AI 기능</span>
              </div>
              <div className="space-y-2">
                <button className="w-full bg-[#E0E7FF] text-[#6366F1] py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#D1DBFF] transition-all shadow-sm">
                  <FileSearch className="w-4 h-4" />
                  이미지에서 글자 추출
                </button>
                <button className="w-full bg-[#F3E8FF] text-[#A855F7] py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#E9D5FF] transition-all shadow-sm">
                  <Sparkles className="w-4 h-4" />
                  AI 내용 요약
                </button>
              </div>
            </div>

            {/* Tips */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-yellow-500">
                <Lightbulb className="w-3.5 h-3.5" />
                <span>팁</span>
              </div>
              <ul className="text-[10px] text-gray-400 space-y-2 leading-relaxed font-medium">
                <li>• 이미지를 첨부하면 AI가 텍스트를 추출합니다</li>
                <li>• 태그를 활용해 메모를 쉽게 찾을 수 있어요</li>
                <li>• 그룹 공유 시 멤버들도 확인할 수 있습니다</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Toolbar & Footer */}
        <div className="border-t border-gray-100 p-6 px-8 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6 text-gray-400">
            <button className="hover:text-gray-600 transition-colors"><Bold className="w-5 h-5" /></button>
            <button className="hover:text-gray-600 transition-colors"><Italic className="w-5 h-5" /></button>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <button className="hover:text-gray-600 transition-colors font-bold text-sm">H1</button>
            <button className="hover:text-gray-600 transition-colors font-bold text-sm">H2</button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-[#B4BDFF] text-white rounded-xl text-sm font-bold hover:bg-[#A3ADFF] shadow-lg shadow-blue-50 transition-all"
            >
              메모 저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
