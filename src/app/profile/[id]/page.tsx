'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

import { useAlert } from '@/hooks/useAlert';

export default function ProfileIdPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { toast } = useAlert();

  useEffect(() => {
    // 현재 프로필 페이지는 따로 없으므로 홈으로 리다이렉트하거나 알림 표시
    // 향후 프로필 기능 구현 시 여기에 로직 추가
    toast.info(`프로필 기능 준비 중입니다. (ID: ${id})`);
    router.replace('/home');
  }, [id, router, toast]);

  return (
    <div className="h-screen flex items-center justify-center bg-[#F8F9FB]">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
    </div>
  );
}
