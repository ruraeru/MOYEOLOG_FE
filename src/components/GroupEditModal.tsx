'use client';

import React, { useState, useRef } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { groupApi, validateGroupName, GROUP_NAME_MAX, type GroupResponse } from '@/lib/group-api';
import { convertToWebP, getFileUrl } from '@/lib/utils';
import { Modal } from '@/components/ui';
import { ThemeDots, GroupHeadPreview } from '@/components/GroupCreateModal';
import { useAlert } from '@/hooks/useAlert';

interface GroupEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: GroupResponse;
  onSuccess?: () => void;
  /** 모임을 삭제한 뒤 호출 (목록으로 이동 등) */
  onDeleted?: () => void;
}

export default function GroupEditModal({
  isOpen,
  onClose,
  group,
  onSuccess,
  onDeleted,
}: GroupEditModalProps) {
  const { data: session } = useSession();
  const { confirm, toast } = useAlert();
  const [isDeleting, setIsDeleting] = useState(false);
  const isOwner = group.myRole ? group.myRole === 'OWNER' : session?.user?.id === group.createdById;
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? '');
  const [selectedTheme, setSelectedTheme] = useState(group.colorTheme);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image states
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [bgFile, setBgFile] = useState<File | null>(null);
  // 모달은 열릴 때마다 새로 마운트되므로(GroupModals) 현재 모임 값으로 시작한다
  const [profilePreview, setProfilePreview] = useState<string | null>(() => getFileUrl(group.profileImage));
  const [bgPreview, setBgPreview] = useState<string | null>(() => getFileUrl(group.backgroundImage));
  // '지우기'를 누른 사진. 저장할 때 removeProfileImage / removeBackgroundImage 로 보낸다
  const [removeProfile, setRemoveProfile] = useState(false);
  const [removeBg, setRemoveBg] = useState(false);

  const profileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const handleProfileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const webpFile = await convertToWebP(file);
      setProfileFile(webpFile);
      setRemoveProfile(false);
      const reader = new FileReader();
      reader.onloadend = () => setProfilePreview(reader.result as string);
      reader.readAsDataURL(webpFile);
    }
    // 같은 파일을 다시 골라도 change 가 일어나게
    e.target.value = '';
  };

  const handleBgChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const webpFile = await convertToWebP(file);
      setBgFile(webpFile);
      setRemoveBg(false);
      const reader = new FileReader();
      reader.onloadend = () => setBgPreview(reader.result as string);
      reader.readAsDataURL(webpFile);
    }
    e.target.value = '';
  };

  const clearProfile = () => {
    setProfileFile(null);
    setProfilePreview(null);
    setRemoveProfile(!!group.profileImage);
  };

  const clearBg = () => {
    setBgFile(null);
    setBgPreview(null);
    setRemoveBg(!!group.backgroundImage);
  };

  const handleSave = async () => {
    if (!isOwner) {
      setError('모임을 수정할 권한이 없어요');
      return;
    }

    const nameError = validateGroupName(name);
    if (nameError) {
      setError(nameError);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await groupApi.update(group.id, {
        name: name.trim(),
        description,
        colorTheme: selectedTheme,
        image: profileFile || undefined,
        bgImage: bgFile || undefined,
        removeProfileImage: removeProfile && !profileFile,
        removeBackgroundImage: removeBg && !bgFile,
      }, session);

      toast.success('모임 정보를 저장했어요');
      onSuccess?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '모임을 수정하지 못했어요');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isOwner || isDeleting) return;
    const ok = await confirm(
      '모임의 토픽과 댓글도 함께 지워지고, 되돌릴 수 없어요. 모임 메모와 일정은 작성자의 개인 메모·일정으로 남아요.',
      `'${group.name}' 모임을 삭제할까요?`,
      '삭제',
      '취소',
    );
    if (!ok) return;
    setIsDeleting(true);
    setError(null);
    try {
      await groupApi.remove(group.id, session);
      toast.success('모임을 삭제했어요');
      onClose();
      onDeleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '모임을 삭제하지 못했어요');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !isOwner) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="md"
      zIndex="z-[120]"
      title="모임 정보 수정"
      bodyClassName="no-scrollbar"
      footer={
        <>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSaving || isDeleting}
            className="btn-danger mr-auto"
          >
            {isDeleting ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Trash2 size={16} strokeWidth={1.5} />}
            모임 삭제
          </button>
          <button type="button" onClick={onClose} disabled={isSaving} className="btn-secondary">
            취소
          </button>
          <button type="button" onClick={handleSave} disabled={isSaving} className="btn-primary">
            {isSaving && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
            {isSaving ? '저장 중…' : '저장'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* 미리보기: 고른 색·사진이 바로 반영된다 */}
        <div className="space-y-1.5">
          <p className="text-xs text-ink-3">미리보기</p>
          <GroupHeadPreview
            name={name}
            theme={selectedTheme}
            profileSrc={profilePreview}
            coverSrc={bgPreview}
            meta={`멤버 ${group.memberCount}명`}
          />
        </div>

        {/* 사진: 바꾸기 · 지우기 */}
        <div className="divide-y divide-line rounded-xl border border-line">
          <PhotoRow
            label="표지 사진"
            hint={bgPreview ? (bgFile ? '새 사진을 골랐어요' : '모임 화면 맨 위에 보여요') : '없으면 모임 색 줄무늬로 보여요'}
            hasImage={!!bgPreview}
            onChange={() => bgInputRef.current?.click()}
            onClear={clearBg}
            disabled={isSaving}
          />
          <PhotoRow
            label="프로필 사진"
            hint={profilePreview ? (profileFile ? '새 사진을 골랐어요' : '모임 목록과 모임 고르기에 보여요') : '없으면 모임 색 바탕에 이름 첫 글자로 보여요'}
            hasImage={!!profilePreview}
            onChange={() => profileInputRef.current?.click()}
            onClear={clearProfile}
            disabled={isSaving}
          />
          <input type="file" ref={bgInputRef} onChange={handleBgChange} className="hidden" accept="image/*" />
          <input type="file" ref={profileInputRef} onChange={handleProfileChange} className="hidden" accept="image/*" />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="group-edit-name" className="text-[13px] font-medium text-ink block">모임 이름</label>
          <input
            id="group-edit-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-input"
          />
          <p className={`text-xs text-right tabular-nums ${[...name.trim()].length > GROUP_NAME_MAX ? 'text-negative' : 'text-ink-3'}`}>
            {[...name.trim()].length}/{GROUP_NAME_MAX}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-[13px] font-medium text-ink">모임 색</p>
          <ThemeDots value={selectedTheme} onChange={setSelectedTheme} />
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-ink">소개글</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="form-input h-28 resize-none leading-relaxed"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-negative-soft px-3 py-2.5 text-sm text-negative">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function PhotoRow({
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
