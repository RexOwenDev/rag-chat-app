/**
 * SSRF protection for URL ingestion.
 *
 * Modern Node.js fetch uses undici and does not support http.Agent wrappers,
 * so ssrf-req-filter's agent approach cannot be used directly. Instead we
 * resolve the target hostname to all its IPs and block private/reserved ranges
 * before the fetch request is made.
 *
 * Blocked ranges:
 *   127.0.0.0/8    — loopback
 *   10.0.0.0/8     — private
 *   172.16.0.0/12  — private
 *   192.168.0.0/16 — private
 *   169.254.0.0/16 — link-local (AWS metadata: 169.254.169.254)
 *   0.0.0.0/8      — this network
 *   ::1             — IPv6 loopback
 *   fc00::/7       — IPv6 unique local (fc00:: / fd00::)
 *   fe80::/10      — IPv6 link-local
 */

import dns from 'dns/promises';

// [start, end] inclusive — both as 32-bit unsigned integers
const BLOCKED_V4_RANGES: Array<[number, number]> = [
  [0x7f000000, 0x7fffffff], // 127.0.0.0/8   loopback
  [0x0a000000, 0x0affffff], // 10.0.0.0/8    private
  [0xac100000, 0xac1fffff], // 172.16.0.0/12 private
  [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16 private
  [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16 link-local
  [0x00000000, 0x00ffffff], // 0.0.0.0/8     this-network
  [0xe0000000, 0xffffffff], // 224.0.0.0/4+  multicast + reserved
];

function ipv4ToUint32(ip: string): number {
  return ip
    .split('.')
    .reduce((acc, octet) => (acc * 256 + parseInt(octet, 10)), 0) >>> 0;
}

function isBlockedV4(ip: string): boolean {
  const n = ipv4ToUint32(ip);
  return BLOCKED_V4_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
}

function isBlockedV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === '::1' ||
    lower.startsWith('::ffff:127.') || // IPv4-mapped loopback
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe80:') ||
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb')
  );
}

/**
 * Validates that a URL is safe to fetch — resolves DNS and rejects any
 * hostname that maps to a private or reserved IP address.
 *
 * Throws an Error (not ExtractionError) so callers can return 400 before
 * any network activity occurs.
 */
export async function assertSafeURL(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(
      `Unsupported protocol "${parsed.protocol}". Only HTTP and HTTPS are allowed.`
    );
  }

  // Block explicit IP literals without needing DNS lookup
  if (isBlockedV4(parsed.hostname)) {
    throw new Error(
      `URL "${rawUrl}" targets a private/reserved IP address. SSRF protection blocked this request.`
    );
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.lookup(parsed.hostname, { all: true });
  } catch {
    throw new Error(`Could not resolve hostname "${parsed.hostname}".`);
  }

  for (const { address, family } of addresses) {
    const blocked = family === 4 ? isBlockedV4(address) : isBlockedV6(address);
    if (blocked) {
      throw new Error(
        `URL "${rawUrl}" resolves to a private IP address (${address}). SSRF protection blocked this request.`
      );
    }
  }
}
