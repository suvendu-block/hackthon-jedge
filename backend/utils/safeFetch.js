import dns from 'node:dns';
import AppError from './AppError.js';

/// safeFetch — every outbound request the server makes goes through here
/// (SECURITY §6). The rules: https only, standard port only, host allowlist,
/// DNS must resolve to public addresses, redirects re-validated hop by hop,
/// response body capped, and a hard timeout. A team-supplied URL never gets
/// to point the server at its own internals.

// is this address private, loopback, link-local, or otherwise not ours to touch?
export const isPrivateAddress = (addr) => {
    const a = String(addr || '').toLowerCase();

    if (a.includes(':')) {
        // IPv6 (and v4-mapped v6 like ::ffff:127.0.0.1)
        if (a === '::1' || a === '::') return true;
        if (a.startsWith('fc') || a.startsWith('fd')) return true;   // fc00::/7 unique local
        if (a.startsWith('fe8') || a.startsWith('fe9') || a.startsWith('fea') || a.startsWith('feb')) return true; // fe80::/10
        const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        if (mapped) return isPrivateAddress(mapped[1]);
        return false;
    }

    const octets = a.split('.').map(Number);
    if (octets.length !== 4 || octets.some(n => Number.isNaN(n))) return true; // garbage counts as unsafe
    const [o1, o2, o3] = octets;

    if (o1 === 0) return true;                                        // 0.0.0.0/8
    if (o1 === 10) return true;                                       // 10.0.0.0/8
    if (o1 === 127) return true;                                      // loopback
    if (o1 === 169 && o2 === 254) return true;                        // link-local (cloud metadata lives here)
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;              // 172.16.0.0/12
    if (o1 === 192 && o2 === 168) return true;                        // 192.168.0.0/16
    if (o1 === 100 && o2 >= 64 && o2 <= 127) return true;             // 100.64.0.0/10 CGNAT
    if (o1 === 198 && (o2 === 18 || o2 === 19)) return true;          // benchmark range
    return false;
};

// check a URL against the rules — throws AppError(400, UNSAFE_URL) on any miss
export const assertSafeUrl = async (rawUrl, { allowHosts, lookup = dns.promises.lookup } = {}) => {
    let url;
    try {
        url = new URL(String(rawUrl));
    } catch {
        throw new AppError('That is not a valid URL', 400, 'UNSAFE_URL');
    }

    if (url.protocol !== 'https:') {
        throw new AppError('Only https URLs are fetched from this server', 400, 'UNSAFE_URL');
    }
    if (url.port && url.port !== '443') {
        throw new AppError('Only the standard https port is allowed', 400, 'UNSAFE_URL');
    }
    if (allowHosts && !allowHosts.includes(url.hostname)) {
        throw new AppError(`This server only fetches from: ${allowHosts.join(', ')}`, 400, 'UNSAFE_URL');
    }

    // resolve first — a hostname that lands on a private range never gets a connection
    let addresses;
    try {
        addresses = await lookup(url.hostname, { all: true });
    } catch {
        throw new AppError(`Could not resolve host "${url.hostname}"`, 400, 'UNSAFE_URL');
    }
    for (const entry of addresses) {
        if (isPrivateAddress(entry.address)) {
            throw new AppError('That URL resolves to a private network address', 400, 'UNSAFE_URL');
        }
    }

    return url;
};

// read a response body with a byte ceiling — big files stop being interesting
// well before they stop being dangerous
const readCapped = async (res, maxBytes) => {
    if (!res.body) return '';
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel().catch(() => {});
            throw new AppError('The remote response was too large to process', 413, 'RESPONSE_TOO_LARGE');
        }
        chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf8');
};

/**
 * fetch with every guard applied. returns { status, ok, headers, text, finalUrl }
 * for any 2xx/4xx — callers decide what those mean — and throws AppError only
 * for guard failures (UNSAFE_URL), size (RESPONSE_TOO_LARGE), or network
 * trouble (SOURCE_UNAVAILABLE). Redirects are followed manually so each hop
 * goes through the same validation as the first URL.
 */
export const safeFetch = async (rawUrl, {
    allowHosts,
    headers = {},
    method = 'GET',
    maxBytes = 1_000_000,
    timeoutMs = 10_000,
    maxRedirects = 3,
    lookup = dns.promises.lookup,
    fetchImpl = globalThis.fetch
} = {}) => {
    let current = String(rawUrl);

    for (let hop = 0; hop <= maxRedirects; hop++) {
        const url = await assertSafeUrl(current, { allowHosts, lookup });
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);

        try {
            const res = await fetchImpl(url.toString(), { method, headers, redirect: 'manual', signal: ctrl.signal });

            // a redirect is just another URL that has to pass the same checks
            if ([301, 302, 303, 307, 308].includes(res.status)) {
                const location = res.headers.get('location');
                await res.body?.cancel?.().catch(() => {});
                if (!location) throw new AppError('Redirect without a destination', 502, 'SOURCE_UNAVAILABLE');
                current = new URL(location, url).toString();
                continue;
            }

            const text = await readCapped(res, maxBytes);
            return { status: res.status, ok: res.ok, headers: res.headers, text, finalUrl: url.toString() };
        } catch (err) {
            if (err instanceof AppError) throw err;
            if (err?.name === 'AbortError') {
                throw new AppError('The remote server did not answer in time', 502, 'SOURCE_UNAVAILABLE');
            }
            throw new AppError('Could not reach the remote server', 502, 'SOURCE_UNAVAILABLE');
        } finally {
            clearTimeout(timer);
        }
    }

    throw new AppError('Too many redirects', 502, 'SOURCE_UNAVAILABLE');
};
