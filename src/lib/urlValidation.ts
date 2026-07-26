/**
 * SEC-001: SSRF protection — URL validation for server-side fetches.
 * Central allowlist and validation for receipt/document file URLs.
 */

// ─── Allowed storage hosts (exact match only, no wildcards) ────────
const ALLOWED_RECEIPT_HOSTS = [
  'images.fillout.com',
  'uploads.zite.com',
];

// ─── Private/internal IP patterns ──────────────────────────────────
function isPrivateHost(hostname: string): boolean {
  // Normalise
  const h = hostname.toLowerCase().trim();

  // Localhost variants
  if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1' || h === '[::1]') return true;

  // IPv6 loopback with brackets
  if (h.startsWith('[') && h.includes('::1')) return true;

  // Dotted-decimal private ranges
  const parts = h.split('.');
  if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
    const octets = parts.map(Number);
    const [a, b] = octets;
    // 10.x.x.x
    if (a === 10) return true;
    // 172.16.0.0 – 172.31.255.255
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.x.x
    if (a === 192 && b === 168) return true;
    // 169.254.x.x (link-local)
    if (a === 169 && b === 254) return true;
    // 127.x.x.x (full loopback range)
    if (a === 127) return true;
    // 0.x.x.x
    if (a === 0) return true;
  }

  return false;
}

export type UrlValidationResult =
  | { valid: true; parsedUrl: URL }
  | { valid: false; reason: string };

/**
 * Validate a file URL for server-side use (SSRF protection).
 * Returns a result object — never throws.
 */
export function validateFileUrl(rawUrl: string): UrlValidationResult {
  // 1. Parse URL safely
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return { valid: false, reason: 'Malformed URL.' };
  }

  // 2. HTTPS only
  if (parsedUrl.protocol !== 'https:') {
    return { valid: false, reason: 'Only HTTPS URLs are accepted.' };
  }

  // 3. Block private/internal hosts
  if (isPrivateHost(parsedUrl.hostname)) {
    return { valid: false, reason: 'Internal network addresses are not allowed.' };
  }

  // 4. Host allowlist (exact match)
  const hostname = parsedUrl.hostname.toLowerCase();
  if (!ALLOWED_RECEIPT_HOSTS.includes(hostname)) {
    return { valid: false, reason: 'File host is not on the approved list.' };
  }

  return { valid: true, parsedUrl };
}

/**
 * Fetch a URL with redirect protection.
 * If redirects occur, each destination is validated against the allowlist.
 * Returns the Response on success; throws an Error with a safe message on failure.
 */
export async function safeFetch(validatedUrl: URL): Promise<Response> {
  // Follow redirects manually to validate each hop
  let currentUrl: string = validatedUrl.href;
  const maxRedirects = 5;

  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(currentUrl, { redirect: 'manual' });

    // Not a redirect — return the response
    if (res.status < 300 || res.status >= 400) {
      return res;
    }

    // Redirect — validate the destination
    const location = res.headers.get('location');
    if (!location) {
      throw new Error('Redirect without Location header.');
    }

    let nextUrl: URL;
    try {
      nextUrl = new URL(location, currentUrl);
    } catch {
      throw new Error('Redirect to malformed URL.');
    }

    const check = validateFileUrl(nextUrl.href);
    if (!check.valid) {
      throw new Error('Redirect to disallowed host.');
    }

    currentUrl = nextUrl.href;
  }

  throw new Error('Too many redirects.');
}
