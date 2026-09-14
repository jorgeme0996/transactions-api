/** Minimal structural typing for the subset of SARIF 2.1.0 this project reads. */
export interface SarifLocation {
  file?: string;
  line?: number;
}

export interface SarifResult {
  ruleId?: string;
  level?: string;
  message?: { text?: string };
  locations?: unknown[];
  properties?: Record<string, unknown>;
}

export interface SarifRun {
  toolName: string;
  results: SarifResult[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseSarifDocument(doc: unknown): SarifRun[] {
  if (!isPlainObject(doc) || !Array.isArray(doc.runs)) return [];
  return doc.runs.map((run) => {
    const r = run as Record<string, unknown>;
    const tool = r.tool as Record<string, unknown> | undefined;
    const driver = tool?.driver as Record<string, unknown> | undefined;
    return {
      toolName: typeof driver?.name === 'string' ? driver.name : 'unknown',
      results: Array.isArray(r.results) ? (r.results as SarifResult[]) : [],
    };
  });
}

export function getResultLocation(result: SarifResult): SarifLocation {
  const location = result.locations?.[0] as Record<string, unknown> | undefined;
  const physical = location?.physicalLocation as Record<string, unknown> | undefined;
  const artifact = physical?.artifactLocation as Record<string, unknown> | undefined;
  const region = physical?.region as Record<string, unknown> | undefined;
  return {
    file: typeof artifact?.uri === 'string' ? artifact.uri : undefined,
    line: typeof region?.startLine === 'number' ? region.startLine : undefined,
  };
}

const SARIF_LEVEL_TO_SEVERITY: Record<string, 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'> = {
  error: 'HIGH',
  warning: 'MEDIUM',
  note: 'LOW',
};

export function severityFromSarifLevel(level: string | undefined): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN' {
  return SARIF_LEVEL_TO_SEVERITY[level ?? ''] ?? 'UNKNOWN';
}
