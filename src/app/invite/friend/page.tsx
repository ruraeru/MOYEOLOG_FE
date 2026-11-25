import type { Metadata } from 'next';
import FriendInviteClient from './FriendInviteClient';
import { clip, fetchLinkPreview } from '@/lib/link-preview';
import { pageMeta } from '@/lib/site-meta';

type Props = { searchParams: Promise<{ code?: string | string[] }> };

/** 친구 초대 링크를 공유했을 때의 미리보기: 보낸 사람 닉네임. 코드가 없거나 틀리면 이름 없는 기본 문구 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const raw = (await searchParams).code;
  const code = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  const path = code ? `/invite/friend?code=${encodeURIComponent(code)}` : '/invite/friend';
  const description = '링크를 열어 친구 신청을 보내고 일정과 메모를 함께 써 보세요';
  const friend = await fetchLinkPreview('friend', code);
  return pageMeta({
    title: friend ? `${clip(friend.name, 20)}님이 모여로그 친구로 초대했어요` : '모여로그 친구 초대',
    description,
    path,
    noindex: true,
  });
}

export default function FriendInvitePage() {
  return <FriendInviteClient />;
}
