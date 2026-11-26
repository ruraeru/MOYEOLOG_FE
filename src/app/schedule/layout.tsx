import type { Metadata } from 'next';

// 탭·방문 기록에서 화면을 구분할 수 있게 화면마다 제목을 준다(화면은 클라이언트 컴포넌트라 여기서 정한다).
export const metadata: Metadata = { title: '일정 | 모여로그' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
