import type { Metadata } from 'next';
import { cache } from 'react';
import FriendInviteClient from './FriendInviteClient';
import { clip, fetchLinkPreview } from '@/lib/link-preview';
import { pageMeta } from '@/lib/site-meta';

/** 메타와 화면이 같은 요청 안에서 한 번만 묻게 묶어요. */
const friendPreview = cache((code: string | undefined) => fetchLinkPreview('friend', code));
const codeOf = (raw: string | string[] | undefined) => (Array.isArray(raw) ? raw[0] : raw)?.trim();

type Props = { searchParams: Promise<{ code?: string | string[] }> };

/** 친구 초대 링크를 공유했을 때의 미리보기: 보낸 사람 닉네임. 코드가 없거나 틀리면 이름 없는 기본 문구 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const raw = (await searchParams).code;
  const code = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  const path = code ? `/invite/friend?code=${encodeURIComponent(code)}` : '/invite/friend';
  const description = '링크를 열어 친구 신청을 보내고 일정과 메모를 함께 써 보세요';
  const friend = await friendPreview(code);
  return pageMeta({
    title: friend ? `${clip(friend.name, 20)}님이 모여로그 친구로 초대했어요` : '모여로그 친구 초대',
    description,
    path,
    noindex: true,
  });
}

export default async function FriendInvitePage({ searchParams }: Props) {
  // 로그인하지 않은 사람에게도 누가 초대했는지 보여 줘요(미리보기와 같은 공개 범위: 닉네임만).
  const friend = await friendPreview(codeOf((await searchParams).code));
  return <FriendInviteClient inviterName={friend?.name ?? null} />;
}
