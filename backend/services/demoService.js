import { safeFetch } from '../utils/safeFetch.js';

/// demoService — "is the demo link alive, and what's on the other side?"
/// fetched through the SSRF guard with a small body cap; we keep only status
/// + page title, never the page itself.

// hosts a demo may plausibly live on. env DEMO_HOST_ALLOWLIST (comma list)
// replaces this wholesale for events that want a tighter or wider net.
export const demoHosts = () => {
    const fromEnv = (process.env.DEMO_HOST_ALLOWLIST || '')
        .split(',').map(s => s.trim()).filter(Boolean);
    return fromEnv.length ? fromEnv : [
        'github.com', 'gitlab.com', 'github.io',
        'drive.google.com', 'docs.google.com',
        'youtube.com', 'youtu.be', 'vimeo.com',
        'notion.so', 'vercel.app', 'netlify.app', 'onrender.com',
        'herokuapp.com', 'glitch.me', 'fly.dev', 'pages.dev'
    ];
};

// never throws — a blocked or dead demo is a recorded result, not a crash
export const checkDemo = async (url) => {
    try {
        const res = await safeFetch(url, {
            allowHosts: demoHosts(),
            headers: { 'User-Agent': 'HackJudge-AI' },
            maxBytes: 256 * 1024,
            timeoutMs: 8_000,
            maxRedirects: 3
        });
        const raw = (res.text.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i) || [])[1] || '';
        const title = raw.replace(/\s+/g, ' ').trim().slice(0, 150) || null;
        return {
            reachable: res.ok,
            httpStatus: res.status,
            title,
            error: res.ok ? null : `HTTP ${res.status}`
        };
    } catch (err) {
        return { reachable: false, httpStatus: null, title: null, error: err.message };
    }
};
