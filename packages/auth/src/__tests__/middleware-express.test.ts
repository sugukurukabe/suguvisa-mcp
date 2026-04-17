import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuthMiddleware, requireScope } from '../middleware/express.js';
import type { AuthProvider } from '../providers/index.js';
import type { Request, Response, NextFunction } from 'express';
import type { Principal } from '../types.js';

function mockReq(headers: Record<string, string> = {}): Request {
  return {
    headers,
    principal: undefined,
  } as unknown as Request;
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as unknown,
    setHeader(key: string, value: string) { res.headers[key] = value; return res; },
    status(code: number) { res.statusCode = code; return res; },
    json(data: unknown) { res.body = data; return res; },
  };
  return res as unknown as Response & { headers: Record<string, string>; body: unknown; statusCode: number };
}

function mockProvider(): AuthProvider {
  return {
    getJwksUri: () => 'https://test.auth0.com/.well-known/jwks.json',
    getIssuer: () => 'https://test.auth0.com/',
    getAudience: () => 'https://suguvisa-test.run.app',
    getAuthorizationServerMetadata: async () => ({}),
  };
}

describe('createAuthMiddleware', () => {
  it('should return 401 when no Authorization header', async () => {
    const middleware = createAuthMiddleware(mockProvider());
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res as unknown as Response, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(res.headers['WWW-Authenticate']).toContain('Bearer');
  });

  it('should return 401 for invalid scheme', async () => {
    const middleware = createAuthMiddleware(mockProvider());
    const req = mockReq({ authorization: 'Basic abc123' });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res as unknown as Response, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should accept legacy API key when validator is provided', async () => {
    const legacyPrincipal: Principal = {
      sub: 'legacy-user',
      tenantId: 'tenant-1',
      scopes: [],
      iss: 'legacy',
      aud: 'test',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const middleware = createAuthMiddleware(mockProvider(), {
      legacyApiKeyValidator: async (key) => key === 'my-api-key' ? legacyPrincipal : null,
    });

    const req = mockReq({ authorization: 'Bearer my-api-key' });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
    expect(req.principal).toEqual(legacyPrincipal);
  });
});

describe('requireScope', () => {
  it('should pass when required scopes are present', () => {
    const middleware = requireScope('read:visa_case');
    const req = mockReq();
    req.principal = {
      sub: 'user-1',
      tenantId: 'tenant-1',
      scopes: ['read:visa_case', 'generate:paper_form'],
      iss: 'https://test.auth0.com/',
      aud: 'test',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res as unknown as Response, next as NextFunction);

    expect(next).toHaveBeenCalled();
  });

  it('should return 403 when scope is missing', () => {
    const middleware = requireScope('admin:tenant');
    const req = mockReq();
    req.principal = {
      sub: 'user-1',
      tenantId: 'tenant-1',
      scopes: ['read:visa_case'],
      iss: 'https://test.auth0.com/',
      aud: 'test',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res as unknown as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('should return 401 when no principal', () => {
    const middleware = requireScope('read:visa_case');
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res as unknown as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});
