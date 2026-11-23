import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas p-6">
      <div className="card flex w-full max-w-sm flex-col items-center gap-4 p-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-raised">
          <Compass size={18} strokeWidth={1.5} className="text-ink-3" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-ink">페이지를 찾을 수 없어요</h1>
          <p className="text-sm leading-relaxed text-ink-2">
            주소가 바뀌었거나 삭제된 페이지예요.
            <br />
            주소를 다시 확인해 주세요.
          </p>
        </div>
        <Link href="/home" className="btn-primary w-full">
          홈으로 가기
        </Link>
      </div>
    </main>
  );
}
