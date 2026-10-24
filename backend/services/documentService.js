import crypto from 'node:crypto';
import zlib from 'node:zlib';

/// documentService — read text out of uploaded slides/documents WITHOUT
/// executing anything: buffers in, strings out. docx/pptx are zip archives,
/// so we walk their central directory ourselves and inflate only the XML we
/// need (bounded output — a zip bomb just errors out). PDFs are stored but
/// not parsed; we say so in the report rather than pretending.

const TEXT_CAP = 200_000;          // ~200KB of extracted text is plenty for a draft
const INFLATE_CAP = 2_000_000;     // per-entry inflated ceiling
const MAX_ENTRIES = 4000;          // sanity for absurd archives

export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// pull XML text nodes, decoding the handful of entities that matter
const xmlText = (xml, tagRe) => {
    const out = [];
    for (const m of xml.matchAll(tagRe)) {
        out.push(m[1]
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
            .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
            .replace(/&amp;/g, '&'));
        if (out.join(' ').length > TEXT_CAP) break;
    }
    return out.join(' ');
};

// --- minimal zip reader (central directory → local entries → inflate) -----

const readZipEntries = (buf) => {
    // EOCD sits at the end (possibly followed by a comment) — scan back over it
    const scanFrom = Math.max(0, buf.length - 65_557);
    let eocd = -1;
    for (let i = buf.length - 22; i >= scanFrom; i--) {
        if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('not a zip archive');

    const count = Math.min(buf.readUInt16LE(eocd + 10), MAX_ENTRIES);
    let off = buf.readUInt32LE(eocd + 16);
    const entries = [];

    for (let i = 0; i < count && off + 46 <= buf.length; i++) {
        if (buf.readUInt32LE(off) !== 0x02014b50) break;
        const method = buf.readUInt16LE(off + 10);
        const compSize = buf.readUInt32LE(off + 20);
        const nameLen = buf.readUInt16LE(off + 28);
        const extraLen = buf.readUInt16LE(off + 30);
        const commentLen = buf.readUInt16LE(off + 32);
        const localOffset = buf.readUInt32LE(off + 42);
        const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
        entries.push({ name, method, compSize, localOffset });
        off += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
};

const readZipEntry = (buf, entry) => {
    const lo = entry.localOffset;
    if (lo + 30 > buf.length || buf.readUInt32LE(lo) !== 0x04034b50) return null;
    const nameLen = buf.readUInt16LE(lo + 26);
    const extraLen = buf.readUInt16LE(lo + 28);
    const start = lo + 30 + nameLen + extraLen;
    const data = buf.subarray(start, start + entry.compSize);
    if (entry.method === 0) return data;                       // stored as-is
    if (entry.method === 8) {
        return zlib.inflateRawSync(data, { maxOutputLength: INFLATE_CAP });
    }
    return null;                                               // exotic compression — skip
};

// --- per-format extraction ------------------------------------------------

const extractDocx = (buf) => {
    const entry = readZipEntries(buf).find(e => e.name === 'word/document.xml');
    if (!entry) return '';
    const xml = readZipEntry(buf, entry)?.toString('utf8') || '';
    return xmlText(xml, /<w:t[^>]*>([^<]*)<\/w:t>/g);
};

const extractPptx = (buf) => {
    const slides = readZipEntries(buf)
        .filter(e => /^ppt\/slides\/slide\d+\.xml$/.test(e.name))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const parts = [];
    for (const entry of slides) {
        const xml = readZipEntry(buf, entry)?.toString('utf8') || '';
        const text = xmlText(xml, /<a:t>([^<]*)<\/a:t>/g);
        if (text) parts.push(text);
        if (parts.join('\n').length > TEXT_CAP) break;
    }
    return parts.join('\n');
};

/**
 * what text can we honestly offer the AI from this file? returns
 * { text, notes } — notes explain anything we could not (or chose not to) read.
 */
export const extractDocument = (buffer, mimeType, originalName = '') => {
    const notes = [];
    const lower = originalName.toLowerCase();
    let text = '';

    const looksText = (mimeType || '').startsWith('text/')
        || ['.md', '.markdown', '.txt', '.csv', '.json', '.log'].some(ext => lower.endsWith(ext));

    try {
        if (looksText) {
            text = buffer.toString('utf8');
            if (buffer.length > TEXT_CAP) notes.push(`text truncated at ${TEXT_CAP} characters`);
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || lower.endsWith('.docx')) {
            text = extractDocx(buffer);
            if (!text) notes.push('docx contained no readable text');
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || lower.endsWith('.pptx')) {
            text = extractPptx(buffer);
            if (!text) notes.push('pptx contained no readable text');
        } else if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) {
            notes.push('PDF text is not extracted yet — the file is stored, its contents were not read');
        } else {
            notes.push('no text extractor for this file type — stored as an artifact only');
        }
    } catch (err) {
        // malformed archive or an inflate ceiling trip — honest note, file kept
        notes.push(`could not read this file's contents: ${err.message}`);
    }

    return { text: text.slice(0, TEXT_CAP), notes };
};

// a safe download name regardless of what the client called it — no dots to
// traverse with, no separators, extension kept
export const downloadName = (originalName, sha) => {
    const ext = (originalName.match(/\.[A-Za-z0-9]{1,10}$/) || [''])[0].toLowerCase();
    const base = String(originalName)
        .replace(/\.[A-Za-z0-9]{1,10}$/, '')
        .replace(/[^\w-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'download';
    return `${base}-${sha.slice(0, 8)}${ext}`;
};
