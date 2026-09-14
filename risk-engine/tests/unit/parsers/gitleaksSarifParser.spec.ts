import * as fs from 'fs';
import * as path from 'path';
import { parseGitleaksSarif } from '../../../src/parsers/secrets/gitleaksSarifParser';

const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'fixtures', 'gitleaks-results.sarif'), 'utf8'));

describe('parseGitleaksSarif', () => {
  it('normalizes SARIF results into SECRET findings', () => {
    const findings = parseGitleaksSarif(FIXTURE, 'transacciones-api');
    expect(findings).toHaveLength(1);
    expect(findings[0].source).toBe('SECRET');
    expect(findings[0].scanner).toBe('gitleaks');
    expect(findings[0].rule.cwe).toEqual(['CWE-798']);
    expect(findings[0].location.file).toBe('src/provider/provider.service.ts');
    expect(findings[0].location.line).toBe(15);
    expect(findings[0].secret?.secretType).toBe('aws-access-token');
  });

  it('never surfaces the raw SARIF message text, which may echo the secret value', () => {
    const findings = parseGitleaksSarif(FIXTURE, 'transacciones-api');
    expect(findings[0].message).not.toContain('REDACTED');
    expect(JSON.stringify(findings[0])).not.toContain('REDACTED');
  });

  it('returns an empty array for a SARIF document with no results', () => {
    const empty = { version: '2.1.0', runs: [{ tool: { driver: { name: 'gitleaks' } }, results: [] }] };
    expect(parseGitleaksSarif(empty, 'transacciones-api')).toHaveLength(0);
  });
});
