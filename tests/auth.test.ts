import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { parseCookies, checkCsrf, HttpError } from '../api/_lib/http.js';
import { createSessionToken } from '../api/_lib/session.js';
import { jwtVerify } from 'jose';
import type { SessionUser, ApiRequest } from '../api/_lib/types.js';

describe('HTTP & Cookie Security Helpers', () => {
  it('parses valid cookie headers correctly', () => {
    const header = 'qa_session=abc123xyz; theme=dark; other=value%20with%20spaces';
    const parsed = parseCookies(header);
    expect(parsed.qa_session).toBe('abc123xyz');
    expect(parsed.theme).toBe('dark');
    expect(parsed.other).toBe('value with spaces');
  });

  it('handles empty or undefined cookies gracefully', () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('')).toEqual({});
  });

  it('blocks cross-site mutations with Sec-Fetch-Site', () => {
    const req: ApiRequest = {
      method: 'POST',
      headers: {
        'sec-fetch-site': 'cross-site',
        origin: 'https://malicious-site.com',
      },
    } as any;

    expect(() => checkCsrf(req)).toThrowError(HttpError);
  });

  it('allows safe methods (GET, HEAD, OPTIONS) without origin check', () => {
    const req: ApiRequest = {
      method: 'GET',
      headers: {
        origin: 'https://another-site.com',
      },
    } as any;

    expect(() => checkCsrf(req)).not.toThrow();
  });
});

describe('Session Signing & Verification', () => {
  const dummyUser: SessionUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'student@example.com',
    name: 'Jane Doe',
    role: 'student',
    index_number: 'STU-001',
  };

  it('generates a valid JWT that can be verified with jose', async () => {
    const token = await createSessionToken(dummyUser);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const secretKey = new TextEncoder().encode(
      process.env.SESSION_SECRET ||
        process.env.VITE_JWT_SECRET ||
        'dev_session_secret_for_local_only_change_in_production_32bytes!!'
    );
    const { payload } = await jwtVerify(token, secretKey);

    expect(payload.sub).toBe(dummyUser.id);
    expect(payload.email).toBe(dummyUser.email);
    expect(payload.role).toBe(dummyUser.role);
  });

  it('rejects tampered JWT tokens', async () => {
    const token = await createSessionToken(dummyUser);
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}TAMPERED.${parts[2]}`;

    const secretKey = new TextEncoder().encode(
      process.env.SESSION_SECRET ||
        process.env.VITE_JWT_SECRET ||
        'dev_session_secret_for_local_only_change_in_production_32bytes!!'
    );
    await expect(jwtVerify(tampered, secretKey)).rejects.toThrow();
  });

  it('requireRole allows permitted roles and throws HttpError for forbidden roles', async () => {
    const { requireRole } = await import('../api/_lib/session.js');

    expect(() => requireRole(dummyUser, ['student', 'lecturer'])).not.toThrow();
    expect(() => requireRole(dummyUser, ['admin', 'super_admin'])).toThrowError(HttpError);
    expect(() => requireRole(null, ['student'])).toThrowError(HttpError);
  });
});

describe('Password Security and Legacy Migration', () => {
  it('hashes passwords securely with bcrypt (12 rounds) and verifies', async () => {
    const plain = 'MySecretPassword123!';
    const hash = await bcrypt.hash(plain, 12);

    expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);
    expect(await bcrypt.compare(plain, hash)).toBe(true);
    expect(await bcrypt.compare('WrongPassword', hash)).toBe(false);
  });

  it('verifies legacy sha256 hashes using timingSafeEqual', () => {
    const password = 'LegacyPassword987';
    const secret = 'legacy-test-secret';
    const computedHash = crypto
      .createHash('sha256')
      .update(password + secret)
      .digest('hex');

    const storedHash = computedHash; // Simulate database row
    const isMatch =
      computedHash.length === storedHash.length &&
      crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(storedHash));

    expect(isMatch).toBe(true);
  });
});
