import { parseThreagileRisks } from '../../../src/parsers/threat-model/threagileRisksParser';

const openRisk = {
  category: 'missing-hardening',
  risk_status: 'unchecked',
  severity: 'medium',
  title: '<b>Missing Hardening</b> risk at <b>transacciones-api</b>',
  synthetic_id: 'missing-hardening@transacciones-api',
  most_relevant_technical_asset: 'transacciones-api',
};

describe('parseThreagileRisks', () => {
  it('normalizes an open risk into a THREAT_MODEL Finding, stripping HTML from the title', () => {
    const findings = parseThreagileRisks([openRisk], 'transacciones-api');
    expect(findings).toHaveLength(1);
    expect(findings[0].source).toBe('THREAT_MODEL');
    expect(findings[0].scanner).toBe('threagile');
    expect(findings[0].id).toBe('threagile-transacciones-api-missing-hardening@transacciones-api');
    expect(findings[0].rule.id).toBe('missing-hardening');
    expect(findings[0].message).toContain('Missing Hardening risk at transacciones-api');
    expect(findings[0].message).not.toContain('<b>');
  });

  it.each([
    ['mitigated'],
    ['accepted'],
    ['false-positive'],
  ])('filters out risks already resolved via risk_tracking (status=%s)', (risk_status) => {
    const findings = parseThreagileRisks([{ ...openRisk, risk_status }], 'transacciones-api');
    expect(findings).toHaveLength(0);
  });

  it.each([
    ['in-discussion'],
    ['in-progress'],
    ['unchecked'],
  ])('keeps risks that are still open (status=%s)', (risk_status) => {
    const findings = parseThreagileRisks([{ ...openRisk, risk_status }], 'transacciones-api');
    expect(findings).toHaveLength(1);
  });

  it('maps Threagile severities to risk-engine scanner severities, elevated -> HIGH', () => {
    const rows = ['low', 'medium', 'elevated', 'high', 'critical'].map((severity, i) => ({
      ...openRisk,
      severity,
      synthetic_id: `risk-${i}`,
    }));
    const findings = parseThreagileRisks(rows, 'transacciones-api');
    expect(findings.map((f) => f.severity.scanner)).toEqual(['LOW', 'MEDIUM', 'HIGH', 'HIGH', 'CRITICAL']);
  });

  it('attaches the known CWE hint for sql-nosql-injection so it hits the tuned rule, not the fallback', () => {
    const findings = parseThreagileRisks(
      [{ ...openRisk, category: 'sql-nosql-injection', synthetic_id: 'sql-nosql-injection@transacciones-api' }],
      'transacciones-api',
    );
    expect(findings[0].rule.cwe).toEqual(['CWE-89']);
  });

  it('leaves rule.cwe empty for categories without a known CWE mapping', () => {
    const findings = parseThreagileRisks([openRisk], 'transacciones-api');
    expect(findings[0].rule.cwe).toEqual([]);
  });

  it('returns an empty array when there are no risks', () => {
    expect(parseThreagileRisks([], 'transacciones-api')).toHaveLength(0);
  });
});
