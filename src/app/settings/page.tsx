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

// Form Validation Schema
const profileSchema = z.object({
  nickname: z.string().min(2, '닉네임은 최소 2자 이상이어야 합니다.').max(20, '닉네임은 최대 20자까지 가능합니다.'),
  bio: z.string().max(200, '자기소개는 최대 200자까지 가능합니다.').optional().or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const menuItems = [
  { id: 'profile', label: '프로필 설정', icon: UserIcon, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'notif', label: '알림 설정', icon: Bell, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { id: 'security', label: '계정 및 보안', icon: Lock, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 'display', label: '화면 및 디스플레이', icon: Eye, color: 'text-orange-500', bg: 'bg-orange-50' },
  { id: 'language', label: '언어 설정', icon: Globe, color: 'text-gray-500', bg: 'bg-gray-50' },
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
    queryFn: () => userApi.getMe(),
    enabled: !!session,
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
    }),
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const onFormSubmit = (values: ProfileFormValues) => {
    mutation.mutate(values);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-[#F8F9FB]">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FB] text-gray-900 overflow-hidden font-sans">
      <Navbar />
      
      <main className="flex-1 overflow-hidden flex">
        
        {/* Settings Sidebar */}
        <aside className="w-80 bg-white border-r border-gray-100 p-8 flex flex-col gap-8 hidden lg:flex shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">설정</h2>
            <p className="text-sm text-gray-400 mt-1 font-medium">앱 환경을 원하는 대로 관리하세요.</p>
          </div>

          <nav className="flex flex-col gap-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveMenu(item.id)}
                className={`flex items-center justify-between p-3.5 rounded-2xl transition-all ${activeMenu === item.id ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center`}>
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <span className="text-sm font-bold">{item.label}</span>
                </div>
                <ChevronRight className={`w-4 h-4 ${activeMenu === item.id ? 'opacity-100' : 'opacity-0'}`} />
              </button>
            ))}
          </nav>

          <button 
            onClick={() => signOut({ callbackUrl: '/' })}
            className="mt-auto flex items-center gap-3 p-3.5 text-red-500 font-bold hover:bg-red-50 rounded-2xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm">로그아웃</span>
          </button>
        </aside>

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-8 lg:p-16">
          <div className="max-w-2xl mx-auto">
            
            {activeMenu === 'profile' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex flex-col items-center gap-6 text-center">
                  <div className="relative group">
                    <div className="w-36 h-32 md:w-32 md:h-32 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-xl relative bg-indigo-50 flex items-center justify-center">
                      {imagePreview ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img 
                          src={imagePreview} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserIcon className="w-12 h-12 text-indigo-200" />
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
                    </div>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 w-11 h-11 bg-indigo-600 text-white rounded-2xl flex items-center justify-center border-4 border-[#F8F9FB] hover:bg-indigo-700 transition-all shadow-lg"
                    >
                      <Camera className="w-5 h-5" />
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
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">{userData?.nickname}</h3>
                    <p className="text-sm text-gray-400 font-bold tracking-widest uppercase mt-1">ID: {userData?.customId}</p>
                    <p className="text-xs text-gray-400 font-medium mt-1">{userData?.email}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-8 bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-gray-100">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">활동 이름</label>
                    <input 
                      {...register('nickname')}
                      type="text" 
                      placeholder="이름을 입력하세요"
                      className={`w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-sm outline-none transition-all font-bold ${errors.nickname ? 'border-rose-300 focus:border-rose-500' : 'border-transparent focus:border-indigo-500 focus:bg-white'}`}
                    />
                    {errors.nickname && (
                      <p className="text-[10px] text-rose-500 font-bold px-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {errors.nickname.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">자기소개</label>
                    <textarea 
                      {...register('bio')}
                      placeholder="자기소개를 입력해보세요"
                      className={`w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-sm outline-none transition-all font-bold min-h-[140px] resize-none leading-relaxed ${errors.bio ? 'border-rose-300 focus:border-rose-500' : 'border-transparent focus:border-indigo-500 focus:bg-white'}`}
                    />
                    {errors.bio && (
                      <p className="text-[10px] text-rose-500 font-bold px-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {errors.bio.message}
                      </p>
                    )}
                  </div>

                  {mutation.isError && (
                    <div className="p-4 bg-rose-50 text-rose-600 text-xs font-bold rounded-2xl border border-rose-100">
                      {(mutation.error as Error).message}
                    </div>
                  )}

                  {success && (
                    <div className="p-4 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-2xl border border-emerald-100 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      성공적으로 저장되었습니다!
                    </div>
                  )}

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="submit"
                      disabled={mutation.isPending}
                      className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {mutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          저장 중…
                        </>
                      ) : (
                        '설정 저장하기'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeMenu !== 'profile' && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-300">
                  <Lock className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-gray-800">준비 중인 기능입니다</h3>
                  <p className="text-sm text-gray-400 font-medium">조금만 기다려주세요! 곧 멋진 기능으로 찾아오겠습니다.</p>
                </div>
                <button 
                  onClick={() => setActiveMenu('profile')}
                  className="text-indigo-600 text-sm font-bold hover:underline"
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
