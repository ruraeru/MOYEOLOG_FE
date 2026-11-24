import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = {
  title: '도움말 | 모여로그',
  description: '모여로그를 쓰면서 자주 묻는 질문',
};

const SECTIONS: { title: string; items: { q: string; a: ReactNode }[] }[] = [
  {
    title: '시작하기',
    items: [
      {
        q: '어떻게 가입하나요?',
        a: '첫 화면에서 카카오로 로그인하면 바로 계정이 만들어져요. 따로 비밀번호를 정할 필요는 없어요.',
      },
      {
        q: '닉네임과 프로필 사진은 어디서 바꾸나요?',
        a: (
          <>
            오른쪽 위 프로필 메뉴의 &apos;설정&apos;이나 <Link href="/settings" className="text-accent underline-offset-2 hover:underline">설정</Link>에서 바꿀 수 있어요. 닉네임은 2~20자예요.
          </>
        ),
      },
      {
        q: '내 ID는 무엇인가요?',
        a: '프로필 메뉴에 보이는 8자리 ID예요. 닉네임은 다른 사람과 같을 수 있지만 ID는 사람마다 달라서, 친구를 찾거나 같은 이름의 사람을 구분할 때 써요.',
      },
    ],
  },
  {
    title: '친구와 메시지',
    items: [
      {
        q: '친구는 어떻게 추가하나요?',
        a: (
          <>
            <Link href="/friends" className="text-accent underline-offset-2 hover:underline">친구</Link> 화면의 &apos;친구 추가&apos;에서 상대의 ID를 입력하거나, 프로필 메뉴의 &apos;내 친구 초대 링크&apos;를 보내 주세요. 링크를 받은 사람이 누가 초대했는지 확인하고 &apos;친구 신청&apos;을 누르면 요청이 가요.
          </>
        ),
      },
      {
        q: '잘못 보낸 친구 요청을 취소할 수 있나요?',
        a: '친구 화면의 \'보낸 요청\'에서 \'요청 취소\'를 누르면 돼요. 상대가 수락하기 전까지만 취소할 수 있어요.',
      },
      {
        q: '메시지는 누구에게 보낼 수 있나요?',
        a: '친구에게만 1:1로 보낼 수 있어요. 친구 목록의 \'메시지\'나 메시지 화면에서 대화를 열어요. 친구를 끊으면 지난 대화는 남지만 새 메시지는 보낼 수 없어요.',
      },
      {
        q: '친구에게 내 이메일이 보이나요?',
        a: '기본으로는 보이지 않아요. 설정의 \'계정 및 보안\'에서 이메일 공개를 켜면 친구에게만 보여요.',
      },
    ],
  },
  {
    title: '메모와 일정',
    items: [
      {
        q: '메모를 친구와 함께 볼 수 있나요?',
        a: '메모 상세 화면의 공유 버튼으로 친구에게 공유할 수 있어요. 공유받은 사람은 읽기만 할 수 있고, 공유는 언제든 해제할 수 있어요.',
      },
      {
        q: '일정에 친구를 넣으면 어떻게 되나요?',
        a: '참여자로 넣은 친구의 일정 화면에도 그 일정이 보이고, 친구에게 알림이 가요.',
      },
      {
        q: '메모·토픽 분석은 무엇을 해 주나요?',
        a: '메모나 토픽의 글과 사진을 읽고 요약과 키워드를 만들어 줘요. 분석은 시간이 조금 걸릴 수 있고, 결과는 참고용이에요. 분석한 뒤 내용을 고치면 다시 분석할 수 있어요.',
      },
    ],
  },
  {
    title: '모임',
    items: [
      {
        q: '모임에는 어떻게 들어가나요?',
        a: '방장이나 멤버가 보낸 초대를 알림 화면의 \'모임 초대\' 탭에서 수락하거나, 초대 코드·초대 링크로 들어갈 수 있어요.',
      },
      {
        q: '모임에서 나가거나 모임을 지울 수 있나요?',
        a: '모임 화면에서 나갈 수 있어요. 모임 삭제는 방장만 할 수 있어요.',
      },
    ],
  },
  {
    title: '알림과 계정',
    items: [
      {
        q: '알림이 너무 많아요',
        a: '설정의 \'알림\'에서 친구 요청, 모임 초대, 메모 공유, 토픽 댓글, 일정 참여, 메시지 알림을 종류별로 끌 수 있어요.',
      },
      {
        q: '다른 기기에서 로그아웃하고 싶어요.',
        a: '설정의 \'계정 및 보안\'에서 로그인한 기기 목록을 보고 모든 기기에서 로그아웃할 수 있어요.',
      },
      {
        q: '탈퇴하면 내 기록은 어떻게 되나요?',
        a: '설정의 \'계정 및 보안\'에서 탈퇴할 수 있어요. 내 메모·일정·토픽·댓글·친구·메시지가 모두 지워지고 되돌릴 수 없어요. 내가 방장인 모임은 가장 오래된 다른 멤버에게 넘어가요.',
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      <Navbar />
      <main className="flex-1 px-4 pt-6 pb-24 lg:px-8 lg:pt-10 lg:pb-12">
        <div className="max-w-3xl mx-auto space-y-8">
          <PageHeader
            title="도움말"
            description="모여로그를 쓰면서 자주 묻는 질문을 모았어요"
            actions={<Link href="/settings" className="btn-secondary">설정 열기</Link>}
          />

          {SECTIONS.map((section) => (
            <section key={section.title} className="space-y-2">
              <h2 className="px-1 text-[13px] font-medium text-ink-3">{section.title}</h2>
              <div className="card divide-y divide-line overflow-hidden">
                {section.items.map((item) => (
                  <details key={item.q} className="group">
                    <summary className="flex min-h-14 items-center justify-between gap-3 px-5 py-3 cursor-pointer list-none text-[15px] font-medium text-ink hover:bg-raised transition-colors [&::-webkit-details-marker]:hidden">
                      <span>{item.q}</span>
                      <ChevronDown
                        size={16}
                        strokeWidth={1.5}
                        className="text-ink-3 shrink-0 transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <div className="px-5 pb-5 text-sm text-ink-2 leading-relaxed">{item.a}</div>
                  </details>
                ))}
              </div>
            </section>
          ))}

        </div>
      </main>
    </div>
  );
}
