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
}

type MentionState = { query: string; from: number; to: number } | null;

function findMention(editor: Editor): MentionState {
  const { $from, empty } = editor.state.selection;
  if (!empty || !$from.parent.isTextblock) return null;
  // 글자가 아닌 노드는 한 칸짜리 자리표시로 바꿔 글자 위치와 문서 위치가 어긋나지 않게 한다
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
  const match = matchMentionQuery(before);
  if (!match) return null;
  return { query: match.query, from: $from.pos - (before.length - match.index), to: $from.pos };
}

export default function RichEditor({ value, onChange, placeholder, mentions, className = '' }: RichEditorProps) {
  const [mention, setMention] = useState<MentionState>(null);
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
        class: `rich-editor wmde-markdown ${markdownListClassName} min-h-full px-4 py-3 outline-none`,
        'aria-label': placeholder ?? '내용',
      },
    },
    onUpdate: ({ editor }) => {
      const markdown = editor.getMarkdown();
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
      className={`relative flex flex-col overflow-hidden rounded-[10px] border border-line-strong bg-surface ${className}`}
      data-color-mode="light"
    >
      <div role="toolbar" aria-label="서식" className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-line px-1.5 py-1">
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
            className={`flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-raised ${
              tool.active ? 'bg-accent-soft text-accent' : 'text-ink-2'
            }`}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      <EditorContent editor={editor} className="min-h-0 flex-1 overflow-y-auto" />

      {(matchedSchedules.length > 0 || matchedMemos.length > 0) && (
        <div className="absolute bottom-4 left-4 z-50 max-h-64 w-72 max-w-[calc(100%-2rem)] overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-float no-scrollbar">
          {matchedSchedules.length > 0 && (
            <div className="mb-1">
              <div className="px-2.5 py-1 text-xs font-medium text-ink-3">일정</div>
              {matchedSchedules.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertMention(s, 'schedule')}
                  className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm text-ink transition-colors hover:bg-raised"
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
              {matchedMemos.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertMention(m, 'memo')}
                  className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm text-ink transition-colors hover:bg-raised"
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
