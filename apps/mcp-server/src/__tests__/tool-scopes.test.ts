import { describe, it, expect } from 'vitest';
import { getToolScopes, TOOL_SCOPE_MAP } from '../lib/tool-scopes.js';

describe('TOOL_SCOPE_MAP', () => {
  it('should have scope mappings for known tools', () => {
    expect(Object.keys(TOOL_SCOPE_MAP).length).toBeGreaterThan(30);
  });

  it('should return scopes for determine_application_type', () => {
    const scopes = getToolScopes('determine_application_type');
    expect(scopes).toContain('read:visa_case');
  });

  it('should return scopes for generate_reason_letter', () => {
    const scopes = getToolScopes('generate_reason_letter');
    expect(scopes).toContain('generate:reason_letter');
  });

  it('should return scopes for track_submission_outcome', () => {
    const scopes = getToolScopes('track_submission_outcome');
    expect(scopes).toContain('write:submission_outcome');
  });

  it('should return scopes for sync_vertex_datastore', () => {
    const scopes = getToolScopes('sync_vertex_datastore');
    expect(scopes).toContain('admin:tenant');
  });

  it('should return empty array for unknown tool', () => {
    const scopes = getToolScopes('nonexistent_tool');
    expect(scopes).toEqual([]);
  });
});
