import crypto from 'crypto';
import { Branch, UserRole } from '../src/types';

const DEV_FALLBACK_SECRET = 'tehkota-v140-local-dev-secret-change-auth-secret-in-vercel';

function getAuthSecret(): string {
  return process.env.AUTH_SECRET || process.env.JWT_SECRET || DEV_FALLBACK_SECRET;
}

export function isUsingDefaultSecret(): boolean {
  return !process.env.AUTH_SECRET && !process.env.JWT_SECRET;
}

/**
 * Hash password using Node built-in scrypt with per-user 16-byte random salt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

/**
 * Verify password against scrypt hash (or migrate legacy plaintext seamlessly)
 */
export function verifyPassword(
  password: string,
  storedHash: string
): { valid: boolean; needsRehash: boolean } {
  if (!storedHash) {
    return { valid: false, needsRehash: false };
  }

  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return { valid: false, needsRehash: false };
    const [, salt, hexHash] = parts;
    const expected = Buffer.from(hexHash, 'hex');
    const actual = crypto.scryptSync(password, salt, 64);
    if (expected.length !== actual.length) return { valid: false, needsRehash: false };
    const valid = crypto.timingSafeEqual(expected, actual);
    return { valid, needsRehash: false };
  }

  // Legacy plaintext fallback for existing db.json records (auto-migrated on login)
  const valid = storedHash === password;
  return { valid, needsRehash: valid };
}

export interface SessionTokenPayload {
  uid: string;
  username: string;
  name: string;
  role: UserRole;
  branch: Branch | 'All';
  iat: number;
  exp: number;
}

/**
 * Create HMAC-SHA256 signed Bearer token (valid for 14 days)
 */
export function signSessionToken(user: {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  branch: Branch | 'All';
}): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: SessionTokenPayload = {
    uid: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    branch: user.branch,
    iat: nowSec,
    exp: nowSec + 60 * 60 * 24 * 14, // 14 days
  };

  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getAuthSecret())
    .update(encoded)
    .digest('base64url');

  return `tkv1.${encoded}.${sig}`;
}

/**
 * Verify signed Bearer token (also supports graceful legacy tok_<userId>_<ts> lookup if needed)
 */
export function verifySessionToken(
  token: string
): { valid: true; payload: SessionTokenPayload } | { valid: false; legacyUserId?: string } {
  if (!token) return { valid: false };

  if (token.startsWith('tkv1.')) {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false };
    const [, encoded, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', getAuthSecret())
      .update(encoded)
      .digest('base64url');

    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false };
    }

    try {
      const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionTokenPayload;
      if (!payload.uid || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
        return { valid: false };
      }
      return { valid: true, payload };
    } catch {
      return { valid: false };
    }
  }

  // Legacy token format from v1.3.0 (`tok_usr_sompok_123456`)
  if (token.startsWith('tok_')) {
    const rest = token.slice(4);
    const lastUnderscore = rest.lastIndexOf('_');
    if (lastUnderscore > 0) {
      return { valid: false, legacyUserId: rest.slice(0, lastUnderscore) };
    }
  }

  return { valid: false };
}
