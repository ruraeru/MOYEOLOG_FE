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
    async jwt({ token, user, account, profile }) {
      // 초기 로그인 시
      if (account && profile && user) {
        console.log('--- Auth Sync Start ---');
        
        const kakaoProfile = profile as unknown as KakaoProfile;
        
        // 로그(Full Raw Profile)에서 확인된 경로: kakao_account.name 에 '황태우'가 들어있음
        const nickname = kakaoProfile.kakao_account?.name || 
                         user.name || 
                         kakaoProfile.properties?.nickname || 
                         kakaoProfile.kakao_account?.profile?.nickname ||
                         '사용자';

        const email = kakaoProfile.kakao_account?.email || user.email || '';

        // 이미지 추출
        const profileImage = user.image || 
                             kakaoProfile.properties?.profile_image || 
                             kakaoProfile.kakao_account?.profile?.profile_image_url || '';

        console.log('Extracted Data:', { nickname, email, kakaoId: kakaoProfile.id });

        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
          
          const syncData = {
            kakaoId: kakaoProfile.id.toString(),
            email: email,
            nickname: nickname,
            profileImage: profileImage,
          };

          console.log('Sending to Backend:', syncData);

          // 5초 타임아웃 설정으로 무한 로딩 방지
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

          console.log('Backend Response Status:', response.status);

          if (response.ok) {
            const data = await response.json();
            console.log('Backend Sync Success, User ID:', data.user.id);
            token.accessToken = data.accessToken;
            token.userId = data.user.id;
            token.kakaoId = data.user.kakaoId;
          } else {
            console.error('Backend Sync Failed');
          }
        } catch (error) {
          console.error('Backend sync error (could be timeout or unreachable):', error);
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
      }
      return session;
    },
  },
};
