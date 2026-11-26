import type { Session } from 'next-auth';
import { axiosInstance, getAuthHeaders } from './axios';
import { graphemeLength, hasInvisibleOrControlChar, hasVisibleChar } from './utils';

/**
 * 로그인 없이 쓰는 계정 API (`/api/account/**`). 브라우저가 nginx 를 거쳐 백엔드를 바로 부른다.
 * 가입·비밀번호 찾기는 계정이 있든 없든 같은 202 를 받는다(계정 유무를 드러내지 않는다).
 */

export type VerifyPurpose = 'SIGNUP' | 'EMAIL';

export interface VerifyResult {
  purpose: VerifyPurpose;
  email: string;
}

export const PASSWORD_MIN = 8;
/** BCrypt 는 72바이트까지만 본다. 백엔드와 같은 한도 */
export const PASSWORD_MAX_BYTES = 72;

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 20;

/** 저장·비교 전에 백엔드와 같게 맞춘다 */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** 단순 형식 검사. 정확한 검사는 인증 메일이 한다 */
export const isEmailLike = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

/** 비밀번호 규칙에 맞지 않으면 안내 문구, 맞으면 null */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `비밀번호는 ${PASSWORD_MIN}자 이상이어야 해요.`;
  if (!password.trim()) return '비밀번호를 공백만으로 정할 수 없어요.';
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return '비밀번호가 너무 길어요. 영문 기준 72자, 한글 기준 24자까지 쓸 수 있어요.';
  }
  return null;
}

/** 활동 이름 규칙(설정의 프로필과 같다)에 맞지 않으면 안내 문구, 맞으면 null */
export function nicknameProblem(nickname: string): string | null {
  const trimmed = nickname.trim();
  if (!trimmed) return '활동 이름을 입력해 주세요.';
  if (hasInvisibleOrControlChar(trimmed)) return '줄바꿈·탭·보이지 않는 문자는 활동 이름에 쓸 수 없어요.';
  if (!hasVisibleChar(trimmed)) return '보이는 글자를 넣어 주세요.';
  const length = graphemeLength(trimmed);
  if (length < NICKNAME_MIN) return `활동 이름은 ${NICKNAME_MIN}자 이상이어야 해요.`;
  if (length > NICKNAME_MAX) return `활동 이름은 ${NICKNAME_MAX}자까지 쓸 수 있어요.`;
  return null;
}

export const accountApi = {
  /** 가입 신청. 인증 메일의 링크를 눌러야 계정이 만들어진다 */
  async signup(input: { email: string; password: string; nickname: string }): Promise<void> {
    await axiosInstance.post('/api/account/signup', {
      email: normalizeEmail(input.email),
      password: input.password,
      nickname: input.nickname.trim(),
    });
  },

  /**
   * 메일 링크의 토큰으로 가입 완료(SIGNUP) 또는 이메일 변경(EMAIL).
   * SIGNUP 은 가입 때 정한 password 가, EMAIL 은 그 이메일을 등록한 계정의 로그인(Authorization)이 필요하다.
   */
  async verify(token: string, opts: { password?: string; session?: Session | null } = {}): Promise<VerifyResult> {
    const response = await axiosInstance.post<VerifyResult>(
      '/api/account/verify',
      opts.password !== undefined ? { token, password: opts.password } : { token },
      { headers: getAuthHeaders(opts.session ?? null) }
    );
    return response.data;
  },

  /** 비밀번호 설정 메일 요청 */
  async requestPasswordReset(email: string): Promise<void> {
    await axiosInstance.post('/api/account/password-reset', { email: normalizeEmail(email) });
  },

  /** 메일 링크의 토큰으로 새 비밀번호 저장. 성공하면 모든 기기에서 로그아웃된다 */
  /** 재설정 링크를 열 때 아직 쓸 수 있는지 확인(소모하지 않음). 쓸 수 없으면 400 */
  async checkPasswordResetToken(token: string): Promise<void> {
    await axiosInstance.post('/api/account/password-reset/check', { token });
  },

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    await axiosInstance.post('/api/account/password-reset/confirm', { token, newPassword });
  },
};
