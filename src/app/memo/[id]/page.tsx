'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function MemoIdPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  useEffect(() => {
    if (id) {
      // /memo 페이지로 이동하면서 쿼리 스트링으로 ID 전달
      router.replace(`/memo?id=${id}`);
    } else {
      router.replace('/memo');
    }
  }, [id, router]);

  return (
    <div className="h-screen flex items-center justify-center bg-[#F8F9FB]">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
    </div>
  );
}
