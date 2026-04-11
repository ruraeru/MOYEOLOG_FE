'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import { Bell, Calendar, UserPlus, Users, MessageSquare, Check, Trash2, MoreVertical } from 'lucide-react';

const notifications = [
  {
    id: 1,
    type: 'appointment',
    title: '내일 일정이 있습니다',
    content: '"대학 동기들" 모임이 내일 오후 7시 홍대입구역에서 예정되어 있습니다.',
    time: '30분 전',
    isRead: false,
    icon: Calendar,
    color: 'text-blue-500',
    bg: 'bg-blue-50'
  },
  {
    id: 2,
    type: 'friend',
    title: '새로운 친구 요청',
    content: '김하늘님이 친구 요청을 보냈습니다.',
    time: '2시간 전',
    isRead: false,
    icon: UserPlus,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50'
  },
  {
    id: 3,
    type: 'group',
    title: '모임 초대',
    content: '"헬스 크루" 모임에 초대되었습니다.',
    time: '5시간 전',
    isRead: true,
    icon: Users,
    color: 'text-indigo-500',
    bg: 'bg-indigo-50'
  },
  {
    id: 4,
    type: 'memo',
    title: '메모 공유',
    content: '정태현님이 "React 훅 정리 노트"를 공유했습니다.',
    time: '1일 전',
    isRead: true,
    icon: MessageSquare,
    color: 'text-orange-500',
    bg: 'bg-orange-50'
  }
];

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FB] text-gray-900 overflow-hidden font-sans">
      <Navbar />
      
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100">
                <Bell className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">알림</h2>
            </div>
            <button className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              모두 읽음으로 표시
            </button>
          </div>

          {/* Filters */}
          <div className="flex border-b border-gray-200">
            <button 
              onClick={() => setFilter('all')}
              className={`px-6 py-3 text-sm font-bold transition-all relative ${filter === 'all' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              전체
              {filter === 'all' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-full" />}
            </button>
            <button 
              onClick={() => setFilter('unread')}
              className={`px-6 py-3 text-sm font-bold transition-all relative ${filter === 'unread' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              읽지 않음
              <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">2</span>
              {filter === 'unread' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-full" />}
            </button>
          </div>

          {/* Notifications List */}
          <div className="space-y-3">
            {notifications.filter(n => filter === 'all' || !n.isRead).map((notif) => (
              <div 
                key={notif.id} 
                className={`group bg-white p-5 rounded-2xl border transition-all flex items-start gap-4 cursor-pointer ${notif.isRead ? 'border-gray-100 opacity-75' : 'border-indigo-100 shadow-sm shadow-indigo-50'}`}
              >
                <div className={`w-10 h-10 rounded-xl ${notif.bg} flex items-center justify-center shrink-0`}>
                  <notif.icon className={`w-5 h-5 ${notif.color}`} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className={`text-sm font-bold ${notif.isRead ? 'text-gray-600' : 'text-gray-900'}`}>{notif.title}</h4>
                    <span className="text-[11px] text-gray-400 font-medium">{notif.time}</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                    {notif.content}
                  </p>
                </div>

                <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
