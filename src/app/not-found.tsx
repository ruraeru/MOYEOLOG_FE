import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 pb-24 lg:pb-6">
      <div className="flex max-w-sm flex-col items-center gap-2 text-center">
        <p className="stamp text-sm">404</p>
        <h1 className="font-display text-2xl leading-8 text-ink lg:text-[30px] lg:leading-9">페이지를 찾을 수 없어요</h1>
        <p className="text-sm text-ink-2">주소가 바뀌었거나 삭제된 페이지예요</p>
        <Link href="/home" className="btn-primary mt-4">
          홈으로 가기
        </Link>
      </div>
    </main>
  );
}
