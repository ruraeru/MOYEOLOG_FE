'use client';

import React, { useState } from 'react';
import { X, Loader2, Check, Copy, CheckCircle2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { groupApi, type GroupResponse } from '@/lib/group-api';

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
  const [createdGroup, setCreatedGroup] = useState<GroupResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setName('');
    setDescription('');
    setSelectedTheme('indigo');
    setError(null);
    setCreatedGroup(null);
    setCopied(false);
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
      const group = await groupApi.create({
        name,
        description,
        colorTheme: selectedTheme,
      }, session);

      setCreatedGroup(group);
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '모임 생성에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const inviteLink = createdGroup ? `${window.location.origin}/invite/group?code=${createdGroup.inviteCode}` : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-[2.5rem] w-full max-w-md flex flex-col shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {!createdGroup ? (
          <>
            <div className="px-8 py-7 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-black text-gray-900 tracking-tight">새로운 모임 만들기</h2>
              <button
                onClick={handleClose}
                disabled={isSaving}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 disabled:opacity-50"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-7">
              <div className="space-y-3">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">모임 이름</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 대학 동기들, 프로젝트 팀"
                  className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold"
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">설명 (선택)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="모임에 대한 간단한 설명을 입력하세요"
                  className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold h-28 resize-none"
                />
              </div>

              <div className="space-y-4">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">테마 색상</label>
                <div className="flex flex-wrap gap-3">
                  {THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setSelectedTheme(theme.id)}
                      className={`w-11 h-11 rounded-2xl ${theme.color} flex items-center justify-center text-white transition-all hover:scale-110 shadow-lg ${
                        selectedTheme === theme.id ? 'ring-4 ring-indigo-100 scale-110' : 'opacity-80'
                      }`}
                    >
                      {selectedTheme === theme.id && <Check className="w-5 h-5 stroke-[4]" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && <p className="px-8 pb-4 text-xs font-bold text-rose-500 flex items-center gap-1.5"><X className="w-3.5 h-3.5" /> {error}</p>}

            <div className="p-8 bg-gray-50/50 flex gap-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSaving}
                className="flex-1 py-4 bg-white border-2 border-gray-100 text-gray-500 rounded-2xl text-sm font-black hover:bg-gray-100 transition-all disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-[2] px-8 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSaving ? '생성 중…' : '모임 생성하기'}
              </button>
            </div>
          </>
        ) : (
          <div className="p-10 text-center space-y-8 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10 text-indigo-600" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">모임이 생성되었습니다!</h2>
              <p className="text-sm text-gray-500 font-medium">초대 코드나 링크를 친구에게 공유해보세요.</p>
            </div>

            <div className="space-y-5">
              <div className="bg-gray-50 rounded-3xl p-6 space-y-4 border border-gray-100">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">초대 코드</p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-3xl font-black text-indigo-600 tracking-wider">{createdGroup.inviteCode}</span>
                    <button 
                      onClick={() => handleCopy(createdGroup.inviteCode)}
                      className="p-2 hover:bg-white rounded-xl transition-all text-gray-400 hover:text-indigo-600 shadow-sm border border-transparent hover:border-indigo-100"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="h-px bg-gray-100 w-full" />

                <div className="space-y-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-left px-1">초대 링크</p>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[11px] text-gray-400 font-medium truncate text-left">
                      {inviteLink}
                    </div>
                    <button 
                      onClick={() => handleCopy(inviteLink)}
                      className="px-4 bg-gray-900 text-white rounded-xl text-[11px] font-black hover:bg-gray-800 transition-all flex items-center gap-1.5 shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" /> 복사
                    </button>
                  </div>
                </div>
              </div>
              
              {copied && (
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center justify-center gap-1">
                  <Check className="w-3 h-3 stroke-[3]" /> 클립보드에 복사되었습니다
                </p>
              )}
            </div>

            <button
              onClick={handleClose}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
            >
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
