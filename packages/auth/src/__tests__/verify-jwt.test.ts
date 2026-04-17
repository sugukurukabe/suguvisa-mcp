import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { verifyJwt, _resetJwksCache } from '../verify-jwt.js';
import type { AuthProvider } from '../providers/index.js';

const TEST_ISSUER = 'https://test.auth0.com/';
const TEST_AUDIENCE = 'https://suguvisa-test.run.app';

let privateKey: CryptoKey;
let publicJwk: object;

async function setup() {
  const { privateKey: priv, publicKey: pub } = await generateKeyPair('RS256');
  privateKey = priv;
  const jwk = await exportJWK(pub);
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  jwk.kid = 'test-kid-1';
  publicJwk = jwk;
}

function createMockProvider(jwksResponse: object): AuthProvider {
  const mockFetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(jwksResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', mockFetch);

  return {
    getJwksUri: () => 'https://test.auth0.com/.well-known/jwks.json',
    getIssuer: () => TEST_ISSUER,
    getAudience: () => TEST_AUDIENCE,
    getAuthorizationServerMetadata: async () => ({}),
  };
}

async function signToken(overrides: {
  iss?: string;
  aud?: string;
  sub?: string;
  exp?: number;
  scope?: string;
  [key: string]: unknown;
} = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const { iss, aud, sub, exp, ...rest } = overrides;

  const builder = new SignJWT({
    scope: rest.scope ?? 'read:visa_case generate:paper_form',
    'https://suguvisa.jp/tenant_id': rest['https://suguvisa.jp/tenant_id'] ?? 'tenant-123',
    ...rest,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid-1' })
    .setIssuer(iss ?? TEST_ISSUER)
    .setAudience(aud ?? TEST_AUDIENCE)
    .setSubject(sub ?? 'user-456')
    .setIssuedAt(now)
    .setExpirationTime(exp ?? now + 3600);

  return builder.sign(privateKey);
}

describe('verifyJwt', () => {
  beforeEach(async () => {
    _resetJwksCache();
    vi.restoreAllMocks();
    await setup();
  });

  it('should verify a valid token', async () => {
    const provider = createMockProvider({ keys: [publicJwk] });
    const token = await signToken();

    const result = await verifyJwt(token, provider);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.sub).toBe('user-456');
      expect(result.value.tenantId).toBe('tenant-123');
      expect(result.value.scopes).toContain('read:visa_case');
      expect(result.value.scopes).toContain('generate:paper_form');
    }
  });

  it('should reject an expired token', async () => {
    const provider = createMockProvider({ keys: [publicJwk] });
    const pastTime = Math.floor(Date.now() / 1000) - 3600;
    const token = await signToken({ exp: pastTime });

    const result = await verifyJwt(token, provider);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('expired_token');
    }
  });

  it('should reject a token with wrong issuer', async () => {
    const provider = createMockProvider({ keys: [publicJwk] });
    const token = await signToken({ iss: 'https://wrong-issuer.com/' });

    const result = await verifyJwt(token, provider);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('invalid_issuer');
    }
  });

  it('should reject a token with wrong audience', async () => {
    const provider = createMockProvider({ keys: [publicJwk] });
    const token = await signToken({ aud: 'https://wrong-audience.com' });

    const result = await verifyJwt(token, provider);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('invalid_audience');
    }
  });

  it('should reject a token with bad signature', async () => {
    const provider = createMockProvider({ keys: [publicJwk] });
    const token = await signToken();
    const tampered = token.slice(0, -5) + 'XXXXX';

    const result = await verifyJwt(tampered, provider);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('invalid_token');
    }
  });

  it('should extract scopes correctly', async () => {
    const provider = createMockProvider({ keys: [publicJwk] });
    const token = await signToken({
      scope: 'admin:tenant write:audit_log',
    });

    const result = await verifyJwt(token, provider);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.scopes).toEqual(['admin:tenant', 'write:audit_log']);
    }
  });
});
