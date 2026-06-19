import { Metadata } from 'next';
import MemoDetailView from '@/components/MemoDetailView';
import Navbar from '@/components/Navbar';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { memoApi } from '@/lib/memo-api';

type Props = {
  params: Promise<{ id: string }> | { id: string }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const resolvedParams = await props.params;
  const id = resolvedParams.id;
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return { title: '메모 상세 | MOYEOLOG' };
  }

  try {
    const memo = await memoApi.getById(id, session);
    return {
      title: `${memo.title} | MOYEOLOG`,
      description: memo.content ? memo.content.slice(0, 100) : '일정, 메모, 모임을 한곳에서 관리하는 스마트 협업 플랫폼',
    };
  } catch (error) {
    return { title: '메모 상세 | MOYEOLOG' };
  }
}

export default async function MemoDetailPage(props: Props) {
  const resolvedParams = await props.params;
  const id = resolvedParams.id;

  if (!id) return null;

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FB] mb-12">
      <Navbar />
      <main className="flex-1 overflow-hidden relative">
        <div className="h-full max-w-7xl mx-auto bg-white shadow-sm overflow-hidden">
          <MemoDetailView memoId={id} isPage={true} />
        </div>
      </main>
    </div>
  );
}
