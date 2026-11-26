import type { Metadata } from 'next';
import GroupInviteClient from './GroupInviteClient';
import { clip, fetchLinkPreview } from '@/lib/link-preview';
import { pageMeta } from '@/lib/site-meta';

type Props = { searchParams: Promise<{ code?: string | string[] }> };

/** 모임 초대 링크를 공유했을 때의 미리보기: 모임 이름·방장·인원. 코드가 없거나 틀리면 이름 없는 기본 문구 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const raw = (await searchParams).code;
  const code = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  const path = code ? `/invite/group?code=${encodeURIComponent(code)}` : '/invite/group';
  const group = await fetchLinkPreview('group', code);
  if (!group) {
    return pageMeta({ title: '모여로그 모임 초대', description: '링크를 열어 모임에 참여하고 일정과 메모를 함께 써 보세요', path, noindex: true });
  }
  const facts = [group.ownerNickname ? `방장 ${clip(group.ownerNickname, 20)}` : '', group.memberCount ? `멤버 ${group.memberCount}명` : '', clip(group.description, 80)];
  return pageMeta({
    title: `${clip(group.name, 40)} 모임에 초대받았어요`,
    description: facts.filter(Boolean).join(' · ') || '링크를 열어 모임에 참여해 보세요',
    path,
    noindex: true,
  });
}

/** 비로그인 사용자도 어떤 모임 초대인지 알 수 있게 미리보기 값(이름·인원·방장·소개)을 넘긴다 */
export default async function GroupInvitePage({ searchParams }: Props) {
  const raw = (await searchParams).code;
  const code = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  const linkPreview = await fetchLinkPreview('group', code);
  return <GroupInviteClient linkPreview={linkPreview} />;
}
