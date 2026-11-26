'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Check, Copy } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { groupApi, validateGroupName, GROUP_NAME_MAX, type GroupResponse } from '@/lib/group-api';
import { Modal } from '@/components/ui';
import { THEME_COLORS, type ThemeKey } from '@/lib/constants';
import { convertToWebP, validateImageFile } from '@/lib/utils';
import { useAlert } from '@/hooks/useAlert';
import { GroupAvatar, GroupCover, groupStyle } from '@/components/groups/GroupIdentity';

/** 모임 소개 최대 글자 수(코드 포인트). 백엔드 GroupRequest.description 과 같다 */
export const GROUP_DESC_MAX = 255;

/** 코드 포인트 기준으로 max 자까지 자른다(이모지를 쪼개지 않는다). 카운터·서버 검사와 같은 기준 */
export const clampChars = (value: string, max: number) => {
  const chars = [...value];
  return chars.length > max ? chars.slice(0, max).join('') : value;
};

/**
 * 고른 사진을 검사·변환한다. 형식이 틀리거나 열 수 없는 파일(확장자만 그림인 파일 등)은 고르는 순간 문구를 돌려준다.
 * 저장 때 서버가 거절할 때까지 기다리지 않게 한다.
 */
export async function pickGroupImage(file: File): Promise<{ file: File; preview: string } | { error: string }> {
  const invalid = validateImageFile(file);
  if (invalid) return { error: invalid };
  try {
    if (typeof createImageBitmap === 'function') (await createImageBitmap(file)).close();
  } catch {
    return { error: '사진을 열 수 없어요. JPG, PNG, GIF, WEBP 이미지를 골라 주세요.' };
  }
  const webp = await convertToWebP(file);
  const preview = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(webp);
  });
  return { file: webp, preview };
}

/** 사진 한 줄: 이름·안내 + 지우기·바꾸기(올리기). 새 모임 창과 수정 창에서 쓴다 */
export function PhotoRow({
  label,
  hint,
  hasImage,
  onChange,
  onClear,
  disabled,
}: {
  label: string;
  hint: string;
  hasImage: boolean;
  onChange: () => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink">{label}</p>
        <p className="truncate text-xs text-ink-3">{hint}</p>
      </div>
      {hasImage && (
        <button type="button" onClick={onClear} disabled={disabled} className="btn-ghost btn-sm" aria-label={`${label} 지우기`}>
          지우기
        </button>
      )}
      <button type="button" onClick={onChange} disabled={disabled} className="btn-secondary btn-sm" aria-label={`${label} ${hasImage ? '바꾸기' : '올리기'}`}>
        {hasImage ? '바꾸기' : '올리기'}
      </button>
    </div>
  );
}

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

