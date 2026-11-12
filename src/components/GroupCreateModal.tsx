'use client';

import React, { useState } from 'react';
import { X, Loader2, Check, Copy } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { groupApi, type GroupResponse } from '@/lib/group-api';

interface GroupCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const THEMES = [
  { id: 'indigo', color: 'bg-accent' },
  { id: 'blue', color: 'bg-sky-500' },
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
      setError('모임 이름을 입력해 주세요');
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
      setError(e instanceof Error ? e.message : '모임을 만들지 못했어요');
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-surface border border-line rounded-2xl w-full max-w-md flex flex-col shadow-float overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {!createdGroup ? (
          <>
            <div className="px-6 py-4 border-b border-line flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">새 모임 만들기</h2>
              <button
                onClick={handleClose}
                disabled={isSaving}
                className="btn-ghost"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink">모임 이름</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 대학 동기들, 프로젝트 팀"
                  className="form-input"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-ink">설명 <span className="font-normal text-ink-3">(선택)</span></label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="모임에 대한 간단한 설명을 적어 주세요"
                  className="form-input h-28 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-ink">테마 색상</label>
                <div className="flex flex-wrap gap-3">
                  {THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setSelectedTheme(theme.id)}
                      className={`size-8 rounded-lg ${theme.color} flex items-center justify-center text-white transition-[transform,opacity] duration-150 ease-out active:scale-[0.98] ${
                        selectedTheme === theme.id ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {selectedTheme === theme.id && <Check size={16} strokeWidth={1.5} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && <p className="px-6 pb-4 text-sm text-negative flex items-center gap-2"><X size={16} strokeWidth={1.5} /> {error}</p>}

            <div className="px-6 py-4 border-t border-line flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSaving}
                className="btn-secondary"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="btn-primary"
              >
                {isSaving && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
                {isSaving ? '만드는 중…' : '모임 만들기'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-6 text-center space-y-5">
              <div className="size-10 bg-raised rounded-full flex items-center justify-center mx-auto">
                <Check size={18} strokeWidth={1.5} className="text-positive" />
              </div>

              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-ink">모임을 만들었어요</h2>
                <p className="text-sm text-ink-2">초대 코드나 링크를 친구에게 보내 보세요</p>
              </div>

              <div className="bg-raised rounded-xl p-4 space-y-4 text-left">
                <div className="space-y-1">
                  <p className="text-xs text-ink-3">초대 코드</p>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-2xl font-mono font-semibold text-ink">{createdGroup.inviteCode}</span>
                    <button 
                      onClick={() => handleCopy(createdGroup.inviteCode)}
                      className="btn-ghost size-9 !px-0"
                    >
                      <Copy size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>

                <div className="h-px bg-line w-full" />

                <div className="space-y-2">
                  <p className="text-xs text-ink-3">초대 링크</p>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-surface border border-line rounded-lg px-3 py-2 text-xs text-ink-2 truncate">
                      {inviteLink}
                    </div>
                    <button 
                      onClick={() => handleCopy(inviteLink)}
                      className="btn-secondary h-9 shrink-0"
                    >
                      <Copy size={16} strokeWidth={1.5} /> 복사
                    </button>
                  </div>
                </div>
              </div>
              
              {copied && (
                <p className="text-xs text-positive flex items-center justify-center gap-1">
                  <Check size={16} strokeWidth={1.5} /> 클립보드에 복사했어요
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-line flex justify-end gap-2">
              <button
                onClick={handleClose}
                className="btn-primary"
              >
                확인
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
