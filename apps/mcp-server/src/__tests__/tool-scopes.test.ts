import { describe, it, expect } from 'vitest';
import { getToolScopes, TOOL_SCOPE_MAP } from '../lib/tool-scopes.js';

describe('TOOL_SCOPE_MAP', () => {
  it('should have scope mappings for known tools', () => {
    expect(Object.keys(TOOL_SCOPE_MAP).length).toBeGreaterThan(30);
  });

  it('should return scopes for suguvisa_application_type_determine', () => {
    const scopes = getToolScopes('suguvisa_application_type_determine');
    expect(scopes).toContain('read:visa_case');
  });

  it('should return scopes for suguvisa_reason_letter_generate', () => {
    const scopes = getToolScopes('suguvisa_reason_letter_generate');
    expect(scopes).toContain('generate:reason_letter');
  });

  it('should return scopes for suguvisa_submission_outcome_track', () => {
    const scopes = getToolScopes('suguvisa_submission_outcome_track');
    expect(scopes).toContain('write:submission_outcome');
  });

  it('should return scopes for suguvisa_vertex_datastore_sync', () => {
    const scopes = getToolScopes('suguvisa_vertex_datastore_sync');
    expect(scopes).toContain('admin:tenant');
  });

  it('should return empty array for unknown tool', () => {
    const scopes = getToolScopes('nonexistent_tool');
    expect(scopes).toEqual([]);
  });

  it('should return read:golden_records for suguvisa_golden_records_search', () => {
    const scopes = getToolScopes('suguvisa_golden_records_search');
    expect(scopes).toContain('read:golden_records');
  });
});
