'use client';

import { useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { ChevronDown, Search } from 'lucide-react';

export type HelpSection = { title: string; items: { q: string; a: ReactNode }[] };

/** 로그인했을 때만 children 을 보인다(도움말은 비로그인도 보는 공개 화면이다). */
export function AuthOnly({ children }: { children: ReactNode }) {
  const { status } = useSession();
  return status === 'authenticated' ? <>{children}</> : null;
}

/** 자주 묻는 질문 목록. 질문 글자로 찾고, 찾은 질문은 펼쳐 보인다. */
export default function HelpFaq({ sections }: { sections: HelpSection[] }) {
  const [query, setQuery] = useState('');
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = sections
    .map((s) => ({ ...s, items: s.items.filter((it) => words.every((w) => it.q.toLowerCase().includes(w))) }))
    .filter((s) => s.items.length > 0);

  return (
    <>
      <label className="relative block">
        <span className="sr-only">질문 찾기</span>
        <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="질문 찾기 (예: 비밀번호, 모임)"
          className="form-input w-full pl-9"
        />
      </label>

      {filtered.length === 0 && (
        <p className="py-10 text-center text-sm text-ink-3">&lsquo;{query.trim()}&rsquo;에 맞는 질문이 없어요</p>
      )}

      {filtered.map((section) => (
        <section key={section.title} className="space-y-2">
          <h2 className="px-1 text-[13px] font-medium text-ink-3">{section.title}</h2>
          <div className="card divide-y divide-line overflow-hidden">
            {section.items.map((item) => (
              // 찾는 중에는 맞는 질문을 펼쳐 둔다(key 를 바꿔 다시 그려야 open 이 적용된다)
              <details key={`${item.q}-${words.length > 0}`} className="group" open={words.length > 0 || undefined}>
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
    </>
  );
}