/** 모임 색 고르기: 원 7개 + 색 이름. 모임 수정 창에서도 쓴다 */
export function ThemeDots({ value, onChange, labelledBy }: { value: string; onChange: (id: ThemeKey) => void; labelledBy?: string }) {
  const keys = Object.keys(THEME_COLORS) as ThemeKey[];
  const groupRef = useRef<HTMLDivElement>(null);
  // radiogroup 키보드: 화살표로 이전·다음 색을 고르고 포커스도 옮긴다. Tab 은 고른 색 하나에만 멈춘다
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const cur = Math.max(0, keys.indexOf(value as ThemeKey));
    const next = keys[(cur + step + keys.length) % keys.length];
    onChange(next);
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-theme-key="${next}"]`)?.focus();
  };
  return (
    <div className="space-y-2">
      {/* 320px 폭에서는 칸이 37px 로 좁아져 4칸씩 두 줄로 놓는다 */}
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={labelledBy ? undefined : '모임 색'}
        aria-labelledby={labelledBy}
        onKeyDown={handleKeyDown}
        className="grid grid-cols-4 gap-1 min-[360px]:grid-cols-7"
      >
        {keys.map((id) => {
          const on = value === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              data-theme-key={id}
              aria-checked={on}
              aria-label={THEME_LABELS[id]}
              tabIndex={on || (!keys.includes(value as ThemeKey) && id === keys[0]) ? 0 : -1}
              onClick={() => onChange(id)}
              className={`flex flex-col items-center gap-1 rounded-lg py-1.5 transition-colors duration-150 ease-out ${
                on ? 'bg-raised' : 'hover:bg-raised'
              }`}
            >
              <span
                className={`flex size-8 items-center justify-center rounded-full ${on ? 'shadow-[inset_0_0_0_1.5px_var(--ink)]' : ''}`}
              >
                <span className="size-6 rounded-full" style={{ backgroundColor: THEME_COLORS[id].hex }} />
              </span>
              <span className={`text-xs ${on ? 'font-medium text-ink' : 'text-ink-3'}`}>{THEME_LABELS[id]}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-ink-3">모임 화면의 탭·표지·일정 표시에 쓰여요</p>
    </div>
  );
}

/**
 * 모임 머리 미리보기: 표지 + 모임 얼굴 + 이름. 고른 색·사진이 바로 반영된다.
 * 모임 상세 머리와 같은 모양(표지 띠 아래로 얼굴이 걸친다)을 작게 그린다.
 */
export function GroupHeadPreview({
  name,
  theme,
  profileSrc,
  coverSrc,
  meta,
  compact = false,
}: {
  name: string;
  theme: string;
  profileSrc?: string | null;
  coverSrc?: string | null;
  meta?: React.ReactNode;
  compact?: boolean;
}) {
  const shown = name.trim() || '모임 이름';
  return (
    <div style={groupStyle(theme)} className="overflow-hidden rounded-xl border border-line bg-surface">
      <GroupCover src={coverSrc} theme={theme} className={compact ? 'h-16' : 'h-28'} />
      <div className="relative flex items-end gap-3 px-4 pb-3">
        <GroupAvatar
          name={name.trim()}
          src={profileSrc}
          theme={theme}
          size={compact ? 'md' : 'lg'}
          className={`ring-4 ring-surface ${compact ? '-mt-5' : '-mt-7'}`}
        />
        <div className="min-w-0 flex-1 pb-0.5">
          <p className={`truncate font-display ${compact ? 'text-base' : 'text-xl'} ${name.trim() ? 'text-ink' : 'text-ink-3'}`}>
            {shown}
          </p>
          {meta && <p className="truncate text-xs text-ink-3">{meta}</p>}
        </div>
      </div>
      {!compact && (
        <div aria-hidden className="flex gap-4 border-t border-line px-4 text-[13px]">
          {/* 모임 화면의 탭 순서(공지·일정·메모·토픽·멤버) 앞쪽과 같게 */}
          <span className="relative py-2 font-display text-ink">
            공지
            <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-group" />
          </span>
          <span className="py-2 font-medium text-ink-3">일정</span>
          <span className="py-2 font-medium text-ink-3">메모</span>
          <span className="ml-auto flex items-center gap-1.5 py-2 text-ink-2">
            <span className="size-2 rounded-full bg-group" />
            <span className="stamp">오늘 19:00</span>
          </span>
        </div>
      )}
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
  const { confirm } = useAlert();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('indigo');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdGroup, setCreatedGroup] = useState<GroupResponse | null>(null);
  const [copied, setCopied] = useState(false);
  // 사진은 만든 직후 모임 수정 API 로 올린다(만들기 API 는 JSON 만 받는다)
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const confirmingRef = useRef(false);

  // 오류가 생기면 보이는 곳으로 스크롤한다(모바일 바텀시트에서 아래에 생겨 안 보이는 일이 없게)
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [error]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setSelectedTheme('indigo');
    setError(null);
    setCreatedGroup(null);
    setCopied(false);
    setProfileFile(null);
    setBgFile(null);
    setProfilePreview(null);
    setBgPreview(null);
    setPhotoError(null);
  };

  const isDirty = !createdGroup && (!!name.trim() || !!description.trim() || !!profileFile || !!bgFile || selectedTheme !== 'indigo');

  const handleClose = async () => {
    if (isSaving || confirmingRef.current) return;
    // 바깥 클릭·Esc·취소로 쓰던 내용이 말없이 사라지지 않게 묻는다
    if (isDirty) {
      confirmingRef.current = true;
      const ok = await confirm('적은 내용은 저장되지 않아요.', '모임 만들기를 그만둘까요?', '그만두기', '계속 쓰기');
      confirmingRef.current = false;
      if (!ok) return;
    }
    resetForm();
    onClose();
  };

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>, kind: 'profile' | 'bg') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const picked = await pickGroupImage(file);
    if ('error' in picked) {
      setError(picked.error);
      return;
    }
    setError(null);
    if (kind === 'profile') {
      setProfileFile(picked.file);
      setProfilePreview(picked.preview);
    } else {
      setBgFile(picked.file);
      setBgPreview(picked.preview);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    const nameError = validateGroupName(name);
    if (nameError) {
      setError(nameError);
      nameRef.current?.focus();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      let group = await groupApi.create({
        name: name.trim(),
        description,
        colorTheme: selectedTheme,
      }, session);

      if (profileFile || bgFile) {
        try {
          group = await groupApi.update(group.id, {
            name: group.name,
            description: group.description ?? '',
            colorTheme: group.colorTheme,
            image: profileFile || undefined,
            bgImage: bgFile || undefined,
          }, session);
        } catch (e) {
          // 모임은 만들어졌다. 사진만 실패했음을 완료 화면에 알린다
          setPhotoError(e instanceof Error ? e.message : '사진을 올리지 못했어요');
        }
      }

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
  const nameLen = [...name.trim()].length;
  const descLen = [...description].length;

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      size="sm"
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
          <GroupHeadPreview name={name} theme={selectedTheme} profileSrc={profilePreview} coverSrc={bgPreview} compact />

          <div className="space-y-1.5">
            <label htmlFor="group-create-name" className="block text-[13px] font-medium text-ink">모임 이름</label>
            <input
              id="group-create-name"
              ref={nameRef}
              type="text"
              autoFocus
              value={name}
              onChange={(e) => { setName(clampChars(e.target.value, GROUP_NAME_MAX)); setError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); handleSave(); } }}
              placeholder="예: 대학 동기들, 프로젝트 팀"
              aria-describedby="group-create-name-count"
              className="form-input"
            />
            <p id="group-create-name-count" className={`text-xs text-right tabular-nums ${nameLen >= GROUP_NAME_MAX ? 'text-ink-2' : 'text-ink-3'}`}>
              {nameLen}/{GROUP_NAME_MAX}
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="group-create-desc" className="block text-[13px] font-medium text-ink">소개 <span className="font-normal text-ink-3">(선택)</span></label>
            <textarea
              id="group-create-desc"
              value={description}
              onChange={(e) => { setDescription(clampChars(e.target.value, GROUP_DESC_MAX)); setError(null); }}
              placeholder="모임을 간단히 소개해 주세요"
              aria-describedby="group-create-desc-count"
              className="form-input h-24 resize-none"
            />
            <p id="group-create-desc-count" className={`text-xs text-right tabular-nums ${descLen >= GROUP_DESC_MAX ? 'text-ink-2' : 'text-ink-3'}`}>
              {descLen}/{GROUP_DESC_MAX}
            </p>
          </div>

          <div className="space-y-2">
            <p id="group-create-theme" className="text-[13px] font-medium text-ink">모임 색</p>
            <ThemeDots value={selectedTheme} onChange={setSelectedTheme} labelledBy="group-create-theme" />
          </div>

          <div className="space-y-2">
            <p className="text-[13px] font-medium text-ink">사진 <span className="font-normal text-ink-3">(선택)</span></p>
            <div className="divide-y divide-line rounded-xl border border-line">
              <PhotoRow
                label="표지 사진"
                hint={bgFile ? '새 사진을 골랐어요' : '없으면 모임 색 줄무늬로 보여요'}
                hasImage={!!bgPreview}
                onChange={() => bgInputRef.current?.click()}
                onClear={() => { setBgFile(null); setBgPreview(null); }}
                disabled={isSaving}
              />
              <PhotoRow
                label="프로필 사진"
                hint={profileFile ? '새 사진을 골랐어요' : '없으면 모임 색 바탕에 이름 첫 글자로 보여요'}
                hasImage={!!profilePreview}
                onChange={() => profileInputRef.current?.click()}
                onClear={() => { setProfileFile(null); setProfilePreview(null); }}
                disabled={isSaving}
              />
              <input type="file" ref={bgInputRef} onChange={(e) => handlePick(e, 'bg')} className="hidden" accept="image/jpeg,image/png,image/gif,image/webp" />
              <input type="file" ref={profileInputRef} onChange={(e) => handlePick(e, 'profile')} className="hidden" accept="image/jpeg,image/png,image/gif,image/webp" />
            </div>
          </div>

          {error && <p ref={errorRef} role="alert" className="text-sm text-negative">{error}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-2">초대 코드나 링크를 친구에게 보내 보세요. 받은 사람은 모임 목록의 &lsquo;초대 코드&rsquo;에 코드를 넣으면 돼요.</p>

          {photoError && (
            <p role="alert" className="rounded-lg bg-negative-soft px-3 py-2.5 text-sm text-negative">
              모임은 만들었지만 사진을 올리지 못했어요({photoError}). 모임 화면의 설정에서 다시 올려 주세요.
            </p>
          )}

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
