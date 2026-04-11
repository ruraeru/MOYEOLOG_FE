'use client';

import Image from "next/image";
import { useSession, signIn, signOut } from "next-auth/react";

export default function Home() {
  const { data: session } = useSession();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm flex flex-col gap-8">
        <h1 className="text-4xl font-bold">카카오 로그인 구현</h1>

        {session ? (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-4 p-4 border rounded-xl bg-white/10">
              {session.user?.image && (
                <Image
                  src={session.user.image}
                  alt="Profile"
                  className="w-12 h-12 rounded-full"
                  width={48}
                  height={48}
                />
              )}
              <div>
                <p className="font-semibold text-lg">{session.user?.name}님 안녕하세요!</p>
                <p className="text-gray-400 text-sm">{session.user?.email}</p>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn("kakao")}
            className="flex items-center gap-3 px-8 py-3 bg-[#FEE500] text-[#191919] rounded-lg hover:bg-[#FEE500]/90 transition-all font-bold text-lg shadow-md"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3C6.477 3 2 6.48 2 10.8c0 2.8 1.88 5.25 4.72 6.57-.19.7-.7 2.54-.8 2.92-.12.46.16.45.34.33.14-.09 2.24-1.52 3.14-2.13.84.23 1.73.35 2.64.35 5.523 0 10-3.48 10-7.8S17.523 3 12 3z" />
            </svg>
            카카오로 시작하기
          </button>
        )}
      </div>
    </main>
  );
}
