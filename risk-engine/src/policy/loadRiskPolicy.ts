import * as fs from 'fs';
import { parse } from 'yaml';
import { PolicyAction, PolicyRule, RiskPolicyConfig } from '../domain/policy/Policy';

export class PolicyValidationError extends Error {}

const VALID_ACTIONS: PolicyAction[] = ['BLOCK', 'WARN', 'ALLOW'];
const LEVELS = ['critical', 'high', 'medium', 'low', 'note'] as const;

function parseRule(raw: unknown, level: string): PolicyRule {
  if (typeof raw !== 'object' || raw === null) {
    throw new PolicyValidationError(`risk-policy.yml: policy.${level} must be an object`);
  }
  const r = raw as Record<string, unknown>;
  const action = String(r.action ?? '').toUpperCase();
  if (!VALID_ACTIONS.includes(action as PolicyAction)) {
    throw new PolicyValidationError(`risk-policy.yml: policy.${level}.action must be one of ${VALID_ACTIONS.join(', ')}`);
  }
  return { action: action as PolicyAction, approvalRequired: Boolean(r.approval_required) };
}

export function loadRiskPolicy(filePath: string): RiskPolicyConfig {
  const raw = parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  const policy = raw.policy as Record<string, unknown>;
  if (!policy) {
    throw new PolicyValidationError(`${filePath}: missing required "policy" root key`);
  }

  const parsed = {} as RiskPolicyConfig['policy'];
  for (const level of LEVELS) {
    if (!policy[level]) {
      throw new PolicyValidationError(`${filePath}: missing policy.${level}`);
    }
    parsed[level] = parseRule(policy[level], level);
  }

  const unmapped = String(raw.unmapped_action ?? 'WARN').toUpperCase();
  if (!VALID_ACTIONS.includes(unmapped as PolicyAction)) {
    throw new PolicyValidationError(`${filePath}: unmapped_action must be one of ${VALID_ACTIONS.join(', ')}`);
  }

  return { policy: parsed, unmappedAction: unmapped as PolicyAction };
}
