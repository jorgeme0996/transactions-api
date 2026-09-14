import { RiskAssessment } from '../domain/risk/RiskAssessment';
import { EvaluationSummary } from '../policy/evaluate';

/** Console summary described in readme.md section 27 (`risk-engine analyze`). */
export function renderAnalyzeSummary(assessments: RiskAssessment[], evaluation: EvaluationSummary): string {
  return [
    'Security Risk Assessment',
    '',
    `Findings: ${assessments.length}`,
    '',
    `Critical: ${evaluation.counts.CRITICAL}`,
    `High:     ${evaluation.counts.HIGH}`,
    `Medium:   ${evaluation.counts.MEDIUM}`,
    `Low:      ${evaluation.counts.LOW}`,
    `Note:     ${evaluation.counts.NOTE}`,
    '',
    `Final Decision: ${evaluation.finalAction}`,
    '',
    `Exit code: ${evaluation.exitCode}`,
  ].join('\n');
}

/** Console output for `risk-engine explain <finding-id>` (readme.md section 27). */
export function renderExplain(assessment: RiskAssessment): string {
  const label = assessment.finding.rule.cwe.join(', ') || assessment.finding.rule.id;
  return [
    `Finding: ${label} (${assessment.findingId})`,
    '',
    `Likelihood: ${assessment.likelihood.level}`,
    `Impact: ${assessment.impact.level}`,
    '',
    `Risk: ${assessment.finalRisk.level}`,
    '',
    'Reasons:',
    ...assessment.explanation.map((e) => `- ${e}`),
  ].join('\n');
}
