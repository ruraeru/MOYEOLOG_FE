'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Loader2, Check, Camera, Image as ImageIcon, Users } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { convertToWebP } from '@/lib/utils';

interface GroupEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: GroupResponse;
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

export default function GroupEditModal({
  isOpen,
  onClose,
  group,
  onSuccess,
}: GroupEditModalProps) {
  const { data: session } = useSession();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [selectedTheme, setSelectedTheme] = useState(group.colorTheme);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image states
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);

  const profileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    if (isOpen) {
      setName(group.name);
      setDescription(group.description);
      setSelectedTheme(group.colorTheme);
      setProfilePreview(group.profileImage ? (group.profileImage.startsWith('/uploads/') ? `${apiUrl}${group.profileImage}` : group.profileImage) : null);
      setBgPreview(group.backgroundImage ? (group.backgroundImage.startsWith('/uploads/') ? `${apiUrl}${group.backgroundImage}` : group.backgroundImage) : null);
    }
  }, [isOpen, group, apiUrl]);

  const handleProfileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const webpFile = await convertToWebP(file);
      setProfileFile(webpFile);
      const reader = new FileReader();
      reader.onloadend = () => setProfilePreview(reader.result as string);
      reader.readAsDataURL(webpFile);
    }
  };

  const handleBgChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const webpFile = await convertToWebP(file);
      setBgFile(webpFile);
      const reader = new FileReader();
      reader.onloadend = () => setBgPreview(reader.result as string);
      reader.readAsDataURL(webpFile);
    }
  };

  const handleSave = async () => {
    if (session?.user?.id !== group.createdById) {
      setError('모임을 수정할 권한이 없어요');
      return;
    }

    if (!name.trim()) {
      setError('모임 이름을 입력해 주세요');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await groupApi.update(group.id, {
        name,
        description,
        colorTheme: selectedTheme,
        image: profileFile || undefined,
        bgImage: bgFile || undefined,
      }, session);

      onSuccess?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '모임을 수정하지 못했어요');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || (session?.user?.id !== group.createdById)) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-line rounded-2xl w-full max-w-lg flex flex-col shadow-float my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-line flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-ink">모임 정보 수정</h2>
          <button
            onClick={onClose}
            className="btn-ghost"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto no-scrollbar max-h-[70vh]">
          {/* Background Image Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-ink">배경 사진</label>
            <div 
              onClick={() => bgInputRef.current?.click()}
              className="relative h-40 w-full rounded-xl bg-raised border border-dashed border-line-strong overflow-hidden cursor-pointer group"
            >
              {bgPreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bgPreview} alt="Background" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-150 ease-out flex items-center justify-center">
                    <Camera size={18} strokeWidth={1.5} className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-out" />
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-ink-3 group-hover:text-ink-2 transition-colors duration-150 ease-out">
                  <ImageIcon size={18} strokeWidth={1.5} />
                  <span className="text-sm">배경 사진 올리기</span>
                </div>
              )}
              <input type="file" ref={bgInputRef} onChange={handleBgChange} className="hidden" accept="image/*" />
            </div>
          </div>

          {/* Profile Image & Basic Info */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="relative shrink-0 mx-auto md:mx-0">
              <label className="text-sm font-medium text-ink block mb-2">프로필 사진</label>
              <div 
                onClick={() => profileInputRef.current?.click()}
                className="size-32 rounded-2xl bg-raised border border-line overflow-hidden cursor-pointer group relative"
              >
                {profilePreview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={profilePreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-ink-3">
                    <Users size={18} strokeWidth={1.5} />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-150 ease-out flex items-center justify-center">
                  <Camera size={18} strokeWidth={1.5} className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-out" />
                </div>
              </div>
              <input type="file" ref={profileInputRef} onChange={handleProfileChange} className="hidden" accept="image/*" />
            </div>

            <div className="flex-1 w-full space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink">모임 이름</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input"
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
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-ink">소개글</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input h-32 resize-none leading-relaxed"
            />
          </div>

          {error && (
            <div className="px-4 py-3 bg-negative-soft rounded-lg text-negative text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-line flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
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
            {isSaving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
