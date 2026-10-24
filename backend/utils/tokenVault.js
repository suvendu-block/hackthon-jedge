import crypto from 'node:crypto';
import AppError from './AppError.js';

/// tokenVault — teams may hand us a GitHub read token to access a private
/// repository. The raw value never touches the database: we store AES-256-GCM
/// ciphertext with a key derived from JWT_SECRET (lazily — env isn't loaded
/// yet at import time), plus a short fingerprint so the UI can say
/// "granted as tok_1a2b…" without ever seeing the secret again.

let cachedKey = null;

const vaultKey = () => {
    if (!cachedKey) {
        cachedKey = crypto
            .createHash('sha256')
            .update(`${process.env.JWT_SECRET || 'dev-secret'}::repo-grant`)
            .digest();
    }
    return cachedKey;
};

export const encryptToken = (plain) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', vaultKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv, tag, encrypted].map(b => b.toString('base64')).join('.');
};

export const decryptToken = (packed) => {
    if (!packed) return null;
    try {
        const [iv, tag, data] = String(packed).split('.').map(s => Buffer.from(s, 'base64'));
        const decipher = crypto.createDecipheriv('aes-256-gcm', vaultKey(), iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch {
        return null;   // tampered or from an older secret — caller falls back
    }
};

// stable short id for display: enough to recognize, useless to an attacker
export const fingerprint = (plain) =>
    crypto.createHash('sha256').update(String(plain)).digest('hex').slice(0, 12);

export const requireRepoUrl = (repositoryUrl) => {
    if (!repositoryUrl) {
        throw new AppError('Add a repository URL to your submission first', 422, 'NO_REPOSITORY');
    }
    return repositoryUrl;
};
