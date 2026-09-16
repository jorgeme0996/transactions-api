import { Finding, ScannerSeverity, validateFinding } from '../../domain/finding/Finding';

export interface ThreagileRiskRow {
  category: string;
  risk_status: string;
  severity: string;
  title: string;
  synthetic_id: string;
  most_relevant_technical_asset?: string;
  most_relevant_communication_link?: string;
}

/**
 * Statuses that already carry their own accountability trail inside
 * threagile.yml's `risk_tracking` (status/justification/checked_by/date) --
 * re-surfacing them here on every PR would just be alert fatigue for a risk
 * a human already disposed of. Only genuinely open risks reach the engine.
 */
const RESOLVED_STATUSES = new Set(['mitigated', 'accepted', 'false-positive']);

/**
 * Threagile has 5 severities (low/medium/elevated/high/critical); risk-engine's
 * severity_fallback table only has 4 bands + UNKNOWN. `elevated` maps to HIGH
 * (BLOCK, no approval_required) -- a deliberate, conservative choice confirmed
 * with the team, not a default guess.
 */
const SEVERITY_MAP: Record<string, ScannerSeverity> = {
  low: 'LOW',
  medium: 'MEDIUM',
  elevated: 'HIGH',
  high: 'HIGH',
  critical: 'CRITICAL',
};

/**
 * Threagile categories that map cleanly onto an existing CWE in
 * config/likelihood-impact-rules.yml, so they get the tuned rule instead of
 * the generic severity fallback. Deliberately small: guessing a CWE for
 * categories like `missing-hardening`/`missing-vault` would be less honest
 * than falling back (see cweRules.ts's `rule_matched: false` explanation).
 */
const CWE_HINTS: Record<string, string[]> = {
  'sql-nosql-injection': ['CWE-89'],
};

function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, '');
}

/**
 * Parses `docs/threat-model/report/risks.json` (Threagile's risk report) into
 * normalized Findings, so unresolved architecture-level risks flow through the
 * same OWASP risk / policy pipeline as SAST/SCA/secrets instead of sitting in
 * a report nobody reads in CI.
 */
export function parseThreagileRisks(rows: unknown[], repository: string): Finding[] {
  const findings: Finding[] = [];
  for (const raw of rows as ThreagileRiskRow[]) {
    if (RESOLVED_STATUSES.has(raw.risk_status)) continue;

    const title = stripTags(raw.title ?? raw.category);
    const context = [raw.most_relevant_technical_asset, raw.most_relevant_communication_link]
      .filter(Boolean)
      .join(' via ');

    findings.push(
      validateFinding({
        id: `threagile-${repository}-${raw.synthetic_id}`,
        source: 'THREAT_MODEL',
        scanner: 'threagile',
        rule: {
          id: raw.category,
          cwe: CWE_HINTS[raw.category] ?? [],
          description: title,
        },
        severity: { scanner: SEVERITY_MAP[raw.severity] ?? 'UNKNOWN', cvss: null },
        location: { repository, file: 'docs/threat-model/threagile.yml' },
        message: context ? `${title} (${context})` : title,
      }),
    );
  }
  return findings;
}
