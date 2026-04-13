import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
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
