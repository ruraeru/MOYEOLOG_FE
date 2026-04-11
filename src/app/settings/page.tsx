'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import { 
  User, 
  Bell, 
  Lock, 
  Eye, 
  Smartphone, 
  Globe, 
  LogOut,
  ChevronRight,
  Camera,
  ToggleLeft as Toggle,
  ToggleRight
} from 'lucide-react';
import Image from 'next/image';

const menuItems = [
  { id: 'profile', label: '프로필 설정', icon: User, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'notif', label: '알림 설정', icon: Bell, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { id: 'security', label: '계정 및 보안', icon: Lock, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 'display', label: '화면 및 디스플레이', icon: Eye, color: 'text-orange-500', bg: 'bg-orange-50' },
  { id: 'language', label: '언어 설정', icon: Globe, color: 'text-gray-500', bg: 'bg-gray-50' },
];

export default function SettingsPage() {
  const [activeMenu, setActiveMenu] = useState('profile');

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FB] text-gray-900 overflow-hidden font-sans">
      <Navbar />
      
      <main className="flex-1 overflow-hidden flex">
        
        {/* Settings Sidebar */}
        <aside className="w-80 bg-white border-r border-gray-100 p-8 flex flex-col gap-8 hidden lg:flex">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">설정</h2>
            <p className="text-sm text-gray-400 mt-1">앱 환경을 원하는 대로 관리하세요.</p>
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

          <button className="mt-auto flex items-center gap-3 p-3.5 text-red-500 font-bold hover:bg-red-50 rounded-2xl transition-all">
            <LogOut className="w-5 h-5" />
            <span className="text-sm">로그아웃</span>
          </button>
        </aside>

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-8 lg:p-16">
          <div className="max-w-2xl mx-auto">
            
            {activeMenu === 'profile' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex flex-col items-center gap-6">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-xl relative">
                      <Image 
                        src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop" 
                        alt="Profile" 
                        fill 
                        sizes="128px"
                        className="object-cover"
                      />
                    </div>
                    <button className="absolute bottom-1 right-1 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center border-4 border-[#F8F9FB] hover:bg-indigo-700 transition-all shadow-lg">
                      <Camera className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-gray-800">박민수</h3>
                    <p className="text-sm text-gray-400">minsoo@example.com</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">이름</label>
                    <input 
                      type="text" 
                      defaultValue="박민수"
                      className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-3.5 text-sm outline-none focus:border-indigo-400 transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">자기소개</label>
                    <textarea 
                      defaultValue="명지대학교 컴퓨터공학과 학생입니다. 함께 공부하고 일정 관리해요!"
                      className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-3.5 text-sm outline-none focus:border-indigo-400 transition-all shadow-sm min-h-[120px] resize-none leading-relaxed"
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">
                      저장하기
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeMenu === 'notif' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <Bell className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">알림 설정</h3>
                </div>

                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  <SettingToggle label="새로운 일정 알림" desc="참여 중인 모임에서 새 일정이 생기면 알림을 받습니다." defaultChecked />
                  <SettingToggle label="친구 요청 알림" desc="누군가 나에게 친구 요청을 보내면 알림을 받습니다." defaultChecked />
                  <SettingToggle label="메시지 알림" desc="새로운 메시지가 도착하면 알림을 받습니다." />
                  <SettingToggle label="일정 리마인더" desc="중요 일정이 시작되기 전 리마인더를 받습니다." defaultChecked />
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}

function SettingToggle({ label, desc, defaultChecked }: any) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div className="flex items-center justify-between p-6 border-b border-gray-50 last:border-none">
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-gray-800">{label}</h4>
        <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
      </div>
      <button onClick={() => setChecked(!checked)} className="transition-all">
        {checked ? (
          <ToggleRight className="w-8 h-8 text-indigo-600 fill-indigo-50" />
        ) : (
          <Toggle className="w-8 h-8 text-gray-200" />
        )}
      </button>
    </div>
  );
}
