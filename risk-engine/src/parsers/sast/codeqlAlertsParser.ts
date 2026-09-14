import { Finding, sanitizeRelativePath, validateFinding } from '../../domain/finding/Finding';

interface RawAlert {
  number?: number;
  rule?: {
    id?: string;
    description?: string;
    security_severity_level?: string;
    severity?: string;
    tags?: string[];
  };
  most_recent_instance?: {
    location?: { path?: string; start_line?: number };
    message?: { text?: string };
  };
  state?: string;
}

const CWE_TAG_PATTERN = /cwe-(\d+)/i;

function extractCwes(tags: string[] = []): string[] {
  const cwes = tags
    .map((tag) => tag.match(CWE_TAG_PATTERN))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => `CWE-${parseInt(m[1], 10)}`); // GitHub tags are zero-padded (cwe-089); normalize to CWE-89
  return [...new Set(cwes)];
}

function mapSeverity(rule: RawAlert['rule']): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN' {
  const level = (rule?.security_severity_level ?? rule?.severity ?? '').toLowerCase();
  if (level === 'critical') return 'CRITICAL';
  if (level === 'high' || level === 'error') return 'HIGH';
  if (level === 'medium' || level === 'moderate' || level === 'warning') return 'MEDIUM';
  if (level === 'low' || level === 'note') return 'LOW';
  return 'UNKNOWN';
}

/**
 * Parses GitHub's Code Scanning Alerts API response
 * (GET /repos/{owner}/{repo}/code-scanning/alerts) into normalized Findings.
 * This is how CodeQL results reach the risk engine (readme.md section 5, SAST source),
 * without requiring any change to the existing codeql.yml workflow.
 */
export function parseCodeqlAlerts(alerts: unknown[], repository: string): Finding[] {
  const findings: Finding[] = [];
  for (const raw of alerts as RawAlert[]) {
    if (raw.state && raw.state !== 'open') continue;
    const location = raw.most_recent_instance?.location;
    findings.push(
      validateFinding({
        id: `codeql-${repository}-${raw.number}`,
        source: 'SAST',
        scanner: 'codeql',
        rule: {
          id: raw.rule?.id ?? 'unknown',
          cwe: extractCwes(raw.rule?.tags),
          description: raw.rule?.description,
        },
        severity: { scanner: mapSeverity(raw.rule), cvss: null },
        location: {
          repository,
          file: location?.path ? sanitizeRelativePath(location.path) : undefined,
          line: location?.start_line,
        },
        message: raw.most_recent_instance?.message?.text,
      }),
    );
  }
  return findings;
}
