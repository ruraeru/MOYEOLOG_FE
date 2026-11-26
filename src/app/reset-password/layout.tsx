import type { ReactNode } from 'react';
import { pageMeta } from '@/lib/site-meta';

export const metadata = pageMeta({
  title: '비밀번호 찾기 | 모여로그',
  description: '가입한 이메일로 링크를 받아 새 비밀번호를 정해요.',
  path: '/reset-password',
  noindex: true,
});

export default function ResetPasswordLayout({ children }: { children: ReactNode }) {
  return children;
}
