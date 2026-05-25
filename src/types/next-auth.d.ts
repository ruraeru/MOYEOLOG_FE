import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      accessToken?: string;
      kakaoId?: string;
      customId?: string;
    };
  }

  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    accessToken?: string;
    kakaoId?: string;
    customId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    kakaoId?: string;
    userId?: string;
    customId?: string;
  }
}
