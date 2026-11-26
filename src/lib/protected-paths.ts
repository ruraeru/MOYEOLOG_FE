/**
 * 로그인해야 볼 수 있는 경로. `middleware.ts` 의 matcher 와 같게 유지한다
 * (matcher 는 정적 값이어야 해서 이 목록을 import 하지 못한다).
 * 브라우저가 뒤로 가기에서 캐시한 화면을 보여 주면 미들웨어를 거치지 않으므로, 화면에서도 이 목록으로 확인한다.
 */
const PROTECTED_PREFIXES = ['/home', '/memo', '/schedule', '/groups', '/friends', '/notifications', '/settings', '/messages', '/profile'];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
