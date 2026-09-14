import * as fs from 'fs';
import * as path from 'path';
import { parseCodeqlAlerts } from '../../../src/parsers/sast/codeqlAlertsParser';

const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'fixtures', 'codeql-alerts.json'), 'utf8'));

describe('parseCodeqlAlerts', () => {
  it('normalizes open alerts into Findings with CWE extracted from tags', () => {
    const findings = parseCodeqlAlerts(FIXTURE, 'transacciones-api');
    expect(findings).toHaveLength(3);
    expect(findings[0].rule.cwe).toEqual(['CWE-89']);
    expect(findings[0].source).toBe('SAST');
    expect(findings[0].scanner).toBe('codeql');
    expect(findings[0].severity.scanner).toBe('HIGH');
    expect(findings[0].location.file).toBe('src/transactions/transactions.service.ts');
    expect(findings[0].location.line).toBe(42);
  });

  it('skips alerts that are not open', () => {
    const findings = parseCodeqlAlerts([{ ...FIXTURE[0], state: 'fixed' }], 'transacciones-api');
    expect(findings).toHaveLength(0);
  });

  it('maps security_severity_level "critical" to CRITICAL', () => {
    const [, commandInjection] = parseCodeqlAlerts(FIXTURE, 'transacciones-api');
    expect(commandInjection.severity.scanner).toBe('CRITICAL');
    expect(commandInjection.rule.cwe).toEqual(['CWE-78']);
  });

  it('produces stable, unique ids per alert', () => {
    const findings = parseCodeqlAlerts(FIXTURE, 'transacciones-api');
    const ids = new Set(findings.map((f) => f.id));
    expect(ids.size).toBe(findings.length);
  });
});
