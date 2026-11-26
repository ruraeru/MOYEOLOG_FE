'use client';

import { useParams } from 'next/navigation';
import MessagesView from './MessagesView';

/**
 * 목록(/messages)과 대화(/messages/[friendId])가 같은 MessagesView 를 쓴다.
 * 레이아웃에 두면 대화를 고르거나 목록으로 돌아올 때 목록이 다시 마운트·로딩되지 않는다.
 */
export default function MessagesShell({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const friendId = typeof params.friendId === 'string' ? params.friendId : undefined;
  return (
    <>
      <MessagesView friendId={friendId} />
      {children}
    </>
  );
}
