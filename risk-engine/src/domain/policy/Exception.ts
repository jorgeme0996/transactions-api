export interface RiskException {
  findingId: string;
  reason: string;
  approvedBy: string;
  expiresAt: string; // ISO date, e.g. "2026-12-31"
  compensatingControls?: string[];
}

export class ExceptionValidationError extends Error {}

/**
 * readme.md section 14: exceptions must always carry justification, an owner and
 * an expiration; a bare `ignore: true` must never be possible in this codebase.
 */
export function validateException(raw: unknown): RiskException {
  if (typeof raw !== 'object' || raw === null) {
    throw new ExceptionValidationError('Exception must be an object');
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.finding_id !== 'string' || r.finding_id.length === 0) {
    throw new ExceptionValidationError('Exception.finding_id is required');
  }
  if (typeof r.reason !== 'string' || r.reason.trim().length === 0) {
    throw new ExceptionValidationError(`Exception for ${r.finding_id} requires a non-empty reason`);
  }
  if (typeof r.approved_by !== 'string' || r.approved_by.trim().length === 0) {
    throw new ExceptionValidationError(`Exception for ${r.finding_id} requires approved_by`);
  }
  if (typeof r.expires_at !== 'string' || Number.isNaN(Date.parse(r.expires_at))) {
    throw new ExceptionValidationError(`Exception for ${r.finding_id} requires a valid expires_at date`);
  }
  return {
    findingId: r.finding_id,
    reason: r.reason,
    approvedBy: r.approved_by,
    expiresAt: r.expires_at,
    compensatingControls: Array.isArray(r.compensating_controls)
      ? r.compensating_controls.filter((c): c is string => typeof c === 'string')
      : undefined,
  };
}

export function isExceptionValid(exception: RiskException, now: Date = new Date()): boolean {
  return Date.parse(exception.expiresAt) >= now.getTime();
}
