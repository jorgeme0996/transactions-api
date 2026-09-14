import { RiskLevel } from '../risk/owaspRiskMatrix';

export type PolicyAction = 'BLOCK' | 'WARN' | 'ALLOW';

export interface PolicyRule {
  action: PolicyAction;
  approvalRequired?: boolean;
}

/**
 * readme.md section 13 shows two inconsistent shapes (`risk_policy:`/`policy:`,
 * `WARN`/`warning`). We standardize on root key `policy:` and upper-case actions
 * for a predictable, typed config — documented as a deliberate implementation choice.
 */
export interface RiskPolicyConfig {
  policy: Record<Lowercase<RiskLevel>, PolicyRule>;
  unmappedAction: PolicyAction;
}

export interface PolicyDecision {
  riskLevel: RiskLevel;
  action: PolicyAction;
  approvalRequired: boolean;
  exceptionApplied: boolean;
  exceptionReason?: string;
}
