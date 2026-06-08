'use client';

import { useParams } from 'next/navigation';
import MemoDetailView from '@/components/MemoDetailView';
import Navbar from '@/components/Navbar';

export default function MemoDetailPage() {
  const params = useParams();
  const id = params.id as string;

  if (!id) return null;

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FB]">
      <Navbar />
      <main className="flex-1 overflow-hidden relative">
        <div className="h-full max-w-7xl mx-auto bg-white shadow-sm overflow-hidden">
          <MemoDetailView memoId={id} isPage={true} />
        </div>
      </main>
    </div>
  );
}
