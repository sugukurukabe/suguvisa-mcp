import { describe, it, expect } from 'vitest';
import { AuthError, buildWwwAuthenticate } from '../errors.js';

describe('AuthError', () => {
  it('should create an error with code and message', () => {
    const error = new AuthError('invalid_token', 'Bad token');
    expect(error.code).toBe('invalid_token');
    expect(error.message).toBe('Bad token');
    expect(error.statusCode).toBe(401);
    expect(error.name).toBe('AuthError');
  });

  it('should support custom status code', () => {
    const error = new AuthError('insufficient_scope', 'Need more scopes', 403);
    expect(error.statusCode).toBe(403);
  });
});

describe('buildWwwAuthenticate', () => {
  it('should build a minimal WWW-Authenticate header', () => {
    const header = buildWwwAuthenticate({ realm: 'https://suguvisa.jp' });
    expect(header).toBe('Bearer realm="https://suguvisa.jp"');
  });

  it('should include error and description', () => {
    const header = buildWwwAuthenticate({
      realm: 'https://suguvisa.jp',
      error: 'invalid_token',
      errorDescription: 'Token expired',
    });
    expect(header).toContain('error="invalid_token"');
    expect(header).toContain('error_description="Token expired"');
  });

  it('should include resource_metadata URL', () => {
    const header = buildWwwAuthenticate({
      realm: 'https://suguvisa.jp',
      resourceMetadataUrl: 'https://example.com/.well-known/oauth-protected-resource',
    });
    expect(header).toContain('resource_metadata="https://example.com/.well-known/oauth-protected-resource"');
  });

  it('should include scope', () => {
    const header = buildWwwAuthenticate({
      realm: 'https://suguvisa.jp',
      scope: 'read:visa_case generate:paper_form',
    });
    expect(header).toContain('scope="read:visa_case generate:paper_form"');
  });
});
