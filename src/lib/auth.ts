import type { NextAuthOptions } from 'next-auth';
import KakaoProvider from 'next-auth/providers/kakao';

interface KakaoProfile {
  id: number;
  kakao_account?: {
    name?: string;
    email?: string;
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
  kakaoId?: string;
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

const MAX_NAME_LENGTH = 50;
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
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/',
    error: '/',
  },
  callbacks: {
    /**
     * 카카오 인증 직후 백엔드와 사용자 정보를 동기화합니다.
     * 동기화에 실패하면 (accessToken 없는) 반쪽짜리 세션을 만들지 않고 로그인을 실패 처리합니다.
     * 성공 시 결과를 user 객체에 담아 jwt 콜백으로 전달합니다.
     */
    async signIn({ user, account, profile }) {
      if (!account || !profile) return '/?error=SyncFailed';

      const internalApiUrl = process.env.BACKEND_INTERNAL_URL || 'http://app:8080';
      const kakaoProfile = profile as unknown as KakaoProfile;

      const nickname = kakaoProfile.kakao_account?.name ||
                       user.name ||
                       kakaoProfile.properties?.nickname ||
                       kakaoProfile.kakao_account?.profile?.nickname ||
                       '사용자';

      const email = kakaoProfile.kakao_account?.email || user.email || '';
      const profileImage = user.image ||
                           kakaoProfile.properties?.profile_image ||
                           kakaoProfile.kakao_account?.profile?.profile_image_url || '';

      try {
        const syncData = {
          kakaoId: kakaoProfile.id.toString(),
          email: email,
          nickname: nickname,
          profileImage: profileImage,
        };

        const response = await fetch(`${internalApiUrl}/api/auth/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // 서버 간 호출임을 증명하는 공유 시크릿 (런타임 환경 변수, 브라우저에 노출되지 않음)
            'X-Internal-Secret': process.env.INTERNAL_API_SECRET ?? '',
          },
          body: JSON.stringify(syncData),
          signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
        });

        if (!response.ok) {
          console.error('Backend sync failed:', response.status);
          return '/?error=SyncFailed';
        }

        const data = (await response.json()) as BackendAuthResponse;
        if (!data?.accessToken || !data?.refreshToken || !data?.user?.id) {
          console.error('Backend sync returned an unexpected response');
          return '/?error=SyncFailed';
        }

        user.accessToken = data.accessToken;
        user.refreshToken = data.refreshToken;
        user.backendUser = data.user;
        return true;
      } catch (error) {
        console.error('Backend sync error:', error);
        return '/?error=SyncFailed';
      }
    },
    async jwt({ token, user, account, trigger, session }) {
      const internalApiUrl = process.env.BACKEND_INTERNAL_URL || 'http://app:8080';
      const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://moyeolog.ruraeru.xyz';

      // 1. 세션 업데이트 요청 시 (trigger === "update")
      //    클라이언트가 보낸 값이므로 표시용 이름/이미지만, 형식이 올바를 때에만 반영합니다.
      if (trigger === "update" && session) {
        const nextName: unknown = session?.user?.name;
        const nextImage: unknown = session?.user?.image;

        if (typeof nextName === 'string') {
          const trimmed = nextName.trim();
          if (trimmed.length > 0 && trimmed.length <= MAX_NAME_LENGTH) {
            token.name = trimmed;
          }
        }
        if (
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
        token.kakaoId = user.backendUser.kakaoId;
        token.customId = user.backendUser.customId;

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

        if (response.status === 400 || response.status === 401 || response.status === 403) {
          // 리프레시 토큰이 거부됨 → 다시 로그인해야 합니다.
          console.error('Refresh token rejected:', response.status);
          return { ...token, error: 'RefreshAccessTokenError' };
        }

        if (!response.ok) {
          // 백엔드 일시 장애: 세션을 버리지 않고 다음 요청에서 다시 시도합니다.
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
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string) || (token.sub ?? '');
        // accessToken은 브라우저가 백엔드를 직접 호출할 때 Bearer 헤더로 쓰이므로 노출합니다.
        // refreshToken은 서버(JWT 쿠키) 안에만 두고 클라이언트로 내보내지 않습니다.
        session.user.accessToken = token.error ? undefined : (token.accessToken as string);
        session.user.kakaoId = token.kakaoId as string;
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
