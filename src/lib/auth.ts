import type { Account, NextAuthOptions, Profile, User } from 'next-auth';
import KakaoProvider from 'next-auth/providers/kakao';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { JWT as Token } from 'next-auth/jwt';

interface KakaoProfile {
  id: number;
  kakao_account?: {
    name?: string;
    email?: string;
    is_email_valid?: boolean;
    is_email_verified?: boolean;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
      thumbnail_image_url?: string;
    };
  };
  properties?: {
    nickname?: string;
    profile_image?: string;
  };
}

interface BackendAuthUser {
  id: string;
  kakaoId?: string | null; // 이메일 가입 계정은 없음
  customId?: string;
  nickname?: string;
  profileImage?: string | null;
}

interface BackendAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: BackendAuthUser;
}

// 만료 직전의 토큰으로 요청하지 않도록 두는 여유 시간
const EXPIRY_SAFETY_MARGIN_MS = 60 * 1000;
// exp 클레임을 읽을 수 없을 때 사용하는 보수적인 기본 수명
const FALLBACK_ACCESS_TOKEN_TTL_MS = 5 * 60 * 1000;
const SYNC_TIMEOUT_MS = 5000;
const REFRESH_TIMEOUT_MS = 5000;

const LOGOUT_TIMEOUT_MS = 5000;
const VERIFY_TIMEOUT_MS = 5000;
const LOGIN_TIMEOUT_MS = 5000;
const LINK_TIMEOUT_MS = 5000;

/** 설정 화면 '카카오 연결' 이 심는 쿠키(값: 연결을 요청한 사용자 id, 5분). link-intent 라우트가 만든다. */
export const KAKAO_LINK_COOKIE = 'moyeolog.kakao-link';
export const KAKAO_LINK_COOKIE_PATH = '/api/auth';
const LINKED_URL = '/settings?menu=security&linked=kakao';
export const LINK_ERROR_URL = '/settings?menu=security&linkError=';

/**
 * 카카오 콜백 한 번에 대한 연결 모드 정보. `[...nextauth]/route.ts` 가 요청마다 만든다.
 * - accessToken: 연결 쿠키의 사용자와 오류 없는 지금 세션의 사용자가 같을 때만 채운다.
 *   비어 있으면 signIn 은 sync 하지 않고 LinkFailed 로 보낸다(다른 계정으로 로그인되지 않게).
 * - redirect: 연결에 성공하면 signIn 콜백이 채운다. route.ts 가 응답의 Location 을 이것으로 바꾼다.
 */
export interface KakaoLinkRequest {
  accessToken?: string;
  redirect?: string;
}

const MAX_NAME_LENGTH = 20;
const MAX_IMAGE_URL_LENGTH = 2048;

/**
 * 액세스 토큰(JWT)의 exp 클레임에서 만료 시각(ms)을 계산합니다.
 * 서명 검증은 백엔드의 몫이므로 여기서는 payload만 디코딩합니다.
 */
function getAccessTokenExpires(accessToken: string): number {
  try {
    const payload = accessToken.split('.')[1];
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: unknown };
    if (typeof claims.exp === 'number' && Number.isFinite(claims.exp)) {
      return claims.exp * 1000 - EXPIRY_SAFETY_MARGIN_MS;
    }
  } catch {
    // 아래 기본값 사용
  }
  return Date.now() + FALLBACK_ACCESS_TOKEN_TTL_MS;
}

/** 화면에 보이는 글자(grapheme) 단위로 나눕니다 (👩‍💻 같은 ZWJ 이모지도 1자, 백엔드와 같은 기준). */
function splitGraphemes(value: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    return Array.from(new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(value), (s) => s.segment);
  }
  return [...value];
}

/** 앞뒤 공백을 지우고 글자(grapheme) 기준으로 자릅니다 (이모지를 쪼개지 않음). */
function trimToGraphemes(value: string, max: number): string {
  return splitGraphemes(value.trim()).slice(0, max).join('').trim();
}

/**
 * 리프레시 토큰으로 액세스 토큰을 새로 받습니다.
 * 백엔드가 리프레시 토큰을 거부하면 세션을 오류 상태로 만들고(SessionGuard 가 로그아웃시킴),
 * 일시 장애면 기존 토큰을 그대로 돌려줘 다음 요청에서 다시 시도합니다.
 */
