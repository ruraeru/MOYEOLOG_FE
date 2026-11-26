'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

/** 404 화면의 버튼. 로그인하지 않았으면 홈 대신 첫 화면(로그인)으로 안내한다. */
export default function NotFoundActions() {
  const { status } = useSession();
  const guest = status === 'unauthenticated';
  return (
    <div className="mt-4 flex gap-2">
      <button type="button" onClick={() => window.history.back()} className="btn-secondary">
        이전 화면
      </button>
      <Link href={guest ? '/' : '/home'} className="btn-primary">
        {guest ? '첫 화면으로' : '홈으로 가기'}
      </Link>
    </div>
  );
}
