import { RiskAssessment } from '../domain/risk/RiskAssessment';
import { PolicyAction, PolicyDecision, RiskPolicyConfig } from '../domain/policy/Policy';
import { RiskException, isExceptionValid } from '../domain/policy/Exception';
import { RiskLevel } from '../domain/risk/owaspRiskMatrix';

export interface EvaluationSummary {
  decisions: (PolicyDecision & { findingId: string })[];
  counts: Record<RiskLevel, number>;
  finalAction: PolicyAction;
  exitCode: 0 | 1;
}

const ACTION_SEVERITY: Record<PolicyAction, number> = { ALLOW: 0, WARN: 1, BLOCK: 2 };

function policyRuleFor(riskLevel: RiskLevel, policyConfig: RiskPolicyConfig) {
  const key = riskLevel.toLowerCase() as Lowercase<RiskLevel>;
  return policyConfig.policy[key];
}

export function evaluateFinding(
  assessment: RiskAssessment,
  policyConfig: RiskPolicyConfig,
  exceptions: RiskException[],
  now: Date = new Date(),
): PolicyDecision & { findingId: string } {
  const riskLevel = assessment.finalRisk.level;
  const rule = policyRuleFor(riskLevel, policyConfig);

  const exception = exceptions.find((e) => e.findingId === assessment.findingId);
  if (exception && isExceptionValid(exception, now)) {
    return {
      findingId: assessment.findingId,
      riskLevel,
      action: 'ALLOW',
      approvalRequired: false,
      exceptionApplied: true,
      exceptionReason: exception.reason,
    };
  }

  if (!rule) {
    return {
      findingId: assessment.findingId,
      riskLevel,
      action: policyConfig.unmappedAction,
      approvalRequired: false,
      exceptionApplied: false,
    };
  }

  return {
    findingId: assessment.findingId,
    riskLevel,
    action: rule.action,
    approvalRequired: Boolean(rule.approvalRequired),
    exceptionApplied: false,
  };
}

export function evaluateAll(
  assessments: RiskAssessment[],
  policyConfig: RiskPolicyConfig,
  exceptions: RiskException[],
  now: Date = new Date(),
): EvaluationSummary {
  const decisions = assessments.map((a) => evaluateFinding(a, policyConfig, exceptions, now));

  const counts: Record<RiskLevel, number> = { NOTE: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const d of decisions) counts[d.riskLevel] += 1;

  const finalAction = decisions.reduce<PolicyAction>(
    (worst, d) => (ACTION_SEVERITY[d.action] > ACTION_SEVERITY[worst] ? d.action : worst),
    'ALLOW',
  );

  return { decisions, counts, finalAction, exitCode: finalAction === 'BLOCK' ? 1 : 0 };
}
