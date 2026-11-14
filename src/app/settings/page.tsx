'use client';

import React, { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import { 
  User as UserIcon, 
  Bell, 
  Lock, 
  Eye, 
  Globe, 
  LogOut,
  ChevronRight,
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { userApi } from '@/lib/user-api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { convertToWebP } from '@/lib/utils';

// Form Validation Schema
const profileSchema = z.object({
  nickname: z.string().min(2, '닉네임은 최소 2자 이상이어야 합니다.').max(20, '닉네임은 최대 20자까지 가능합니다.'),
  bio: z.string().max(200, '자기소개는 최대 200자까지 가능합니다.').optional().or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const menuItems = [
  { id: 'profile', label: '프로필 설정', icon: UserIcon },
  { id: 'notif', label: '알림 설정', icon: Bell },
  { id: 'security', label: '계정 및 보안', icon: Lock },
  { id: 'display', label: '화면 및 디스플레이', icon: Eye },
  { id: 'language', label: '언어 설정', icon: Globe },
];

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const queryClient = useQueryClient();
  const [activeMenu, setActiveMenu] = useState('profile');
  const [success, setSuccess] = useState(false);

  // Image states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  // React Query: Get User Data
  const { data: userData, isLoading } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: () => userApi.getMe(session),
    enabled: !!session?.user?.accessToken,
  });

  // React Hook Form
  const { 
    register, 
    handleSubmit, 
    reset,
    formState: { errors } 
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nickname: '',
      bio: '',
    }
  });

  // Update form when data is loaded
  useEffect(() => {
    if (userData) {
      reset({
        nickname: userData.nickname,
        bio: userData.bio || '',
      });
    }
  }, [userData, reset]);

  // Handle initial image preview
  useEffect(() => {
    if (userData?.profileImage && !imageFile) {
      const fullImageUrl = userData.profileImage.startsWith('/uploads/') 
        ? `${apiUrl}${userData.profileImage}` 
        : userData.profileImage;
      
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImagePreview(fullImageUrl);
    }
  }, [userData?.profileImage, imageFile, apiUrl]);

  // React Query: Update User Mutation
  const mutation = useMutation({
    mutationFn: (values: ProfileFormValues) => userApi.updateMe({
      nickname: values.nickname,
      bio: values.bio,
      image: imageFile || undefined
    }, session),
    onSuccess: async (updatedUser) => {
      setSuccess(true);
      queryClient.setQueryData(['user', 'me'], updatedUser);
      
      // Update Next-Auth Session
      await updateSession({
        ...session,
        user: {
          ...session?.user,
          name: updatedUser.nickname,
          image: updatedUser.profileImage.startsWith('/uploads/') ? `${apiUrl}${updatedUser.profileImage}` : updatedUser.profileImage
        }
      });

      setTimeout(() => setSuccess(false), 3000);
    }
  });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const webpFile = await convertToWebP(file);
      setImageFile(webpFile);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(webpFile);
    }
  };

  const onFormSubmit = (values: ProfileFormValues) => {
    mutation.mutate(values);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-canvas">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} strokeWidth={1.5} className="animate-spin text-ink-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-canvas text-ink overflow-hidden font-sans">
      <Navbar />
      
      <main className="flex-1 overflow-hidden flex">
        
        {/* Settings Sidebar */}
        <aside className="w-72 bg-surface border-r border-line p-6 flex flex-col gap-6 hidden lg:flex shrink-0">
          <div>
            <h2 className="text-2xl font-semibold text-ink">설정</h2>
            <p className="text-sm text-ink-2 mt-1">앱 환경을 원하는 대로 바꿔 보세요.</p>
          </div>

          <nav className="flex flex-col gap-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveMenu(item.id)}
                className={`flex h-9 items-center justify-between px-3 rounded-lg text-sm transition-colors ${activeMenu === item.id ? 'bg-raised text-ink font-medium' : 'text-ink-2 hover:bg-raised hover:text-ink'}`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={16} strokeWidth={1.5} className={activeMenu === item.id ? 'text-accent' : 'text-ink-3'} />
                  <span>{item.label}</span>
                </div>
                <ChevronRight size={16} strokeWidth={1.5} className={`text-ink-3 ${activeMenu === item.id ? 'opacity-100' : 'opacity-0'}`} />
              </button>
            ))}
          </nav>

          <button 
            onClick={() => signOut({ callbackUrl: '/' })}
            className="mt-auto flex h-9 items-center gap-3 px-3 text-negative hover:bg-negative-soft rounded-lg transition-colors"
          >
            <LogOut size={16} strokeWidth={1.5} />
            <span className="text-sm">로그아웃</span>
          </button>
        </aside>

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-6 lg:p-12">
          <div className="max-w-2xl mx-auto">
            
            {activeMenu === 'profile' && (
              <div className="space-y-8 animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="relative group">
                    <div className="size-28 rounded-full overflow-hidden border border-line relative bg-raised flex items-center justify-center">
                      {imagePreview ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img 
                          src={imagePreview} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserIcon size={32} strokeWidth={1.5} className="text-ink-3" />
                      )}
                    </div>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 size-9 bg-surface text-ink-2 rounded-full flex items-center justify-center border border-line-strong hover:bg-raised transition-colors"
                    >
                      <Camera size={16} strokeWidth={1.5} />
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleImageChange}
                    />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold text-ink">{userData?.nickname}</h3>
                    <p className="text-sm text-ink-2 mt-1 tabular-nums">ID: {userData?.customId}</p>
                    <p className="text-xs text-ink-3 mt-0.5">{userData?.email}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit(onFormSubmit)} className="card space-y-5 p-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink">활동 이름</label>
                    <input 
                      {...register('nickname')}
                      type="text" 
                      placeholder="이름을 입력해 주세요"
                      className={`form-input ${errors.nickname ? '!border-negative' : ''}`}
                    />
                    {errors.nickname && (
                      <p className="text-xs text-negative flex items-center gap-1">
                        <AlertCircle size={16} strokeWidth={1.5} /> {errors.nickname.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink">자기소개</label>
                    <textarea 
                      {...register('bio')}
                      placeholder="자기소개를 적어 보세요"
                      className={`form-input min-h-[120px] resize-none leading-relaxed ${errors.bio ? '!border-negative' : ''}`}
                    />
                    {errors.bio && (
                      <p className="text-xs text-negative flex items-center gap-1">
                        <AlertCircle size={16} strokeWidth={1.5} /> {errors.bio.message}
                      </p>
                    )}
                  </div>

                  {mutation.isError && (
                    <div className="px-4 py-3 bg-negative-soft text-negative text-sm rounded-[10px]">
                      {(mutation.error as Error).message}
                    </div>
                  )}

                  {success && (
                    <div className="px-4 py-3 bg-raised text-ink text-sm rounded-[10px] flex items-center gap-2">
                      <CheckCircle2 size={16} strokeWidth={1.5} className="text-positive" />
                      저장했어요
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button 
                      type="submit"
                      disabled={mutation.isPending}
                      className="btn-primary"
                    >
                      {mutation.isPending ? (
                        <>
                          <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                          저장 중…
                        </>
                      ) : (
                        '저장'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeMenu !== 'profile' && (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                <div className="size-10 bg-raised rounded-full flex items-center justify-center">
                  <Lock size={18} strokeWidth={1.5} className="text-ink-3" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-ink">아직 준비 중이에요</h3>
                  <p className="text-sm text-ink-3">조금만 기다려 주세요.</p>
                </div>
                <button 
                  onClick={() => setActiveMenu('profile')}
                  className="btn-ghost"
                >
                  프로필 설정으로 돌아가기
                </button>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
