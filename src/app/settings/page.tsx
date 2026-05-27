'use client';

import React, { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import {
  User,
   Bell,
  Lock,
  Eye,
  Globe,
  LogOut,
  ChevronRight,
  Camera,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { userApi, type UserResponse } from '@/lib/user-api';

const menuItems = [
  { id: 'profile', label: '프로필 설정', icon: User, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'notif', label: '알림 설정', icon: Bell, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { id: 'security', label: '계정 및 보안', icon: Lock, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 'display', label: '화면 및 디스플레이', icon: Eye, color: 'text-orange-500', bg: 'bg-orange-50' },
  { id: 'language', label: '언어 설정', icon: Globe, color: 'text-gray-500', bg: 'bg-gray-50' },
];

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const [activeMenu, setActiveMenu] = useState('profile');
  const [userData, setUserData] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form states
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    const fetchUser = async () => {
      if (!session) return;
      try {
        setLoading(true);
        const data = await userApi.getMe(session);
        setUserData(data);
        setNickname(data.nickname);
        setBio(data.bio || '');
        if (data.profileImage) {
          setImagePreview(data.profileImage.startsWith('/uploads/') ? `${apiUrl}${data.profileImage}` : data.profileImage);
        }
      } catch (err) {
        console.error('Failed to fetch user:', err);
        setError('사용자 정보를 불러오는 데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [session, apiUrl]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!nickname.trim()) {
      setError('이름을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updatedUser = await userApi.updateMe({
        nickname,
        bio,
        image: imageFile || undefined
      }, session);
      
      setUserData(updatedUser);
      setSuccess(true);
      
      // Next-Auth 세션 업데이트 시도
      await updateSession({
        ...session,
        user: {
          ...session?.user,
          name: updatedUser.nickname,
          image: updatedUser.profileImage.startsWith('/uploads/') ? `${apiUrl}${updatedUser.profileImage}` : updatedUser.profileImage
        }
      });

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : '저장에 실패했습니다.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
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
                        <User className="w-12 h-12 text-indigo-200" />
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

                <div className="space-y-8 bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-gray-100">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">활동 이름</label>
                    <input 
                      type="text" 
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="이름을 입력하세요"
                      className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">자기소개</label>
                    <textarea 
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="자기소개를 입력해보세요"
                      className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold min-h-[140px] resize-none leading-relaxed"
                    />
                  </div>

                  {error && (
                    <div className="p-4 bg-rose-50 text-rose-600 text-xs font-bold rounded-2xl border border-rose-100">
                      {error}
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
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          저장 중…
                        </>
                      ) : (
                        '설정 저장하기'
                      )}
                    </button>
                  </div>
                </div>
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
