/**
 * 외부 URL/IP 안전성 검사 (SSRF 방지용 순수 함수 모음).
 * 네트워크나 Node 전용 API에 의존하지 않아 단독으로 테스트할 수 있습니다.
 */

/** "1.2.3.4" 형태의 IPv4 문자열을 4바이트 배열로 변환합니다. 형식이 다르면 null. */
export function parseIPv4(input: string): number[] | null {
  const parts = input.split('.');
  if (parts.length !== 4) return null;
  const bytes: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    bytes.push(n);
  }
  return bytes;
}

/** IPv6 문자열을 16비트 그룹 8개로 변환합니다. 형식이 다르면 null. */
export function parseIPv6(input: string): number[] | null {
  let s = input;
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  const zone = s.indexOf('%');
  if (zone !== -1) s = s.slice(0, zone);
  if (!s.includes(':')) return null;

  // 끝부분의 IPv4 표기(::ffff:1.2.3.4)를 16비트 그룹 2개로 치환
  const lastColon = s.lastIndexOf(':');
  const tail = s.slice(lastColon + 1);
  if (tail.includes('.')) {
    const v4 = parseIPv4(tail);
    if (!v4) return null;
    s = `${s.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }

  const halves = s.split('::');
  if (halves.length > 2) return null;

  const toGroups = (part: string): number[] | null => {
    if (part === '') return [];
    const groups: number[] = [];
    for (const g of part.split(':')) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
      groups.push(parseInt(g, 16));
    }
    return groups;
  };

  const head = toGroups(halves[0]);
  if (!head) return null;

  if (halves.length === 1) {
    return head.length === 8 ? head : null;
  }

  const rest = toGroups(halves[1]);
  if (!rest) return null;
  const missing = 8 - head.length - rest.length;
  if (missing < 1) return null;
  return [...head, ...new Array<number>(missing).fill(0), ...rest];
}

function isPublicIPv4Bytes(b: number[]): boolean {
  const [a, c, d] = [b[0], b[1], b[2]];
  if (a === 0) return false; // 0.0.0.0/8 (this network)
  if (a === 10) return false; // 10.0.0.0/8 (private)
  if (a === 100 && c >= 64 && c <= 127) return false; // 100.64.0.0/10 (CGNAT)
  if (a === 127) return false; // 127.0.0.0/8 (loopback)
  if (a === 169 && c === 254) return false; // 169.254.0.0/16 (link-local, cloud metadata)
  if (a === 172 && c >= 16 && c <= 31) return false; // 172.16.0.0/12 (private)
  if (a === 192 && c === 0 && d === 0) return false; // 192.0.0.0/24 (IETF protocol assignments)
  if (a === 192 && c === 0 && d === 2) return false; // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && c === 88 && d === 99) return false; // 192.88.99.0/24 (6to4 relay)
  if (a === 192 && c === 168) return false; // 192.168.0.0/16 (private)
  if (a === 198 && (c === 18 || c === 19)) return false; // 198.18.0.0/15 (benchmarking)
  if (a === 198 && c === 51 && d === 100) return false; // 198.51.100.0/24 (TEST-NET-2)
  if (a === 203 && c === 0 && d === 113) return false; // 203.0.113.0/24 (TEST-NET-3)
  if (a >= 224) return false; // 224.0.0.0/4 (multicast), 240.0.0.0/4 (reserved, broadcast)
  return true;
}

function isPublicIPv6Groups(g: number[]): boolean {
  // 글로벌 유니캐스트(2000::/3)만 허용합니다.
  // ::, ::1, IPv4-mapped(::ffff:0:0/96), IPv4-compatible, fc00::/7, fe80::/10, ff00::/8 등은 여기서 모두 걸러집니다.
  if ((g[0] & 0xe000) !== 0x2000) return false;
  if (g[0] === 0x2001 && g[1] === 0x0db8) return false; // 2001:db8::/32 (documentation)
  if (g[0] === 0x2001 && g[1] === 0x0000) return false; // 2001::/32 (Teredo — IPv4 내장)
  if (g[0] === 0x2002) return false; // 2002::/16 (6to4 — IPv4 내장)
  return true;
}

/** 공인(외부에서 라우팅 가능한) IP 주소인지 검사합니다. IP 형식이 아니면 false. */
export function isPublicIp(address: string): boolean {
  const v4 = parseIPv4(address);
  if (v4) return isPublicIPv4Bytes(v4);
  const v6 = parseIPv6(address);
  if (v6) return isPublicIPv6Groups(v6);
  return false;
}

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home', '.corp', '.intranet', '.home.arpa'];

export type UrlCheckResult =
  | { ok: true; url: URL; hostname: string; isIpLiteral: boolean }
  | { ok: false; reason: string };

/**
 * 프록시가 요청해도 되는 URL인지 문자열 수준에서 검사합니다.
 * (호스트명이 도메인인 경우 DNS 조회 결과는 별도로 isPublicIp로 검사해야 합니다.)
 */
export function checkRemoteUrl(raw: string): UrlCheckResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid url' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'unsupported protocol' };
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'credentials are not allowed' };
  }

  let hostname = url.hostname.toLowerCase();
  if (hostname.endsWith('.')) hostname = hostname.slice(0, -1);
  if (!hostname) return { ok: false, reason: 'missing host' };

  // IPv6 리터럴 ([::1] 등)
  if (hostname.startsWith('[')) {
    const address = hostname.slice(1, -1);
    if (!isPublicIp(address)) return { ok: false, reason: 'non-public address' };
    return { ok: true, url, hostname: address, isIpLiteral: true };
  }

  // IPv4 리터럴 (WHATWG URL 파서가 0x7f.1, 2130706433 같은 표기도 점-십진 표기로 정규화합니다)
  if (parseIPv4(hostname)) {
    if (!isPublicIp(hostname)) return { ok: false, reason: 'non-public address' };
    return { ok: true, url, hostname, isIpLiteral: true };
  }

  // 점이 없는 호스트명(app, db, localhost 등 내부 서비스 이름)은 거부
  if (!hostname.includes('.')) return { ok: false, reason: 'non-public hostname' };
  // 숫자로 끝나는 호스트명은 IP로 해석될 여지가 있으므로 거부
  if (/\.\d+$/.test(hostname)) return { ok: false, reason: 'non-public hostname' };
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return { ok: false, reason: 'non-public hostname' };
  }

  return { ok: true, url, hostname, isIpLiteral: false };
}

/**
 * 로그인 후 이동할 callbackUrl이 같은 사이트 내 상대 경로인지 검사합니다.
 * ("/"로 시작, "//" 또는 "/\" 금지, 스킴/제어문자 금지) 안전하지 않으면 fallback을 반환합니다.
 */
export function safeCallbackPath(value: string | null | undefined, fallback = '/memo'): string {
  if (!value || typeof value !== 'string') return fallback;
  if (value.length > 2048) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  // 로그인 페이지 자신으로 되돌아오는 것은 의미가 없으므로 기본 경로로 보냅니다.
  const pathOnly = value.split(/[?#]/)[0];
  if (pathOnly === '/') return fallback;
  return value;
}
