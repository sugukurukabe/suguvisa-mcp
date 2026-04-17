import { describe, it, expect } from 'vitest';
import { createAuthProvider } from '../providers/index.js';
import type { AuthConfig } from '../types.js';

describe('Auth0Provider', () => {
  const config: AuthConfig = {
    domain: 'suguvisa-dev.auth0.com',
    audience: 'https://suguvisa-mcp-test.run.app',
    issuerBaseUrl: 'https://suguvisa-dev.auth0.com',
  };

  it('should return correct JWKS URI', () => {
    const provider = createAuthProvider(config);
    expect(provider.getJwksUri()).toBe('https://suguvisa-dev.auth0.com/.well-known/jwks.json');
  });

  it('should return issuer with trailing slash', () => {
    const provider = createAuthProvider(config);
    expect(provider.getIssuer()).toBe('https://suguvisa-dev.auth0.com/');
  });

  it('should handle issuer that already has trailing slash', () => {
    const provider = createAuthProvider({
      ...config,
      issuerBaseUrl: 'https://suguvisa-dev.auth0.com/',
    });
    expect(provider.getIssuer()).toBe('https://suguvisa-dev.auth0.com/');
  });

  it('should return correct audience', () => {
    const provider = createAuthProvider(config);
    expect(provider.getAudience()).toBe('https://suguvisa-mcp-test.run.app');
  });
});
