'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  AtSign,
  Calendar,
  FileText,
} from 'lucide-react';
import { matchMentionQuery, mentionMatches } from '@/lib/memo-api';
import { markdownListClassName } from '@/lib/markdown';
import '@uiw/react-markdown-preview/markdown.css';

interface MentionTarget {
  id: string;
  title: string;
}

interface RichEditorProps {
  /** 마크다운. 저장 형식은 예전 편집기와 같다. */
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  /** 주면 @ 로 일정·메모를 연결할 수 있다([@제목](/memo/id) 링크로 들어간다). */
  mentions?: { memos: MentionTarget[]; schedules: MentionTarget[] };
  /** 바깥 틀(높이·테두리). 내용은 그 안에서 스크롤된다. */
  className?: string;
  /** 도구 막대가 붙을 위치(바깥 스크롤 안에 고정 머리가 있을 때 그 높이만큼, 예: 'max-lg:top-[60px]'). 기본은 맨 위. */
  toolbarStickyClassName?: string;
}

type MentionState = { query: string; from: number; to: number } | null;

/** 붙여넣은 글자가 마크다운 블록 문법(목록·제목·인용·코드)을 담고 있는지 */
const MARKDOWN_BLOCK = /^\s*(?:[-*+]\s|\d+\.\s|#{1,6}\s|>\s?|```|- \[[ xX]\]\s)/m;

/** 표는 지원하지 않으므로 칸·줄을 글자로 풀어 붙인다(칸이 한 글자로 붙지 않게) */
function flattenPastedTables(html: string): string {
  return html
    .replace(/<\/?(?:table|thead|tbody|tfoot|colgroup|col)\b[^>]*>/gi, '')
    .replace(/<tr\b[^>]*>/gi, '<p>')
    .replace(/<\/tr>/gi, '</p>')
    .replace(/<t[dh]\b[^>]*>/gi, '')
    .replace(/<\/t[dh]>/gi, ' ');
}

function findMention(editor: Editor): MentionState {
  const { $from, empty } = editor.state.selection;
  if (!empty || !$from.parent.isTextblock) return null;
  // 글자가 아닌 노드는 한 칸짜리 자리표시로 바꿔 글자 위치와 문서 위치가 어긋나지 않게 한다
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
  const match = matchMentionQuery(before);
  if (!match) return null;
  return { query: match.query, from: $from.pos - (before.length - match.index), to: $from.pos };
}

export default function RichEditor({ value, onChange, placeholder, mentions, className = '', toolbarStickyClassName = 'top-0' }: RichEditorProps) {
  const [mention, setMentionState] = useState<MentionState>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  // Esc 로 닫은 @ 자리. 같은 자리에서는 다시 열지 않는다.
  const dismissedFrom = useRef<number | null>(null);
  const mentionRef = useRef<MentionState>(null);
  const setMention = (found: MentionState) => {
    let next = found;
    if (next && dismissedFrom.current === next.from) next = null;
    else dismissedFrom.current = null;
    const prev = mentionRef.current;
    if (!next || !prev || prev.from !== next.from || prev.query !== next.query) setActiveIndex(0);
    mentionRef.current = next;
    setMentionState(next);
  };
  // editorProps 는 처음 한 번만 만들어지므로 최신 목록·선택은 ref 로 읽는다
  const nav = useRef<{ count: number; pick: (i: number) => void; close: () => void } | null>(null);
  const activeRef = useRef(0);
  const editorRef = useRef<Editor | null>(null);
  // 편집기가 마지막으로 내보낸 마크다운. 바깥에서 다른 값이 들어올 때만 내용을 갈아 끼운다.
  const emitted = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      // 밑줄은 마크다운에 없어 저장하면 사라지므로 끈다
      StarterKit.configure({ underline: false, link: { openOnClick: false } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      Markdown,
    ],
    content: value,
    contentType: 'markdown',
    editorProps: {
      attributes: {
        // .wmde-markdown(16px, 따로 불러오는 css)이 .rich-editor 를 덮으므로 크기는 여기서 고정한다. 읽기 화면은 15px, 터치 기기는 16px.
        class: `rich-editor wmde-markdown ${markdownListClassName} min-h-full px-4 py-3 outline-none text-[15px]! leading-[1.75]! pointer-coarse:text-base!`,
        'aria-label': placeholder ?? '내용',
      },
      handleKeyDown: (_view, event) => {
        const n = nav.current;
        if (!n || n.count === 0) return false;
        if (event.key === 'Escape') {
          n.close();
          // 창(Modal)의 Esc 닫기까지 가지 않게
          event.stopPropagation();
          return true;
        }
        if (event.isComposing) return false;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          const step = event.key === 'ArrowDown' ? 1 : -1;
          setActiveIndex((activeRef.current + step + n.count) % n.count);
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          n.pick(activeRef.current);
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const html = event.clipboardData?.getData('text/html');
        const text = event.clipboardData?.getData('text/plain');
        // 마크다운 원문을 붙이면 목록·제목도 서식으로 바꾼다(글자로 남으면 저장 뒤 모양이 달라진다)
        if (!html && text && MARKDOWN_BLOCK.test(text) && editorRef.current) {
          editorRef.current.commands.insertContent(text, { contentType: 'markdown' });
          return true;
        }
        return false;
      },
      transformPastedHTML: (html) => {
        setNotice(/<img\b/i.test(html) ? '붙여넣은 이미지는 넣을 수 없어요. 사진은 위의 사진 칸에 올려 주세요' : /<table\b/i.test(html) ? '표는 지원하지 않아 글자로 붙였어요' : null);
        return flattenPastedTables(html);
      },
    },
    onUpdate: ({ editor }) => {
      // 끝에 남는 빈 줄은 저장하지 않는다
      const markdown = editor.getMarkdown().replace(/\n+$/, '');
      emitted.current = markdown;
      onChangeRef.current(markdown);
      setMention(findMention(editor));
    },
    onSelectionUpdate: ({ editor }) => setMention(findMention(editor)),
  });

  useEffect(() => {
    if (!editor || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
  }, [editor, value]);

  const insertMention = (item: MentionTarget, type: 'memo' | 'schedule') => {
    if (!editor || !mention) return;
    editor
      .chain()
      .focus()
      .insertContentAt({ from: mention.from, to: mention.to }, [
        { type: 'text', text: `@${item.title}`, marks: [{ type: 'link', attrs: { href: `/${type}/${item.id}` } }] },
        { type: 'text', text: ' ' },
      ])
      .run();
    setMention(null);
  };

  const matchedSchedules = mention && mentions
    ? mentions.schedules.filter((s) => mentionMatches(s.title, mention.query)).slice(0, 5)
    : [];
  const matchedMemos = mention && mentions
    ? mentions.memos.filter((m) => mentionMatches(m.title, mention.query)).slice(0, 5)
    : [];
  const matched = [
    ...matchedSchedules.map((item) => ({ item, type: 'schedule' as const })),
    ...matchedMemos.map((item) => ({ item, type: 'memo' as const })),
  ];
  useEffect(() => {
    editorRef.current = editor;
    activeRef.current = activeIndex;
    nav.current = mention
      ? {
          count: matched.length,
          pick: (i) => matched[i] && insertMention(matched[i].item, matched[i].type),
          close: () => {
            dismissedFrom.current = mention.from;
            mentionRef.current = null;
            setMentionState(null);
          },
        }
      : null;
  });

  // @ 목록은 커서 바로 아래(아래 공간이 모자라면 위)에 띄운다. 쓰는 줄을 가리지 않게.
  let popupStyle: React.CSSProperties | undefined;
  if (editor && mention && matched.length > 0) {
    try {
      const c = editor.view.coordsAtPos(mention.from);
      const vw = window.innerWidth;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const width = Math.min(288, vw - 16);
      const left = Math.max(8, Math.min(c.left, vw - width - 8));
      popupStyle = vh - c.bottom >= 220 || c.top < vh - c.bottom
        ? { left, width, top: c.bottom + 4, maxHeight: Math.max(120, Math.min(256, vh - c.bottom - 12)) }
        : { left, width, bottom: window.innerHeight - c.top + 4, maxHeight: Math.max(120, Math.min(256, c.top - 12)) };
    } catch {
      popupStyle = undefined;
    }
  }
  const optionClass = (i: number) =>
    `flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm text-ink transition-colors hover:bg-raised pointer-coarse:h-11 ${
      i === activeIndex ? 'bg-raised' : ''
    }`;

  const tools: { label: string; icon: React.ReactNode; active?: boolean; run: (e: Editor) => void }[] = editor
    ? [
        { label: '굵게', icon: <Bold size={16} strokeWidth={2} />, active: editor.isActive('bold'), run: (e) => e.chain().focus().toggleBold().run() },
        { label: '기울임', icon: <Italic size={16} strokeWidth={1.5} />, active: editor.isActive('italic'), run: (e) => e.chain().focus().toggleItalic().run() },
        { label: '취소선', icon: <Strikethrough size={16} strokeWidth={1.5} />, active: editor.isActive('strike'), run: (e) => e.chain().focus().toggleStrike().run() },
        { label: '소제목', icon: <Heading2 size={16} strokeWidth={1.5} />, active: editor.isActive('heading', { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
        { label: '글머리 목록', icon: <List size={16} strokeWidth={1.5} />, active: editor.isActive('bulletList'), run: (e) => e.chain().focus().toggleBulletList().run() },
        { label: '번호 목록', icon: <ListOrdered size={16} strokeWidth={1.5} />, active: editor.isActive('orderedList'), run: (e) => e.chain().focus().toggleOrderedList().run() },
        { label: '체크 목록', icon: <ListChecks size={16} strokeWidth={1.5} />, active: editor.isActive('taskList'), run: (e) => e.chain().focus().toggleTaskList().run() },
        { label: '인용', icon: <Quote size={16} strokeWidth={1.5} />, active: editor.isActive('blockquote'), run: (e) => e.chain().focus().toggleBlockquote().run() },
        { label: '코드', icon: <Code size={16} strokeWidth={1.5} />, active: editor.isActive('code'), run: (e) => e.chain().focus().toggleCode().run() },
        ...(mentions
          ? [{ label: '일정·메모 연결', icon: <AtSign size={16} strokeWidth={1.5} />, run: (e: Editor) => e.chain().focus().insertContent('@').run() }]
          : []),
      ]
    : [];

  return (
    <div
      // overflow-hidden 은 스크롤 상자가 되어 도구 막대 sticky 를 막는다. clip 은 둥근 모서리만 자른다.
      className={`relative flex flex-col overflow-clip rounded-[10px] border border-line-strong bg-surface ${className}`}
      data-color-mode="light"
    >
      <div
        role="toolbar"
        aria-label="서식"
        // 터치 기기에서는 44px 버튼을 한 줄에 두고 가로로 민다. 창 본문이 스크롤될 때 위에 붙어 있다.
        className={`no-scrollbar sticky ${toolbarStickyClassName} z-10 flex shrink-0 flex-wrap items-center gap-0.5 rounded-t-[10px] border-b border-line bg-surface px-1.5 py-1 pointer-coarse:flex-nowrap pointer-coarse:gap-2 pointer-coarse:overflow-x-auto`}
      >
        {tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            title={tool.label}
            aria-label={tool.label}
            aria-pressed={tool.active}
            // 누를 때 편집기의 선택 영역이 풀리지 않게
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor && tool.run(editor)}
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-raised pointer-coarse:size-11 ${
              tool.active ? 'bg-accent-soft text-accent' : 'text-ink-2'
            }`}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      <EditorContent editor={editor} className="min-h-0 flex-1 overflow-y-auto" />

      {notice && <p className="shrink-0 border-t border-line px-4 py-1.5 text-xs text-ink-3">{notice}</p>}

      {matched.length > 0 && (
        <div
          role="listbox"
          aria-label="연결할 일정·메모"
          style={popupStyle}
          className={`z-50 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-float no-scrollbar ${
            popupStyle ? 'fixed' : 'absolute bottom-4 left-4 max-h-64 w-72 max-w-[calc(100%-2rem)]'
          }`}
        >
          {matchedSchedules.length > 0 && (
            <div className="mb-1">
              <div className="px-2.5 py-1 text-xs font-medium text-ink-3">일정</div>
              {matchedSchedules.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => insertMention(s, 'schedule')}
                  className={optionClass(i)}
                >
                  <Calendar size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
                  <span className="truncate">{s.title}</span>
                </button>
              ))}
            </div>
          )}
          {matchedMemos.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-xs font-medium text-ink-3">메모</div>
              {matchedMemos.map((m, j) => (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={matchedSchedules.length + j === activeIndex}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(matchedSchedules.length + j)}
                  onClick={() => insertMention(m, 'memo')}
                  className={optionClass(matchedSchedules.length + j)}
                >
                  <FileText size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
                  <span className="truncate">{m.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
