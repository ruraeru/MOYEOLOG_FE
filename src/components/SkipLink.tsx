'use client';

/** 키보드 첫 Tab 에 나오는 '본문으로 건너뛰기'. 화면마다 <main> 이 있으므로 그곳으로 포커스를 옮긴다 */
export default function SkipLink() {
  return (
    <a
      href="#main"
      className="skip-link"
      onClick={(e) => {
        const main = document.querySelector<HTMLElement>('main');
        if (!main) return;
        e.preventDefault();
        if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
        main.style.outline = 'none';
        main.focus();
      }}
    >
      본문으로 건너뛰기
    </a>
  );
}
