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
      const apiUrl = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://moyeolog.kro.kr:8080';

      // 1. 세션 업데이트 요청 시 (trigger === "update")
      if (trigger === "update" && session) {
        token.name = session.user.name;
        token.picture = session.user.image;
        return token;
      }

      // 2. 초기 로그인 시
      if (account && profile && user) {
        console.log('--- Auth Sync Start ---');
        
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

          const response = await fetch(`${apiUrl}/api/auth/sync`, {
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
            token.userId = data.user.id;
            token.kakaoId = data.user.kakaoId;
            token.customId = data.user.customId;
            
            // 백엔드 DB의 정보를 최우선으로 토큰에 저장 (수동 수정된 정보 유지)
            token.name = data.user.nickname;
            const finalImage = data.user.profileImage;
            token.picture = finalImage ? (finalImage.startsWith('/uploads/') ? `${apiUrl}${finalImage}` : finalImage) : null;
          }
        } catch (error) {
          console.error('Backend sync error:', error);
        }
        console.log('--- Auth Sync End ---');
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string) || (token.sub ?? '');
        session.user.accessToken = token.accessToken;
        session.user.kakaoId = token.kakaoId;
        session.user.customId = token.customId as string;
        
        // 토큰의 최신 정보를 세션에 반영
        session.user.name = token.name;
        session.user.image = token.picture;
      }
      return session;
    },
  },
};
