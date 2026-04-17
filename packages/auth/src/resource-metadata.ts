/**
 * Protected Resource Metadata (RFC 9728)
 * 保護リソースメタデータ
 * Metadata Sumber Daya Terlindungi
 */

import type { AuthConfig } from './types.js';
import type { Scope } from './scopes.js';
import { ALL_SCOPES } from './scopes.js';

export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported: Scope[];
  bearer_methods_supported: string[];
  resource_documentation?: string;
}

export function generateResourceMetadata(config: AuthConfig): ProtectedResourceMetadata {
  return {
    resource: config.audience,
    authorization_servers: [`https://${config.domain}`],
    scopes_supported: ALL_SCOPES,
    bearer_methods_supported: ['header'],
    resource_documentation: 'https://github.com/sugukurukabe/suguvisa-mcp',
  };
}
