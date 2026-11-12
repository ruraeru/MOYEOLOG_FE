import { NextResponse } from 'next/server';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import type { LookupFunction } from 'node:net';
import { checkRemoteUrl, isPublicIp } from '@/lib/url-safety';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;

class ProxyError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * 실제 소켓 연결 직전에 호출되는 DNS 조회 함수입니다.
 * 조회된 주소 중 하나라도 공인 IP가 아니면 연결을 거부하므로,
 * 검사 시점과 연결 시점의 DNS 응답이 달라지는 문제(DNS rebinding)가 생기지 않습니다.
 */
const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '', 0);
    const list = addresses as dns.LookupAddress[];
    if (list.length === 0 || list.some((entry) => !isPublicIp(entry.address))) {
      const blocked = new Error(`Blocked non-public address for ${hostname}`) as NodeJS.ErrnoException;
      blocked.code = 'EBLOCKED';
      return callback(blocked, '', 0);
    }
    if (options.all) {
      (callback as unknown as (e: NodeJS.ErrnoException | null, a: dns.LookupAddress[]) => void)(null, list);
    } else {
      callback(null, list[0].address, list[0].family);
    }
  });
};

interface UpstreamResult {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

function fetchOnce(url: URL, signal: AbortSignal): Promise<UpstreamResult> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(
      url,
      {
        method: 'GET',
        lookup: publicOnlyLookup,
        signal,
        agent: false,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9',
          'Accept-Encoding': 'identity',
          Referer: 'https://www.naver.com/',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;

        // 리다이렉트/오류 응답은 본문을 읽지 않습니다.
        if (status < 200 || status >= 300) {
          res.resume();
          resolve({ status, headers: res.headers, body: Buffer.alloc(0) });
          return;
        }

        const declaredLength = Number(res.headers['content-length']);
        if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
          res.destroy();
          reject(new ProxyError(413, 'Image is too large'));
          return;
        }

        const chunks: Buffer[] = [];
        let received = 0;
        res.on('data', (chunk: Buffer) => {
          received += chunk.length;
          if (received > MAX_BYTES) {
            res.destroy();
            reject(new ProxyError(413, 'Image is too large'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }));
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function fetchImage(rawUrl: string, signal: AbortSignal): Promise<{ contentType: string; body: Buffer }> {
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    // 매 홉(리다이렉트 포함)마다 URL을 다시 검증합니다.
    const check = checkRemoteUrl(current);
    if (!check.ok) throw new ProxyError(400, `URL is not allowed: ${check.reason}`);

    const result = await fetchOnce(check.url, signal);

    if ([301, 302, 303, 307, 308].includes(result.status)) {
      const location = result.headers.location;
      if (!location) throw new ProxyError(502, 'Redirect without location');
      try {
        current = new URL(location, check.url).toString();
      } catch {
        throw new ProxyError(502, 'Invalid redirect location');
      }
      continue;
    }

    if (result.status < 200 || result.status >= 300) {
      throw new ProxyError(502, `Upstream responded with ${result.status}`);
    }

    const encoding = (result.headers['content-encoding'] || 'identity').toLowerCase();
    if (encoding !== 'identity') throw new ProxyError(502, 'Unsupported content encoding');

    const contentType = (result.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new ProxyError(415, 'Upstream is not a supported image type');
    }

    return { contentType, body: result.body };
  }

  throw new ProxyError(502, 'Too many redirects');
}

function errorResponse(status: number, message: string) {
  return NextResponse.json(
    { error: message },
    { status, headers: { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' } }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return errorResponse(400, 'URL is required');
  }
  if (imageUrl.length > 2048) {
    return errorResponse(400, 'URL is too long');
  }

  const signal = AbortSignal.timeout(TIMEOUT_MS);

  try {
    const { contentType, body } = await fetchImage(imageUrl, signal);

    return new NextResponse(new Uint8Array(body), {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(body.length),
        'Cache-Control': 'public, max-age=86400', // 24시간 캐싱
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Content-Disposition': 'inline',
      },
    });
  } catch (error) {
    if (error instanceof ProxyError) {
      return errorResponse(error.status, error.message);
    }
    const err = error as NodeJS.ErrnoException;
    if (signal.aborted || err?.name === 'AbortError' || err?.name === 'TimeoutError') {
      return errorResponse(504, 'Upstream timed out');
    }
    if (err?.code === 'EBLOCKED') {
      return errorResponse(400, 'URL is not allowed: non-public address');
    }
    console.error('Proxy failed:', err?.code || err?.message || error);
    return errorResponse(502, 'Failed to proxy image');
  }
}
