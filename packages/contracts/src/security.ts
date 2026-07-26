import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import type { AuthTokenPayload, UserRole } from './types';

function encodeJson(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function createAccessToken(
  input: { sub: string; email: string; name: string; role: UserRole },
  secret: string,
  ttlSeconds = 8 * 60 * 60,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  if (secret.length < 24) throw new Error('AUTH_SECRET must contain at least 24 characters.');
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeJson({
    ...input,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  } satisfies AuthTokenPayload);
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${sign(unsigned, secret)}`;
}

export function verifyAccessToken(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): AuthTokenPayload {
  const [header, payload, signature, extra] = token.split('.');
  if (!header || !payload || !signature || extra) throw new Error('Malformed access token.');
  const unsigned = `${header}.${payload}`;
  const expected = sign(unsigned, secret);
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    throw new Error('Invalid access token signature.');
  }
  const decodedHeader = decodeJson<{ alg?: string; typ?: string }>(header);
  if (decodedHeader.alg !== 'HS256' || decodedHeader.typ !== 'JWT') {
    throw new Error('Unsupported access token.');
  }
  const decoded = decodeJson<AuthTokenPayload>(payload);
  if (decoded.exp <= nowSeconds) throw new Error('Access token expired.');
  return decoded;
}

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')): string {
  if (password.length < 10) throw new Error('Password must contain at least 10 characters.');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [algorithm, salt, stored] = encoded.split('$');
  if (algorithm !== 'scrypt' || !salt || !stored) return false;
  const calculated = scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(stored, 'hex');
  return calculated.length === storedBuffer.length && timingSafeEqual(calculated, storedBuffer);
}

export function createWebhookSignature(rawBody: string | Buffer, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string,
  secret: string,
): boolean {
  const expected = Buffer.from(createWebhookSignature(rawBody, secret));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function verifyStripeSignature(
  rawBody: string | Buffer,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const entries = signatureHeader.split(',').map((part) => part.trim().split('='));
  const timestamp = Number(entries.find(([key]) => key === 't')?.[1]);
  const signatures = entries.filter(([key]) => key === 'v1').map(([, value]) => value ?? '');
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const payload = `${timestamp}.${Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody}`;
  const expected = Buffer.from(createHmac('sha256', secret).update(payload).digest('hex'));
  return signatures.some((signature) => {
    const received = Buffer.from(signature);
    return expected.length === received.length && timingSafeEqual(expected, received);
  });
}
