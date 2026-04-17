import { describe, it, expect } from 'vitest';
import { generateResourceMetadata } from '../resource-metadata.js';
import type { AuthConfig } from '../types.js';

describe('generateResourceMetadata (RFC 9728)', () => {
  const config: AuthConfig = {
    domain: 'suguvisa-dev.auth0.com',
    audience: 'https://suguvisa-mcp-731026511067.asia-northeast1.run.app',
    issuerBaseUrl: 'https://suguvisa-dev.auth0.com',
  };

  it('should return valid PRM structure', () => {
    const metadata = generateResourceMetadata(config);

    expect(metadata.resource).toBe(config.audience);
    expect(metadata.authorization_servers).toEqual(['https://suguvisa-dev.auth0.com']);
    expect(metadata.bearer_methods_supported).toEqual(['header']);
    expect(Array.isArray(metadata.scopes_supported)).toBe(true);
    expect(metadata.scopes_supported.length).toBe(13);
  });

  it('should include documentation URL', () => {
    const metadata = generateResourceMetadata(config);
    expect(metadata.resource_documentation).toBeDefined();
  });
});
