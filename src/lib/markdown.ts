import rehypeSanitize from 'rehype-sanitize';

/**
 * 다른 사용자가 작성한 마크다운을 렌더링할 때 사용하는 rehype 플러그인 목록입니다.
 * rehype-sanitize(GitHub 기준 스키마)로 script, iframe, 이벤트 핸들러, javascript: 링크 등을 제거합니다.
 * @uiw/react-md-editor의 Markdown / previewOptions에 rehypePlugins로 전달하세요.
 */
interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/** 그림으로 불러올 수 있는 주소: http(s)·프로토콜 상대(//)·사이트 절대 경로(/uploads/…). */
function isLoadableImageSrc(src: unknown): boolean {
  return typeof src === 'string' && /^(https?:)?\/\/|^\/[^/]/i.test(src.trim());
}

/**
 * sanitize 뒤에 돌린다. `<img src="x">` 처럼 불러올 수 없는 주소의 그림은 깨진 아이콘으로 보이므로
 * 빼고, alt 가 있으면 그 글자로 바꾼다.
 */
function rehypeDropBrokenImages() {
  const walk = (node: HastNode) => {
    if (!node.children) return;
    node.children = node.children.flatMap((child) => {
      if (child.type === 'element' && child.tagName === 'img' && !isLoadableImageSrc(child.properties?.src)) {
        const alt = child.properties?.alt;
        return typeof alt === 'string' && alt.trim() ? [{ type: 'text', value: alt }] : [];
      }
      walk(child);
      return [child];
    });
  };
  return (tree: HastNode) => walk(tree);
}

export const markdownRehypePlugins = [[rehypeSanitize], [rehypeDropBrokenImages]] as [
  [typeof rehypeSanitize],
  [typeof rehypeDropBrokenImages],
];

/**
 * Tailwind preflight 가 ul/ol 의 글머리표를 없애므로 마크다운 렌더 영역을 감싸는 요소에 붙인다.
 * 체크리스트(- [ ])는 글머리표 없이 둔다.
 */
export const markdownListClassName =
  '[&_ul]:list-disc [&_ol]:list-decimal [&_li]:my-0.5 [&_ul.contains-task-list]:list-none';

/** 공백·제어문자·보이지 않는 문자(U+200B~U+200F, U+2060, U+FEFF 등)를 빼고 남는 글자가 있는지. */
export function hasVisibleText(text: string): boolean {
  return text.replace(/[\s\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g, '').length > 0;
}

/** 글자 수는 코드 포인트 기준(이모지 1개 = 1자). */
export function codePointLength(text: string): number {
  return [...text].length;
}

/** AI 요약에서 '있다.학교' 처럼 붙은 문장 사이에 공백을 넣는다. 숫자(3.5)는 건드리지 않는다. */
export function spaceSentences(text: string): string {
  return text.replace(/([.!?。])(?=[가-힣A-Za-z"'“‘(])/g, '$1 ');
}
