'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { groupApi, validateGroupName, GROUP_NAME_MAX, type GroupResponse } from '@/lib/group-api';
import { getFileUrl } from '@/lib/utils';
import { Modal } from '@/components/ui';
import { ThemeDots, GroupHeadPreview, PhotoRow, pickGroupImage, clampChars, GROUP_DESC_MAX } from '@/components/GroupCreateModal';
import { useAlert } from '@/hooks/useAlert';

interface GroupEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: GroupResponse;
  onSuccess?: () => void;
  /** 모임을 삭제한 뒤 호출 (목록으로 이동 등) */
  onDeleted?: () => void;
  /** 모임 머리의 '표지 바꾸기'에서 먼저 고른 표지 사진. 열리자마자 새 표지로 들어간다 */
  initialBgFile?: File | null;
}

export default function GroupEditModal({
  isOpen,
  onClose,
  group,
  onSuccess,
  onDeleted,
  initialBgFile,
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
  const errorRef = useRef<HTMLParagraphElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const confirmingRef = useRef(false);

  // 오류는 본문 맨 아래에 생긴다. 스크롤해서 보이게 한다(전에는 화면 밖에 생겨 저장이 무반응처럼 보였다)
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [error]);

  // 고른 사진을 검사한다. 열 수 없는 파일은 고르는 순간 알려 주고 미리보기에 넣지 않는다
  const applyPicked = async (file: File, kind: 'profile' | 'bg') => {
    const picked = await pickGroupImage(file);
    if ('error' in picked) {
      setError(picked.error);
      return;
    }
    setError(null);
    if (kind === 'profile') {
      setProfileFile(picked.file);
      setRemoveProfile(false);
      setProfilePreview(picked.preview);
    } else {
      setBgFile(picked.file);
      setRemoveBg(false);
      setBgPreview(picked.preview);
    }
  };

  const handleProfileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 같은 파일을 다시 골라도 change 가 일어나게
    e.target.value = '';
    if (file) await applyPicked(file, 'profile');
  };

  const handleBgChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await applyPicked(file, 'bg');
  };

  // '표지 바꾸기'로 먼저 고른 사진을 한 번만 넣는다
  const initialBgApplied = useRef(false);
  useEffect(() => {
    if (initialBgFile && !initialBgApplied.current) {
      initialBgApplied.current = true;
      void applyPicked(initialBgFile, 'bg');
    }
  }, [initialBgFile]);

  const isDirty =
    name !== group.name ||
    description !== (group.description ?? '') ||
    selectedTheme !== group.colorTheme ||
    !!profileFile || !!bgFile || removeProfile || removeBg;

  // 바깥 클릭·Esc·취소: 바꾼 것이 있으면 버릴지 묻는다
  const handleClose = async () => {
    if (isSaving || isDeleting || confirmingRef.current) return;
    if (isDirty) {
      confirmingRef.current = true;
      const ok = await confirm('바꾼 내용은 저장되지 않아요.', '수정을 그만둘까요?', '그만두기', '계속 고치기');
      confirmingRef.current = false;
      if (!ok) return;
    }
    onClose();
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
      nameRef.current?.focus();
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
    // 제목은 짧게(긴 이름이 제목에 들어가 '삭제할까/요?'로 끊기던 것), 모임 이름은 본문 첫 줄에
    const ok = await confirm(
      `'${group.name}'\n모임의 토픽과 댓글도 함께 지워지고, 되돌릴 수 없어요. 모임 메모와 일정은 작성자의 개인 메모·일정으로 남아요.`,
      '이 모임을 삭제할까요?',
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
      onClose={handleClose}
      size="md"
      zIndex="z-[120]"
      title="모임 정보 수정"
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
          <button type="button" onClick={handleClose} disabled={isSaving} className="btn-secondary">
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
          <input type="file" ref={bgInputRef} onChange={handleBgChange} className="hidden" accept="image/jpeg,image/png,image/gif,image/webp" />
          <input type="file" ref={profileInputRef} onChange={handleProfileChange} className="hidden" accept="image/jpeg,image/png,image/gif,image/webp" />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="group-edit-name" className="text-[13px] font-medium text-ink block">모임 이름</label>
          <input
            id="group-edit-name"
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => { setName(clampChars(e.target.value, GROUP_NAME_MAX)); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); handleSave(); } }}
            aria-describedby="group-edit-name-count"
            className="form-input"
          />
          <p id="group-edit-name-count" className={`text-xs text-right tabular-nums ${[...name.trim()].length >= GROUP_NAME_MAX ? 'text-ink-2' : 'text-ink-3'}`}>
            {[...name.trim()].length}/{GROUP_NAME_MAX}
          </p>
        </div>

        <div className="space-y-2">
          <p id="group-edit-theme" className="text-[13px] font-medium text-ink">모임 색</p>
          <ThemeDots value={selectedTheme} onChange={setSelectedTheme} labelledBy="group-edit-theme" />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="group-edit-desc" className="text-[13px] font-medium text-ink block">소개</label>
          <textarea
            id="group-edit-desc"
            value={description}
            onChange={(e) => { setDescription(clampChars(e.target.value, GROUP_DESC_MAX)); setError(null); }}
            aria-describedby="group-edit-desc-count"
            className="form-input h-28 resize-none leading-relaxed"
          />
          <p id="group-edit-desc-count" className={`text-xs text-right tabular-nums ${[...description].length >= GROUP_DESC_MAX ? 'text-ink-2' : 'text-ink-3'}`}>
            {[...description].length}/{GROUP_DESC_MAX}
          </p>
        </div>

        {error && (
          <p ref={errorRef} role="alert" className="rounded-lg bg-negative-soft px-3 py-2.5 text-sm text-negative">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