async function refreshAccessToken(token: Token, internalApiUrl: string): Promise<Token> {
  if (!token.refreshToken) {
    return { ...token, error: 'RefreshAccessTokenError' };
  }

  try {
    const response = await fetch(`${internalApiUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token.refreshToken }),
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });

    if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 404) {
      // 리프레시 토큰이 거부됨(로그아웃·탈퇴·모든 기기 로그아웃 등) → 다시 로그인해야 합니다.
      console.error('Refresh token rejected:', response.status);
      return { ...token, error: 'RefreshAccessTokenError' };
    }

    if (!response.ok) {
      console.error('Error refreshing access token:', response.status);
      return token;
    }

    const refreshedTokens = (await response.json()) as Partial<BackendAuthResponse>;
    if (!refreshedTokens.accessToken) {
      return { ...token, error: 'RefreshAccessTokenError' };
    }

    return {
      ...token,
      accessToken: refreshedTokens.accessToken,
      accessTokenExpires: getAccessTokenExpires(refreshedTokens.accessToken),
      refreshToken: refreshedTokens.refreshToken ?? token.refreshToken, // 새 RT가 오면 교체, 아니면 기존 것 유지
    };
  } catch (error) {
    // 네트워크 오류/타임아웃: 일시적인 문제로 보고 다음 요청에서 다시 시도합니다.
    console.error('Error refreshing access token', error);
    return token;
  }
}

/** 백엔드가 이 액세스 토큰을 받아 주는지 확인합니다. 'unknown' 은 일시 장애(판단 보류). */
async function checkAccessToken(
  accessToken: string | undefined,
  internalApiUrl: string
): Promise<'ok' | 'rejected' | 'unknown'> {
  if (!accessToken) return 'rejected';
  try {
    const response = await fetch(`${internalApiUrl}/api/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    if (response.ok) return 'ok';
    if (response.status === 401) return 'rejected';
    // 403(탈퇴 등으로 접근 불가)·404(사용자 없음)도 이 세션으로는 더 쓸 수 없습니다.
    if (response.status === 403 || response.status === 404) return 'rejected';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * 브라우저가 401 을 받았을 때(SessionGuard → update({ revalidate: true })) 호출됩니다.
 * 만료 전이라도 백엔드가 거부한 토큰이면 갱신을 시도하고, 갱신도 안 되거나 새 토큰도 거부되면
 * 세션을 오류 상태로 만들어 로그인 화면으로 보냅니다.
 */
async function revalidateToken(token: Token, internalApiUrl: string): Promise<Token> {
  const current = await checkAccessToken(token.accessToken, internalApiUrl);
  if (current !== 'rejected') return token;

  const refreshed = await refreshAccessToken(token, internalApiUrl);
  if (refreshed.error) return refreshed;
  if (refreshed.accessToken === token.accessToken) return refreshed; // 일시 장애로 갱신 못 함

  const next = await checkAccessToken(refreshed.accessToken, internalApiUrl);
  if (next === 'rejected') return { ...refreshed, error: 'BackendRejectedToken' };
  return refreshed;
}

/** 프론트 서버만 부르는 백엔드 내부 API(/api/auth/*)에 JSON 을 보냅니다. */
function postInternal(path: string, body: unknown, timeoutMs: number): Promise<Response> {
  const internalApiUrl = process.env.BACKEND_INTERNAL_URL || 'http://app:8080';
  return fetch(`${internalApiUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 서버 간 호출임을 증명하는 공유 시크릿 (런타임 환경 변수, 브라우저에 노출되지 않음)
      'X-Internal-Secret': process.env.INTERNAL_API_SECRET ?? '',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/** sync·login·link-kakao 응답(AuthSyncResponse)을 user 에 담습니다. 모양이 이상하면 false. */
async function applyBackendAuth(user: User, response: Response): Promise<boolean> {
  const data = (await response.json()) as BackendAuthResponse;
  if (!data?.accessToken || !data?.refreshToken || !data?.user?.id) return false;
  user.accessToken = data.accessToken;
  user.refreshToken = data.refreshToken;
  user.backendUser = data.user;
  return true;
}

/** 카카오 프로필에서 백엔드에 보낼 값을 꺼냅니다. */
function readKakaoProfile(user: User, kakaoProfile: KakaoProfile) {
  const rawNickname = kakaoProfile.kakao_account?.name ||
                   user.name ||
                   kakaoProfile.properties?.nickname ||
                   kakaoProfile.kakao_account?.profile?.nickname ||
                   '';
  const nickname = trimToGraphemes(rawNickname, MAX_NAME_LENGTH) || '사용자';

  // 카카오가 유효하고 인증된 이메일이라고 확인해 준 경우에만 백엔드가 기존 계정과 연결할 수 있습니다.
  const emailVerified =
    kakaoProfile.kakao_account?.is_email_valid === true &&
    kakaoProfile.kakao_account?.is_email_verified === true;

  const email = kakaoProfile.kakao_account?.email || user.email || '';
  const profileImage = user.image ||
                       kakaoProfile.properties?.profile_image ||
                       kakaoProfile.kakao_account?.profile?.profile_image_url || '';

  return { kakaoId: kakaoProfile.id.toString(), email, emailVerified, nickname, profileImage };
}

type KakaoFields = ReturnType<typeof readKakaoProfile>;

/** 일반 카카오 로그인: 백엔드와 사용자 정보를 동기화합니다. */
async function syncKakao(user: User, fields: KakaoFields): Promise<string | boolean> {
  try {
    const response = await postInternal('/api/auth/sync', fields, SYNC_TIMEOUT_MS);
    if (!response.ok) {
      console.error('Backend sync failed:', response.status);
      return '/?error=SyncFailed';
    }
    if (!(await applyBackendAuth(user, response))) {
      console.error('Backend sync returned an unexpected response');
      return '/?error=SyncFailed';
    }
    return true;
  } catch (error) {
    console.error('Backend sync error:', error);
    return '/?error=SyncFailed';
  }
}

/**
 * 카카오 연결 모드: 지금 로그인한 사용자에게 이 카카오 계정을 붙입니다.
 * 실패하면 문자열(주소)을 돌려줘 세션 쿠키를 건드리지 않습니다 → 기존 세션 그대로, 다른 계정으로 로그인되지 않음.
 */
async function linkKakao(user: User, fields: KakaoFields, link: KakaoLinkRequest): Promise<string | boolean> {
  try {
    const response = await postInternal(
      '/api/auth/link-kakao',
      {
        accessToken: link.accessToken,
        kakaoId: fields.kakaoId,
        email: fields.email,
        emailVerified: fields.emailVerified,
        profileImage: fields.profileImage,
      },
      LINK_TIMEOUT_MS
    );
    if (response.status === 409) return `${LINK_ERROR_URL}KakaoInUse`;
    if (!response.ok) {
      console.error('Backend link-kakao failed:', response.status);
      return `${LINK_ERROR_URL}LinkFailed`;
    }
    if (!(await applyBackendAuth(user, response))) {
      console.error('Backend link-kakao returned an unexpected response');
      return `${LINK_ERROR_URL}LinkFailed`;
    }
    link.redirect = LINKED_URL;
    return true;
  } catch (error) {
    console.error('Backend link-kakao error:', error);
    return `${LINK_ERROR_URL}LinkFailed`;
  }
}

async function handleSignIn(
  { user, account, profile }: { user: User; account: Account | null; profile?: Profile },
  link?: KakaoLinkRequest
): Promise<string | boolean> {
  // 비밀번호 로그인은 authorize 가 이미 백엔드 로그인을 마쳤습니다(sync 를 부르지 않음).
  if (account?.provider === 'credentials') return !!user.accessToken;

  // 연결 모드(연결 쿠키가 있는 카카오 콜백)는 어긋나도 일반 로그인으로 넘어가지 않습니다.
  if (link) {
    if (!link.accessToken || !account || !profile) return `${LINK_ERROR_URL}LinkFailed`;
    return linkKakao(user, readKakaoProfile(user, profile as unknown as KakaoProfile), link);
  }

  if (!account || !profile) return '/?error=SyncFailed';
  return syncKakao(user, readKakaoProfile(user, profile as unknown as KakaoProfile));
}

/**
 * 로그인 잠금을 (이메일, IP) 로 묶을 때 쓰는 접속 IP. nginx 가 $remote_addr 로 덮어쓰는 X-Real-IP 만 쓴다
 * (X-Forwarded-For 첫 값은 클라이언트가 조작할 수 있어 쓰지 않음). 없으면 undefined → 백엔드가 'unknown' 한 묶음으로 센다.
 */
function clientIpFrom(headers: Record<string, unknown> | undefined): string | undefined {
  const realIp = headers?.['x-real-ip'];
  return typeof realIp === 'string' && realIp.trim() ? realIp.trim() : undefined;
}

/**
 * 이메일·비밀번호 로그인. 실패는 null(→ error=CredentialsSignin, 계정 유무를 드러내지 않음),
 * 잠금(429)은 'TooManyAttempts', 백엔드 장애는 'LoginFailed' 로 구분합니다.
 * 비밀번호는 로그에 남기지 않습니다.
 */
async function authorizeCredentials(
  credentials: Record<'email' | 'password', string> | undefined,
  headers: Record<string, unknown> | undefined
): Promise<User | null> {
  const email = credentials?.email;
  const password = credentials?.password;
  if (!email || !password) return null;

  let response: Response;
  try {
    response = await postInternal(
      '/api/auth/login',
      { email, password, clientIp: clientIpFrom(headers) },
      LOGIN_TIMEOUT_MS
    );
  } catch (error) {
    console.error('Backend login error:', error);
    throw new Error('LoginFailed');
  }
  if (response.status === 429) throw new Error('TooManyAttempts');
  if (response.status === 400 || response.status === 401) return null;
  if (!response.ok) {
    console.error('Backend login failed:', response.status);
    throw new Error('LoginFailed');
  }

  const user: User = { id: '' };
  if (!(await applyBackendAuth(user, response).catch(() => false)) || !user.backendUser) {
    console.error('Backend login returned an unexpected response');
    throw new Error('LoginFailed');
  }
  user.id = String(user.backendUser.id);
  user.name = user.backendUser.nickname;
  // 이메일로 로그인한 계정은 그 이메일을 세션에 담는다(프로필 메뉴가 session.user.email 을 보여 준다)
  user.email = email.trim().toLowerCase();
  return user;
}

function toPublicImageUrl(image: string | null | undefined, publicApiUrl: string): string | null {
  if (!image) return null;
  return image.startsWith('/uploads/') ? `${publicApiUrl}${image}` : image;
}

export const authOptions: NextAuthOptions = {
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID ?? '',
      clientSecret: process.env.KAKAO_CLIENT_SECRET ?? '',
    }),
    CredentialsProvider({
      id: 'credentials',
      name: '이메일',
      credentials: {
        email: { label: '이메일', type: 'email' },
        password: { label: '비밀번호', type: 'password' },
      },
      authorize: (credentials, req) => authorizeCredentials(credentials, req.headers),
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/',
    error: '/',
  },
  events: {
    /**
     * 로그아웃하면 백엔드에도 알려 리프레시 토큰을 폐기하고 액세스 토큰을 더 쓰지 못하게 합니다.
     * 실패해도 쿠키 삭제(로그아웃 자체)는 막지 않습니다.
     */
    async signOut({ token }) {
      if (!token?.refreshToken && !token?.accessToken) return;
      const internalApiUrl = process.env.BACKEND_INTERNAL_URL || 'http://app:8080';
      try {
        const response = await fetch(`${internalApiUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Secret': process.env.INTERNAL_API_SECRET ?? '',
          },
          body: JSON.stringify({
            refreshToken: token.refreshToken ?? null,
            accessToken: token.accessToken ?? null,
          }),
          signal: AbortSignal.timeout(LOGOUT_TIMEOUT_MS),
        });
        if (!response.ok && response.status !== 401 && response.status !== 404) {
          console.error('Backend logout failed:', response.status);
        }
      } catch (error) {
        console.error('Backend logout error:', error);
      }
    },
  },
  callbacks: {
    /**
     * 로그인 직후 백엔드 결과를 user 객체에 담아 jwt 콜백으로 넘깁니다.
     * 실패하면 (accessToken 없는) 반쪽짜리 세션을 만들지 않고 로그인을 실패 처리합니다.
     */
    signIn: (params) => handleSignIn(params),
    async jwt({ token, user, account, trigger, session }) {
      const internalApiUrl = process.env.BACKEND_INTERNAL_URL || 'http://app:8080';
      const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://moyeolog.ruraeru.xyz';

      // 1. 세션 업데이트 요청 시 (trigger === "update")
      //    - { revalidate: true }: 브라우저가 401 을 받음 → 백엔드에 토큰을 확인하고 필요하면 갱신/오류 처리
      //    - 그 밖: 클라이언트가 보낸 값이므로 표시용 이름/이미지만, 형식이 올바를 때에만 반영합니다.
      if (trigger === "update" && session) {
        if (token.error) return token;

        if ((session as { revalidate?: unknown }).revalidate === true) {
          return revalidateToken(token, internalApiUrl);
        }

        const nextName: unknown = session?.user?.name;
        const nextImage: unknown = session?.user?.image;

        if (typeof nextName === 'string') {
          const trimmed = nextName.trim();
          if (trimmed.length > 0 && splitGraphemes(trimmed).length <= MAX_NAME_LENGTH) {
            token.name = trimmed;
          }
        }
        if (nextImage === null) {
          // 프로필 사진을 지운 경우
          token.picture = null;
        } else if (
          typeof nextImage === 'string' &&
          nextImage.length <= MAX_IMAGE_URL_LENGTH &&
          /^(https?:\/\/|\/(?!\/))/.test(nextImage)
        ) {
          token.picture = nextImage;
        }
        return token;
      }

      // 2. 초기 로그인 시 (signIn 콜백에서 동기화한 결과를 토큰에 저장)
      if (account && user) {
        if (!user.accessToken || !user.refreshToken || !user.backendUser) {
          // signIn 콜백이 실패를 막아주지만, 혹시라도 여기까지 오면 세션을 오류 상태로 표시합니다.
          return { ...token, error: 'BackendSyncError' };
        }

        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.accessTokenExpires = getAccessTokenExpires(user.accessToken);
        token.userId = user.backendUser.id;
        token.kakaoId = user.backendUser.kakaoId ?? undefined; // 이메일 가입 계정은 비어 있음
        token.customId = user.backendUser.customId;
        // 이메일 로그인은 NextAuth 가 token.email 을 채우지 않으므로 백엔드 계정 이메일을 씁니다(프로필 메뉴 표시용).
        token.email = user.backendUser.email ?? token.email ?? null;

        // 백엔드 DB의 정보를 최우선으로 토큰에 저장 (수동 수정된 정보 유지)
        token.name = user.backendUser.nickname;
        token.picture = toPublicImageUrl(user.backendUser.profileImage, publicApiUrl);
        delete token.error;
        return token;
      }

      // 3. 이미 오류 상태인 세션은 그대로 둡니다 (클라이언트가 감지해 로그아웃 처리).
      if (token.error) {
        return token;
      }

      // 4. 토큰 만료 전이면 기존 토큰 반환 (만료 시각이 없으면 만료된 것으로 취급)
      if (
        token.accessToken &&
        typeof token.accessTokenExpires === 'number' &&
        Date.now() < token.accessTokenExpires
      ) {
        return token;
      }

      // 5. 토큰 만료 시 Refresh Token을 사용하여 갱신 시도
      return refreshAccessToken(token, internalApiUrl);
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string) || (token.sub ?? '');
        // accessToken은 브라우저가 백엔드를 직접 호출할 때 Bearer 헤더로 쓰이므로 노출합니다.
        // refreshToken은 서버(JWT 쿠키) 안에만 두고 클라이언트로 내보내지 않습니다.
        session.user.accessToken = token.error ? undefined : (token.accessToken as string);
        session.user.kakaoId = token.kakaoId;
        session.user.customId = token.customId as string;
        session.user.error = token.error as string;
        
        // 토큰의 최신 정보를 세션에 반영
        session.user.name = token.name;
        session.user.image = token.picture;
      }
      return session;
    },
  },
};

/** 카카오 연결 모드로 처리할 콜백 요청용 옵션. signIn 만 연결 모드로 바꿉니다. */
export function createAuthOptions(link: KakaoLinkRequest): NextAuthOptions {
  return {
    ...authOptions,
    callbacks: { ...authOptions.callbacks, signIn: (params) => handleSignIn(params, link) },
  };
}
