import { RiskAssessment } from '../domain/risk/RiskAssessment';
import { EvaluationSummary } from '../policy/evaluate';

export function renderJson(assessments: RiskAssessment[], evaluation: EvaluationSummary): string {
  const findings = assessments.map((assessment) => {
    const decision = evaluation.decisions.find((d) => d.findingId === assessment.findingId)!;
    return {
      finding_id: assessment.findingId,
      classification: { type: assessment.finding.source, cwe: assessment.finding.rule.cwe },
      severity: { scanner: assessment.finding.severity.scanner },
      likelihood: { score: assessment.likelihood.score, level: assessment.likelihood.level },
      impact: { score: assessment.impact.score, level: assessment.impact.level },
      owasp_risk: { level: assessment.owaspRisk.level },
      final_risk: { level: assessment.finalRisk.level },
      explanation: assessment.explanation,
      policy: { action: decision.action, approval_required: decision.approvalRequired, exception_applied: decision.exceptionApplied },
    };
  });

  return JSON.stringify(
    {
      findings,
      summary: evaluation.counts,
      final_decision: evaluation.finalAction,
      exit_code: evaluation.exitCode,
    },
    null,
    2,
  );
}
