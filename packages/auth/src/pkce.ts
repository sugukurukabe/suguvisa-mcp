/**
 * PKCE (S256) ヘルパー
 * PKCE (S256) helpers
 * Pembantu PKCE (S256)
 */

import { createHash, randomBytes } from 'node:crypto';

export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

export function computeCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function verifyCodeChallenge(verifier: string, challenge: string): boolean {
  const computed = computeCodeChallenge(verifier);
  return computed === challenge;
}
