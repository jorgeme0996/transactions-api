import { FindingValidationError, sanitizeRelativePath, validateFinding } from '../../../src/domain/finding/Finding';
import { loadApplicationContext } from '../../../src/context/loadApplicationContext';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('validateFinding', () => {
  const VALID = {
    id: 'f-1',
    source: 'SAST',
    scanner: 'codeql',
    rule: { id: 'r-1', cwe: ['CWE-89'] },
    severity: { scanner: 'HIGH', cvss: null },
    location: { repository: 'test-app' },
  };

  it('accepts a well-formed finding', () => {
    expect(() => validateFinding(VALID)).not.toThrow();
  });

  it('rejects a non-object payload', () => {
    expect(() => validateFinding('not-an-object')).toThrow(FindingValidationError);
  });

  it('rejects a missing id', () => {
    expect(() => validateFinding({ ...VALID, id: undefined })).toThrow(/id/);
  });

  it('rejects an invalid source', () => {
    expect(() => validateFinding({ ...VALID, source: 'NOT_A_SOURCE' })).toThrow(/source/);
  });

  it('rejects an invalid severity', () => {
    expect(() => validateFinding({ ...VALID, severity: { scanner: 'SUPER_BAD' } })).toThrow(/severity/);
  });

  it('rejects a finding with a path-traversal file location', () => {
    expect(() => validateFinding({ ...VALID, location: { repository: 'test-app', file: '../../etc/passwd' } })).toThrow(
      /path/i,
    );
  });
});

describe('sanitizeRelativePath', () => {
  it('rejects absolute paths', () => {
    expect(() => sanitizeRelativePath('/etc/passwd')).toThrow();
  });

  it('rejects traversal sequences', () => {
    expect(() => sanitizeRelativePath('src/../../secrets.env')).toThrow();
  });

  it('accepts a normal relative path', () => {
    expect(sanitizeRelativePath('src/app.ts')).toBe('src/app.ts');
  });
});

describe('loadApplicationContext input validation', () => {
  it('rejects malformed YAML instead of throwing an uncaught parser error', () => {
    const tmpFile = path.join(os.tmpdir(), `bad-context-${Date.now()}.yml`);
    fs.writeFileSync(tmpFile, 'application: [this is not valid: yaml');
    try {
      expect(() => loadApplicationContext(tmpFile)).toThrow();
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('rejects YAML missing the required application.name field', () => {
    const tmpFile = path.join(os.tmpdir(), `no-name-context-${Date.now()}.yml`);
    fs.writeFileSync(tmpFile, 'application:\n  business_criticality: LOW\n');
    try {
      expect(() => loadApplicationContext(tmpFile)).toThrow(/name/);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});
