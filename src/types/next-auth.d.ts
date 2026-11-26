import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      accessToken?: string;
      kakaoId?: string; // 이메일 가입 계정은 비어 있음
      customId?: string;
      error?: string;
    };
  }

  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    // 아래 값들은 서버의 signIn → jwt 콜백 사이에서만 전달되며 클라이언트로 나가지 않습니다.
    accessToken?: string;
    refreshToken?: string;
    backendUser?: {
      id: string;
      kakaoId?: string | null; // 이메일 가입 계정은 없음
      customId?: string;
      nickname?: string;
      email?: string | null;
      profileImage?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    kakaoId?: string;
    userId?: string;
    customId?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}
