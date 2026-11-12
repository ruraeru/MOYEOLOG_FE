import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function GET(request: NextRequest) {
  // 로그인한 사용자만 사용할 수 있습니다 (카카오 REST API 쿼터 보호).
  // getServerSession 대신 getToken을 사용해 세션 쿠키만 검증하고 토큰 갱신은 일으키지 않습니다.
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token || token.error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }
  if (query.length > 100) {
    return NextResponse.json({ error: 'Query is too long' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://dapi.kakao.com/v2/search/image?query=${encodeURIComponent(query)}&size=1`,
      {
        headers: {
          Authorization: `KakaoAK ${process.env.KAKAO_CLIENT_ID}`,
        },
      }
    );

    const data = await response.json();
    const imageUrl = data.documents?.[0]?.image_url || null;

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('Image search failed:', error);
    return NextResponse.json({ error: 'Failed to search image' }, { status: 500 });
  }
}
