import rehypeSanitize from 'rehype-sanitize';

/**
 * 다른 사용자가 작성한 마크다운을 렌더링할 때 사용하는 rehype 플러그인 목록입니다.
 * rehype-sanitize(GitHub 기준 스키마)로 script, iframe, 이벤트 핸들러, javascript: 링크 등을 제거합니다.
 * @uiw/react-md-editor의 Markdown / previewOptions에 rehypePlugins로 전달하세요.
 */
export const markdownRehypePlugins = [[rehypeSanitize]] as [[typeof rehypeSanitize]];
