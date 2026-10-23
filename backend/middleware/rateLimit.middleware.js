import AppError from '../utils/AppError.js';

// tiny in-memory sliding window — one server instance, no extra infra.
// buckets: key -> [timestamps]; old hits fall out of the window naturally.
const buckets = new Map();

const WINDOW_PRUNE_AT = 5000;   // don't let the map grow forever

const rateLimit = ({ windowMs, max, keyFn }) => (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    const hits = (buckets.get(key) || []).filter(t => now - t < windowMs);

    if (hits.length >= max) {
        const waitSec = Math.ceil((windowMs - (now - hits[0])) / 1000);
        return next(new AppError(`Too many requests — try again in ${waitSec}s`, 429, 'RATE_LIMITED'));
    }

    hits.push(now);
    buckets.set(key, hits);

    if (buckets.size > WINDOW_PRUNE_AT) {
        for (const [k, ts] of buckets) {
            if (ts.every(t => now - t >= windowMs)) buckets.delete(k);
        }
    }

    next();
};

export default rateLimit;
