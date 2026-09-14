import { EvaluationSummary } from '../policy/evaluate';

export interface CheckRunPayload {
  name: string;
  conclusion: 'success' | 'neutral' | 'failure';
  title: string;
  summary: string;
}

/**
 * Builds the payload for a GitHub Check Run without calling the GitHub API --
 * keeps the engine testable without mocking network calls and reusable outside
 * GitHub Actions. The actual `checks.create` call lives in
 * .github/scripts/risk-assessment-report.js.
 */
export function buildCheckRunPayload(evaluation: EvaluationSummary): CheckRunPayload {
  const conclusion = evaluation.finalAction === 'BLOCK' ? 'failure' : evaluation.finalAction === 'WARN' ? 'neutral' : 'success';
  const title =
    evaluation.finalAction === 'BLOCK'
      ? 'Blocked by risk-based security gate'
      : evaluation.finalAction === 'WARN'
        ? 'Passed with warnings'
        : 'Passed';

  const summary = `Critical: ${evaluation.counts.CRITICAL} | High: ${evaluation.counts.HIGH} | Medium: ${evaluation.counts.MEDIUM} | Low: ${evaluation.counts.LOW} | Note: ${evaluation.counts.NOTE}`;

  return { name: 'Security Risk Gate', conclusion, title, summary };
}
