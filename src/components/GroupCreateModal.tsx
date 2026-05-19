'use client';

import React, { useState } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { groupApi } from '@/lib/group-api';

interface GroupCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const THEMES = [
  { id: 'indigo', color: 'bg-indigo-500' },
  { id: 'blue', color: 'bg-blue-500' },
  { id: 'emerald', color: 'bg-emerald-500' },
  { id: 'orange', color: 'bg-orange-500' },
  { id: 'rose', color: 'bg-rose-500' },
  { id: 'amber', color: 'bg-amber-500' },
];

export default function GroupCreateModal({
  isOpen,
  onClose,
  onSuccess,
}: GroupCreateModalProps) {
  const { data: session } = useSession();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('indigo');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setDescription('');
    setSelectedTheme('indigo');
    setError(null);
  };

  const handleClose = () => {
    if (isSaving) return;
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('모임 이름을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await groupApi.create({
        name,
        description,
        colorTheme: selectedTheme,
      }, session);

      resetForm();
      onSuccess?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '모임 생성에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">새로운 모임 만들기</h2>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">모임 이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 대학 동기들, 프로젝트 팀"
              className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">설명 (선택)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="모임에 대한 간단한 설명을 입력하세요"
              className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-sm h-24 resize-none"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold text-gray-700">테마 색상</label>
            <div className="flex flex-wrap gap-3">
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setSelectedTheme(theme.id)}
                  className={`w-10 h-10 rounded-xl ${theme.color} flex items-center justify-center text-white transition-all hover:scale-110 shadow-sm ${
                    selectedTheme === theme.id ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                  }`}
                >
                  {selectedTheme === theme.id && <Check className="w-5 h-5" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="px-6 pb-2 text-xs font-medium text-red-500">{error}</p>}

        <div className="p-6 bg-gray-50/50 flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="flex-1 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-2 px-8 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving ? '생성 중…' : '모임 생성하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
