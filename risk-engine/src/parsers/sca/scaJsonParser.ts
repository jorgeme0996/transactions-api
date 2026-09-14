import { Finding, ScannerSeverity, validateFinding } from '../../domain/finding/Finding';

export interface ScaFindingRow {
  cve?: string;
  package: string; // "name@version"
  cvss: number;
  epss?: number;
  cwe_ids?: string[];
  fixed_version?: string;
  url?: string;
}

/** Standard CVSS v3 qualitative severity rating bands. */
function severityFromCvss(cvss: number): ScannerSeverity {
  if (cvss >= 9.0) return 'CRITICAL';
  if (cvss >= 7.0) return 'HIGH';
  if (cvss >= 4.0) return 'MEDIUM';
  if (cvss > 0) return 'LOW';
  return 'UNKNOWN';
}

function splitPackage(pkg: string): { name: string; version?: string } {
  const at = pkg.lastIndexOf('@');
  if (at <= 0) return { name: pkg };
  return { name: pkg.slice(0, at), version: pkg.slice(at + 1) };
}

/**
 * Parses `sca-findings.json`, the interchange file this repo's own
 * `.github/scripts/sca-epss-report.js` writes (extended to persist structured
 * data, not just its PR comment). Keeps the risk engine independent of
 * `dependency-review-action`'s internal output format (readme.md section 6).
 */
export function parseScaFindings(rows: unknown[], repository: string): Finding[] {
  const findings: Finding[] = [];
  let index = 0;
  for (const raw of rows as ScaFindingRow[]) {
    const { name, version } = splitPackage(raw.package);
    findings.push(
      validateFinding({
        id: `sca-${repository}-${raw.cve ?? index}`,
        source: 'SCA',
        scanner: 'dependency-graph',
        rule: { id: raw.cve ?? raw.package, cwe: raw.cwe_ids ?? [] },
        severity: { scanner: severityFromCvss(raw.cvss), cvss: raw.cvss ?? null },
        location: { repository },
        message: `${raw.package}${raw.cve ? ` is affected by ${raw.cve}` : ''}`,
        sca: {
          package: name,
          installedVersion: version,
          fixedVersion: raw.fixed_version,
          cve: raw.cve,
          epss: raw.epss,
        },
      }),
    );
    index += 1;
  }
  return findings;
}
