import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');
export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');
export const hmac = (secret: string, s: string): string => createHmac('sha256', secret).update(s).digest('hex');
export const sixDigits = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
