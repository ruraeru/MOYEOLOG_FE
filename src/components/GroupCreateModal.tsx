'use client';

import React, { useState } from 'react';
import { Loader2, Check, Copy } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { groupApi, validateGroupName, GROUP_NAME_MAX, type GroupResponse } from '@/lib/group-api';
import { Modal } from '@/components/ui';
import { THEME_COLORS, type ThemeKey } from '@/lib/constants';

interface GroupCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** 완료 화면의 '모임으로 가기' */
  onOpenGroup?: (groupId: string) => void;
}

const THEME_LABELS: Record<ThemeKey, string> = {
  indigo: '갈색',
  blue: '파랑',
  emerald: '초록',
  orange: '주황',
  rose: '분홍',
  amber: '노랑',
  purple: '보라',
};

/** 모임 색 고르기: 점 7개. 모임 수정 창에서도 쓴다 */
export function ThemeDots({ value, onChange }: { value: string; onChange: (id: ThemeKey) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(Object.keys(THEME_COLORS) as ThemeKey[]).map((id) => {
        const on = value === id;
        return (
          <button
            key={id}
            type="button"
            aria-label={`테마 색상 ${id}`}
            aria-pressed={on}
            title={THEME_LABELS[id]}
            onClick={() => onChange(id)}
            className={`flex size-8 items-center justify-center rounded-full transition-colors duration-150 ease-out ${
              on ? 'shadow-[inset_0_0_0_1.5px_var(--ink)]' : 'hover:bg-raised'
            }`}
          >
            <span className="size-5 rounded-full" style={{ backgroundColor: THEME_COLORS[id].hex }} />
          </button>
        );
      })}
    </div>
  );
}

export default function GroupCreateModal({
  isOpen,
  onClose,
  onSuccess,
  onOpenGroup,
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
    const nameError = validateGroupName(name);
    if (nameError) {
      setError(nameError);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const group = await groupApi.create({
        name: name.trim(),
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
    <Modal
      open={isOpen}
      onClose={handleClose}
      size="sm"
      zIndex="z-50"
      title={createdGroup ? '모임을 만들었어요' : '새 모임 만들기'}
      subtitle={createdGroup ? createdGroup.name : undefined}
      footer={
        !createdGroup ? (
          <>
            <button type="button" onClick={handleClose} disabled={isSaving} className="btn-secondary">
              취소
            </button>
            <button type="button" onClick={handleSave} disabled={isSaving} className="btn-primary">
              {isSaving && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
              {isSaving ? '만드는 중…' : '모임 만들기'}
            </button>
          </>
        ) : (
          <>
            <button onClick={handleClose} className="btn-secondary">
              닫기
            </button>
            {onOpenGroup && (
              <button
                onClick={() => {
                  const id = createdGroup.id;
                  handleClose();
                  onOpenGroup(id);
                }}
                className="btn-primary"
              >
                모임으로 가기
              </button>
            )}
          </>
        )
      }
    >
      {!createdGroup ? (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-ink">모임 이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 대학 동기들, 프로젝트 팀"
              className="form-input"
            />
            <p className={`text-xs text-right tabular-nums ${[...name.trim()].length > GROUP_NAME_MAX ? 'text-negative' : 'text-ink-3'}`}>
              {[...name.trim()].length}/{GROUP_NAME_MAX}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-ink">설명 <span className="font-normal text-ink-3">(선택)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="모임에 대한 간단한 설명을 적어 주세요"
              className="form-input h-24 resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-ink">모임 색</label>
            <ThemeDots value={selectedTheme} onChange={setSelectedTheme} />
          </div>

          {error && <p className="text-sm text-negative">{error}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-2">초대 코드나 링크를 친구에게 보내 보세요. 받은 사람은 모임 화면의 &lsquo;초대 코드로 참여&rsquo;에 코드를 넣으면 돼요.</p>

          <div className="rounded-xl bg-raised p-4 space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-ink-3">초대 코드</p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-2xl font-semibold tabular-nums text-ink">{createdGroup.inviteCode}</span>
                <button onClick={() => handleCopy(createdGroup.inviteCode)} aria-label="초대 코드 복사" className="btn-icon">
                  <Copy size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>

            <div className="h-px w-full bg-line" />

            <div className="space-y-1.5">
              <p className="text-xs text-ink-3">초대 링크</p>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0 flex items-center rounded-[10px] border border-line-strong bg-surface px-3 h-9 text-xs text-ink-2">
                  <span className="truncate">{inviteLink}</span>
                </div>
                <button onClick={() => handleCopy(inviteLink)} className="btn-secondary shrink-0">
                  <Copy size={16} strokeWidth={1.5} /> 복사
                </button>
              </div>
            </div>
          </div>

          {copied && (
            <p className="text-xs text-positive flex items-center gap-1">
              <Check size={16} strokeWidth={1.5} /> 클립보드에 복사했어요
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
