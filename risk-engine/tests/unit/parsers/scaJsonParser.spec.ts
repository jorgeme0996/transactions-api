import * as fs from 'fs';
import * as path from 'path';
import { parseScaFindings } from '../../../src/parsers/sca/scaJsonParser';

const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'fixtures', 'sca-findings.json'), 'utf8'));

describe('parseScaFindings', () => {
  it('normalizes SCA rows into Findings, splitting package name and version', () => {
    const findings = parseScaFindings(FIXTURE, 'transacciones-api');
    expect(findings).toHaveLength(1);
    expect(findings[0].source).toBe('SCA');
    expect(findings[0].sca?.package).toBe('lodash');
    expect(findings[0].sca?.installedVersion).toBe('4.17.4');
    expect(findings[0].sca?.fixedVersion).toBe('4.17.12');
    expect(findings[0].sca?.cve).toBe('CVE-2019-10744');
    expect(findings[0].rule.cwe).toEqual(['CWE-1321']);
  });

  it('derives severity from CVSS using standard bands', () => {
    const findings = parseScaFindings(
      [
        { package: 'a@1.0.0', cvss: 9.5 },
        { package: 'b@1.0.0', cvss: 7.2 },
        { package: 'c@1.0.0', cvss: 5.0 },
        { package: 'd@1.0.0', cvss: 1.0 },
      ],
      'test-app',
    );
    expect(findings.map((f) => f.severity.scanner)).toEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
  });

  it('returns an empty array when there are no findings', () => {
    expect(parseScaFindings([], 'transacciones-api')).toHaveLength(0);
  });
});
