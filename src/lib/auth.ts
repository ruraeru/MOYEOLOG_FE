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
  },
  callbacks: {
    async jwt({ token, user, account, profile, trigger, session }) {
      const internalApiUrl = process.env.BACKEND_INTERNAL_URL || 'http://app:8080';
      const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://moyeolog.kro.kr';

      // 1. 세션 업데이트 요청 시 (trigger === "update")
      if (trigger === "update" && session) {
        token.name = session.user.name;
        token.picture = session.user.image;
        return token;
      }

      // 2. 초기 로그인 시
      if (account && profile && user) {
        
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

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(`${internalApiUrl}/api/auth/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(syncData),
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            token.accessToken = data.accessToken;
            token.refreshToken = data.refreshToken;
            token.userId = data.user.id;
            token.kakaoId = data.user.kakaoId;
            token.customId = data.user.customId;
            
            // 토큰 만료 시간 계산 (현재 시간 + 백엔드 설정값)
            // 기본적으로 JWT decode 해서 exp 값을 쓰는게 좋지만, 일단 24시간으로 설정
            token.accessTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
            
            // 백엔드 DB의 정보를 최우선으로 토큰에 저장 (수동 수정된 정보 유지)
            token.name = data.user.nickname;
            const finalImage = data.user.profileImage;
            token.picture = finalImage ? (finalImage.startsWith('/uploads/') ? `${publicApiUrl}${finalImage}` : finalImage) : null;
          }
        } catch (error) {
          console.error('Backend sync error:', error);
        }
        return token;
      }

      // 3. 토큰 만료 전이면 기존 토큰 반환
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // 4. 토큰 만료 시 Refresh Token을 사용하여 갱신 시도
      try {
        const response = await fetch(`${internalApiUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: token.refreshToken }),
        });

        const refreshedTokens = await response.json();

        if (!response.ok) throw refreshedTokens;

        return {
          ...token,
          accessToken: refreshedTokens.accessToken,
          accessTokenExpires: Date.now() + 24 * 60 * 60 * 1000,
          refreshToken: refreshedTokens.refreshToken ?? token.refreshToken, // 새 RT가 오면 교체, 아니면 기존 것 유지
        };
      } catch (error) {
        console.error('Error refreshing access token', error);
        return { ...token, error: 'RefreshAccessTokenError' };
      }
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string) || (token.sub ?? '');
        session.user.accessToken = token.accessToken as string;
        session.user.refreshToken = token.refreshToken as string;
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
