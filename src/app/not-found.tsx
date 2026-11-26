import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import NotFoundActions from '@/components/NotFoundActions';

export const metadata: Metadata = { title: '페이지를 찾을 수 없어요 | 모여로그' };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Navbar />
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24 lg:pb-6">
        <div className="flex max-w-sm flex-col items-center gap-2 text-center">
          <p className="stamp text-sm">404</p>
          <h1 className="font-display text-2xl leading-8 text-ink lg:text-[30px] lg:leading-9">페이지를 찾을 수 없어요</h1>
          <p className="text-sm text-ink-2">주소가 바뀌었거나 삭제된 페이지예요</p>
          <NotFoundActions />
        </div>
      </main>
    </div>
  );
}
