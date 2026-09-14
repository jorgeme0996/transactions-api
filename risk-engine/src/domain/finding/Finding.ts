export type FindingSource = 'SAST' | 'SCA' | 'SECRET';

export type ScannerSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export interface FindingRule {
  id: string;
  cwe: string[];
  owasp?: string[];
  description?: string;
}

export interface FindingSeverity {
  scanner: ScannerSeverity;
  cvss: number | null;
}

export interface FindingLocation {
  repository: string;
  file?: string;
  line?: number;
}

/** SCA-specific fields. Never omit `package`; the rest are optional depending on advisory data. */
export interface FindingScaExtra {
  package: string;
  installedVersion?: string;
  fixedVersion?: string;
  cve?: string;
  epss?: number;
}

/**
 * Secret-scanning fields. MUST NEVER contain the raw secret value
 * (see readme.md section 5: "Nunca se debe almacenar el valor real del secret.").
 */
export interface FindingSecretExtra {
  secretType: string;
  detectionSource: string;
  validityStatus?: 'valid' | 'invalid' | 'unknown';
}

export interface Finding {
  id: string;
  source: FindingSource;
  scanner: string;
  rule: FindingRule;
  severity: FindingSeverity;
  location: FindingLocation;
  message?: string;
  sca?: FindingScaExtra;
  secret?: FindingSecretExtra;
}

export class FindingValidationError extends Error {}

const VALID_SOURCES: FindingSource[] = ['SAST', 'SCA', 'SECRET'];
const VALID_SEVERITIES: ScannerSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates and normalizes an arbitrary parsed object into a Finding.
 * Parsers must route every raw scanner record through this function instead of
 * casting directly, so malformed scanner output can never silently poison the
 * risk engine (see readme.md section 25: "Validar todos los archivos de entrada").
 */
export function validateFinding(raw: unknown): Finding {
  if (!isPlainObject(raw)) {
    throw new FindingValidationError('Finding must be an object');
  }
  const { id, source, scanner, rule, severity, location } = raw;

  if (typeof id !== 'string' || id.length === 0) {
    throw new FindingValidationError('Finding.id must be a non-empty string');
  }
  if (typeof source !== 'string' || !VALID_SOURCES.includes(source as FindingSource)) {
    throw new FindingValidationError(`Finding.source must be one of ${VALID_SOURCES.join(', ')}`);
  }
  if (typeof scanner !== 'string' || scanner.length === 0) {
    throw new FindingValidationError('Finding.scanner must be a non-empty string');
  }
  if (!isPlainObject(rule) || typeof rule.id !== 'string') {
    throw new FindingValidationError('Finding.rule.id must be a string');
  }
  const cwe = Array.isArray(rule.cwe) ? rule.cwe.filter((c): c is string => typeof c === 'string') : [];

  if (!isPlainObject(severity) || !VALID_SEVERITIES.includes(severity.scanner as ScannerSeverity)) {
    throw new FindingValidationError(`Finding.severity.scanner must be one of ${VALID_SEVERITIES.join(', ')}`);
  }
  const cvss = typeof severity.cvss === 'number' ? severity.cvss : null;

  if (!isPlainObject(location) || typeof location.repository !== 'string') {
    throw new FindingValidationError('Finding.location.repository must be a string');
  }
  const file = typeof location.file === 'string' ? sanitizeRelativePath(location.file) : undefined;
  const line = typeof location.line === 'number' && location.line > 0 ? Math.floor(location.line) : undefined;

  const finding: Finding = {
    id,
    source: source as FindingSource,
    scanner,
    rule: {
      id: rule.id,
      cwe,
      owasp: Array.isArray(rule.owasp) ? rule.owasp.filter((o): o is string => typeof o === 'string') : undefined,
      description: typeof rule.description === 'string' ? rule.description : undefined,
    },
    severity: { scanner: severity.scanner as ScannerSeverity, cvss },
    location: { repository: location.repository, file, line },
    message: typeof raw.message === 'string' ? raw.message : undefined,
  };

  if (isPlainObject(raw.sca) && typeof raw.sca.package === 'string') {
    finding.sca = {
      package: raw.sca.package,
      installedVersion: typeof raw.sca.installedVersion === 'string' ? raw.sca.installedVersion : undefined,
      fixedVersion: typeof raw.sca.fixedVersion === 'string' ? raw.sca.fixedVersion : undefined,
      cve: typeof raw.sca.cve === 'string' ? raw.sca.cve : undefined,
      epss: typeof raw.sca.epss === 'number' ? raw.sca.epss : undefined,
    };
  }

  if (isPlainObject(raw.secret) && typeof raw.secret.secretType === 'string') {
    finding.secret = {
      secretType: raw.secret.secretType,
      detectionSource: typeof raw.secret.detectionSource === 'string' ? raw.secret.detectionSource : finding.scanner,
      validityStatus: ['valid', 'invalid', 'unknown'].includes(raw.secret.validityStatus as string)
        ? (raw.secret.validityStatus as 'valid' | 'invalid' | 'unknown')
        : undefined,
    };
  }

  return finding;
}

/** Rejects path traversal in scanner-reported file paths (readme.md section 25: "Evitar path traversal"). */
export function sanitizeRelativePath(file: string): string {
  const normalized = file.replace(/\\/g, '/');
  if (normalized.includes('..') || normalized.startsWith('/')) {
    throw new FindingValidationError(`Suspicious file path rejected: ${file}`);
  }
  return normalized;
}
