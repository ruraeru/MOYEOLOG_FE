'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Loader2, Check, Camera, Image as ImageIcon, Users } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { groupApi, type GroupResponse } from '@/lib/group-api';

interface GroupEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: GroupResponse;
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

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setProfilePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleBgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBgFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setBgPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('모임 이름을 입력해주세요.');
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
      setError(e instanceof Error ? e.message : '모임 수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[2.5rem] w-full max-w-lg flex flex-col shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <ImageIcon className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">모임 정보 수정</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto no-scrollbar max-h-[70vh]">
          {/* Background Image Upload */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">배경 사진</label>
            <div 
              onClick={() => bgInputRef.current?.click()}
              className="relative h-40 w-full rounded-[2rem] bg-gray-50 border-2 border-dashed border-gray-200 overflow-hidden cursor-pointer group"
            >
              {bgPreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bgPreview} alt="Background" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-all flex items-center justify-center">
                    <Camera className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100" />
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400 group-hover:text-indigo-500 transition-colors">
                  <ImageIcon className="w-8 h-8" />
                  <span className="text-xs font-bold">배경 사진 업로드</span>
                </div>
              )}
              <input type="file" ref={bgInputRef} onChange={handleBgChange} className="hidden" accept="image/*" />
            </div>
          </div>

          {/* Profile Image & Basic Info */}
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="relative shrink-0 mx-auto md:mx-0">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 block mb-3">프로필 사진</label>
              <div 
                onClick={() => profileInputRef.current?.click()}
                className="w-32 h-32 rounded-[2.5rem] bg-indigo-50 border-4 border-white shadow-xl overflow-hidden cursor-pointer group relative"
              >
                {profilePreview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={profilePreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-indigo-300">
                    <Users className="w-12 h-12" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-all" />
                </div>
              </div>
              <input type="file" ref={profileInputRef} onChange={handleProfileChange} className="hidden" accept="image/*" />
            </div>

            <div className="flex-1 w-full space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">모임 이름</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3.5 text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">테마 색상</label>
                <div className="flex flex-wrap gap-3">
                  {THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setSelectedTheme(theme.id)}
                      className={`w-9 h-9 rounded-xl ${theme.color} flex items-center justify-center text-white transition-all hover:scale-110 shadow-sm ${
                        selectedTheme === theme.id ? 'ring-4 ring-indigo-100 scale-110' : 'opacity-70'
                      }`}
                    >
                      {selectedTheme === theme.id && <Check className="w-4 h-4 stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">소개글</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-50 border-2 border-transparent rounded-3xl px-6 py-4 text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold h-32 resize-none leading-relaxed"
            />
          </div>

          {error && (
            <div className="p-4 bg-rose-50 rounded-2xl text-rose-600 text-xs font-bold border border-rose-100">
              {error}
            </div>
          )}
        </div>

        <div className="p-8 bg-gray-50/50 flex gap-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
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
            {isSaving ? '저장 중…' : '정보 저장하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
