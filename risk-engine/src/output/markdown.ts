import { RiskAssessment } from '../domain/risk/RiskAssessment';
import { EvaluationSummary } from '../policy/evaluate';

export const RISK_COMMENT_MARKER = '<!-- risk-assessment-report -->';

function findingLabel(assessment: RiskAssessment): string {
  const { finding } = assessment;
  if (finding.rule.cwe.length > 0) return finding.rule.cwe.join(', ');
  if (finding.sca?.cve) return finding.sca.cve;
  return finding.rule.id;
}

function resultLine(finalAction: EvaluationSummary['finalAction']): string {
  if (finalAction === 'BLOCK') return '❌ Pull Request BLOCKED';
  if (finalAction === 'WARN') return '⚠️ Pull Request has WARNINGS';
  return '✅ Pull Request PASSED';
}

/** Renders the PR summary described in readme.md section 17. */
export function renderPrComment(assessments: RiskAssessment[], evaluation: EvaluationSummary): string {
  const rows = assessments.map((assessment) => {
    const decision = evaluation.decisions.find((d) => d.findingId === assessment.findingId)!;
    const exceptionNote = decision.exceptionApplied ? ` (exception: ${decision.exceptionReason})` : '';
    return `| ${assessment.finding.source} | ${findingLabel(assessment)} | ${assessment.finding.severity.scanner} | ${assessment.finalRisk.level} | ${decision.action}${exceptionNote} |`;
  });

  const lines = [
    RISK_COMMENT_MARKER,
    '## 🔐 Security Risk Assessment',
    '',
    `Findings: ${assessments.length}`,
    '',
    '| Source | Finding | Severity | Risk | Action |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    '### Result',
    '',
    resultLine(evaluation.finalAction),
    '',
    `Critical findings: ${evaluation.counts.CRITICAL}`,
    `High findings: ${evaluation.counts.HIGH}`,
    `Medium findings: ${evaluation.counts.MEDIUM}`,
    `Low findings: ${evaluation.counts.LOW}`,
    `Note findings: ${evaluation.counts.NOTE}`,
  ];

  if (assessments.length > 0) {
    lines.push('', '<details><summary>Why (per finding)</summary>', '');
    for (const assessment of assessments) {
      lines.push(`**${findingLabel(assessment)}** (\`${assessment.findingId}\`)`, '');
      lines.push(...assessment.explanation.map((e) => `- ${e}`));
      lines.push('');
    }
    lines.push('</details>');
  }

  return lines.join('\n');
}
