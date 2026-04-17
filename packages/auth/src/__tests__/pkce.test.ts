import { describe, it, expect } from 'vitest';
import { generateCodeVerifier, computeCodeChallenge, verifyCodeChallenge } from '../pkce.js';

describe('PKCE S256', () => {
  it('should generate a verifier of at least 43 characters', () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
  });

  it('should compute a base64url challenge from verifier', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = computeCodeChallenge(verifier);
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('should verify a correct code challenge', () => {
    const verifier = generateCodeVerifier();
    const challenge = computeCodeChallenge(verifier);
    expect(verifyCodeChallenge(verifier, challenge)).toBe(true);
  });

  it('should reject a wrong verifier', () => {
    const verifier = generateCodeVerifier();
    const challenge = computeCodeChallenge(verifier);
    expect(verifyCodeChallenge('wrong_verifier', challenge)).toBe(false);
  });
});
