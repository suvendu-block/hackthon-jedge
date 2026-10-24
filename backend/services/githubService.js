import AppError from '../utils/AppError.js';
import { safeFetch } from '../utils/safeFetch.js';

/// githubService — static inspection of a team's repository through GitHub's
/// REST API. Metadata, the file tree, and the README; never a checkout, never
/// an execution (ADR-0012). Reads may use the team's granted token, the
/// server's optional GITHUB_TOKEN, or nothing at all for public repos.

const GH_HOSTS = ['api.github.com', 'raw.githubusercontent.com', 'objects.githubusercontent.com'];
const API_CAP = 1_000_000;         // metadata responses stay well under 1MB
const README_CAP = 48 * 1024;      // enough README to judge a project by
const TREE_PATHS = 5000;           // paths we count before calling it a day

// https://github.com/owner/repo(+suffixes) → { owner, repo }, or null if it
// isn't a plain GitHub repository link
export const parseRepoUrl = (raw) => {
    let url;
    try {
        url = new URL(String(raw).trim());
    } catch {
        return null;
    }
    if (url.protocol !== 'https:' || url.hostname !== 'github.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, '');
    if (!/^[\w.-]{1,100}$/.test(owner) || !/^[\w.-]{1,100}$/.test(repo)) return null;
    return { owner, repo };
};

// one API call through the SSRF guard. non-2xx is returned, not thrown —
// callers map status codes to friendlier errors (grant flow needs the 401s)
const gh = async (path, { token, accept = 'application/vnd.github+json', host = 'api.github.com' } = {}) =>
    safeFetch(`https://${host}${path}`, {
        allowHosts: GH_HOSTS,
        headers: {
            'User-Agent': 'HackJudge-AI',
            Accept: accept,
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        maxBytes: API_CAP,
        timeoutMs: 10_000,
        maxRedirects: 3
    });

// shared status → error mapping (rate limits get their own honest code)
const toAppError = (res, { missingIsPrivate = false } = {}) => {
    if (res.status === 401) return new AppError('GitHub rejected the access token', 400, 'TOKEN_REJECTED');
    if (res.status === 404) {
        return new AppError(
            missingIsPrivate
                ? 'Repository not found on GitHub — check the URL (private repos need a granted read token)'
                : 'Repository not found on GitHub',
            404, 'REPO_NOT_FOUND'
        );
    }
    if (res.status === 403 || res.status === 429) {
        if (Number(res.headers.get('x-ratelimit-remaining')) === 0) {
            return new AppError('GitHub API rate limit reached — try again in a few minutes', 429, 'GITHUB_RATE_LIMITED');
        }
        return new AppError('GitHub refused the request', 403, 'REPO_FORBIDDEN');
    }
    return new AppError('GitHub did not answer', 502, 'SOURCE_UNAVAILABLE');
};

/**
 * does this token actually reach this repo? called at grant time so we never
 * store a token we haven't seen work.
 */
export const validateRepoAccess = async (owner, repo, token) => {
    const res = await gh(`/repos/${owner}/${repo}`, { token });
    if (!res.ok) throw toAppError(res, { missingIsPrivate: true });
    const meta = JSON.parse(res.text);
    const scopes = (res.headers.get('x-oauth-scopes') || '')
        .split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
    return { private: !!meta.private, fullName: meta.full_name, scopes };
};

// what the tree tells us without reading a single line of code
export const analyzePaths = (paths, { truncated = false } = {}) => {
    const exts = {};
    let testLikeFiles = 0;
    let workflows = 0;
    let docs = 0;
    let hasManifest = false;
    let hasDockerfile = false;

    const manifests = new Set([
        'package.json', 'requirements.txt', 'pyproject.toml', 'go.mod',
        'cargo.toml', 'pom.xml', 'gemfile', 'composer.json', 'makefile'
    ]);

    for (const p of paths) {
        const file = p.split('/').pop() || '';
        const ext = (file.match(/\.([A-Za-z0-9]+)$/) || [])[1]?.toLowerCase();
        if (ext) exts[ext] = (exts[ext] || 0) + 1;
        if (/(^|\/)(tests?|specs?)(\/|$)|\.(test|spec)\.[A-Za-z0-9]+$/.test(p)) testLikeFiles += 1;
        if (p.startsWith('.github/workflows/')) workflows += 1;
        if (/(^|\/)docs?(\/|$)/i.test(p)) docs += 1;
        if (manifests.has(file.toLowerCase())) hasManifest = true;
        if (file.toLowerCase() === 'dockerfile') hasDockerfile = true;
    }

    return {
        totalFiles: paths.length,
        topExtensions: Object.entries(exts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([extension, count]) => ({ extension, count })),
        testLikeFiles,
        hasCI: workflows > 0,
        hasDocs: docs > 0,
        hasDockerfile,
        hasManifest,
        truncated
    };
};

/**
 * fetch the full insight for one repository. each optional piece (languages,
 * tree, README) degrades to a note instead of sinking the whole fetch — a
 * repo without a README is normal, not an error.
 */
export const fetchInsight = async (owner, repo, { token } = {}) => {
    const notes = [];

    const repoRes = await gh(`/repos/${owner}/${repo}`, { token });
    if (!repoRes.ok) throw toAppError(repoRes, { missingIsPrivate: true });
    const meta = JSON.parse(repoRes.text);

    const facts = {
        fullName: meta.full_name,
        visibility: meta.private ? 'private' : 'public',
        stars: meta.stargazers_count ?? 0,
        forks: meta.forks_count ?? 0,
        license: meta.license?.spdx_id || null,
        defaultBranch: meta.default_branch || 'main',
        createdAt: meta.created_at,
        pushedAt: meta.pushed_at,
        sizeKB: meta.size ?? 0
    };

    try {
        const res = await gh(`/repos/${owner}/${repo}/languages`, { token });
        if (res.ok) {
            facts.languages = Object.entries(JSON.parse(res.text))
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([name, bytes]) => ({ name, bytes }));
        } else {
            notes.push(`languages unavailable (HTTP ${res.status})`);
        }
    } catch {
        notes.push('languages unavailable');
    }

    try {
        const res = await gh(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(facts.defaultBranch)}?recursive=1`, { token });
        if (res.ok) {
            const data = JSON.parse(res.text);
            const blobs = (data.tree || []).filter(e => e.type === 'blob').map(e => e.path);
            facts.treeStats = analyzePaths(blobs.slice(0, TREE_PATHS), {
                truncated: !!data.truncated || blobs.length > TREE_PATHS
            });
        } else {
            notes.push(`file tree unavailable (HTTP ${res.status})`);
        }
    } catch {
        notes.push('file tree unavailable');
    }

    try {
        const res = await gh(`/repos/${owner}/${repo}/readme`, { token, accept: 'application/vnd.github.raw+json' });
        if (res.ok) {
            facts.readmeExcerpt = res.text.slice(0, README_CAP);
        } else {
            notes.push(`README unavailable (HTTP ${res.status})`);
        }
    } catch {
        notes.push('README unavailable');
    }

    return {
        facts,
        notes,
        visibility: facts.visibility,
        fetchedVia: token ? 'team-token' : 'public'
    };
};
