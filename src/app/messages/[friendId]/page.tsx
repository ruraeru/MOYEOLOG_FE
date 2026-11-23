'use client';

import { useParams } from 'next/navigation';
import MessagesView from '../MessagesView';

export default function ConversationPage() {
  const params = useParams();
  const friendId = typeof params.friendId === 'string' ? params.friendId : undefined;
  return <MessagesView friendId={friendId} />;
}
