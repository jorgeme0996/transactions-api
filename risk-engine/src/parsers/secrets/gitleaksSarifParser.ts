import { Finding, sanitizeRelativePath, validateFinding } from '../../domain/finding/Finding';
import { getResultLocation, parseSarifDocument } from '../common/sarif';

/** Hardcoded credentials map to this CWE regardless of the specific secret type detected. */
const HARDCODED_CREDENTIALS_CWE = 'CWE-798';

/**
 * Parses the SARIF report produced by `gitleaks/gitleaks-action@v2` into normalized
 * Findings. Intentionally does NOT read `result.message.text` into the Finding: gitleaks
 * messages can echo back the matched line, which may contain the secret value itself.
 * Per readme.md section 5, "Nunca se debe almacenar el valor real del secret" -- so this
 * parser only carries the rule id (secret type) and location, never scanner-supplied text.
 */
export function parseGitleaksSarif(sarifDoc: unknown, repository: string): Finding[] {
  const findings: Finding[] = [];
  let index = 0;
  for (const run of parseSarifDocument(sarifDoc)) {
    for (const result of run.results) {
      const location = getResultLocation(result);
      const secretType = result.ruleId ?? 'unknown-secret';
      findings.push(
        validateFinding({
          id: `gitleaks-${repository}-${index++}`,
          source: 'SECRET',
          scanner: 'gitleaks',
          rule: { id: secretType, cwe: [HARDCODED_CREDENTIALS_CWE], description: 'Hardcoded credential detected' },
          severity: { scanner: 'HIGH', cvss: null },
          location: {
            repository,
            file: location.file ? sanitizeRelativePath(location.file) : undefined,
            line: location.line,
          },
          message: `Potential secret detected: ${secretType}`,
          secret: { secretType, detectionSource: 'gitleaks', validityStatus: 'unknown' },
        }),
      );
    }
  }
  return findings;
}
