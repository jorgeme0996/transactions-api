import { evaluateAll, evaluateFinding } from '../../../src/policy/evaluate';
import { RiskPolicyConfig } from '../../../src/domain/policy/Policy';
import { RiskAssessment } from '../../../src/domain/risk/RiskAssessment';
import { RiskLevel } from '../../../src/domain/risk/owaspRiskMatrix';
import { RiskException, validateException } from '../../../src/domain/policy/Exception';

const POLICY: RiskPolicyConfig = {
  policy: {
    critical: { action: 'BLOCK', approvalRequired: true },
    high: { action: 'BLOCK' },
    medium: { action: 'WARN' },
    low: { action: 'ALLOW' },
    note: { action: 'ALLOW' },
  },
  unmappedAction: 'WARN',
};

function fakeAssessment(findingId: string, level: RiskLevel): RiskAssessment {
  return {
    findingId,
    finding: {
      id: findingId,
      source: 'SAST',
      scanner: 'codeql',
      rule: { id: 'test-rule', cwe: ['CWE-89'] },
      severity: { scanner: 'HIGH', cvss: null },
      location: { repository: 'transacciones-api' },
    },
    likelihood: {
      score: 5,
      level: 'MEDIUM',
      threatAgent: { factors: { skill: 5, motive: 5, opportunity: 5, size: 5 }, score: 5, explanations: [] },
      vulnerability: { factors: { discovery: 5, exploit: 5, awareness: 5, detection: 5 }, score: 5, explanations: [] },
      explanations: [],
    },
    impact: {
      score: 5,
      level: 'MEDIUM',
      mode: 'max',
      technical: { factors: { confidentiality: 5, integrity: 5, availability: 5, accountability: 5 }, score: 5, explanations: [] },
      business: { factors: { financial: 5, reputation: 5, compliance: 5, privacy: 5, businessContinuity: 5 }, score: 5, explanations: [] },
      explanations: [],
    },
    owaspRisk: { level },
    finalRisk: { level, escalated: false, deescalated: false },
    explanation: [],
  };
}

describe('evaluateFinding', () => {
  it.each<[RiskLevel, string, boolean]>([
    ['CRITICAL', 'BLOCK', true],
    ['HIGH', 'BLOCK', false],
    ['MEDIUM', 'WARN', false],
    ['LOW', 'ALLOW', false],
    ['NOTE', 'ALLOW', false],
  ])('risk=%s -> action=%s (approvalRequired=%s)', (level, expectedAction, approvalRequired) => {
    const decision = evaluateFinding(fakeAssessment('f-1', level), POLICY, []);
    expect(decision.action).toBe(expectedAction);
    expect(decision.approvalRequired).toBe(approvalRequired);
  });

  it('applies a valid, unexpired exception as ALLOW', () => {
    const exception: RiskException = validateException({
      finding_id: 'f-1',
      reason: 'False positive confirmed by security team',
      approved_by: 'security-team',
      expires_at: '2999-12-31',
    });
    const decision = evaluateFinding(fakeAssessment('f-1', 'CRITICAL'), POLICY, [exception]);
    expect(decision.action).toBe('ALLOW');
    expect(decision.exceptionApplied).toBe(true);
  });

  it('ignores an expired exception and falls back to the normal policy', () => {
    const exception: RiskException = validateException({
      finding_id: 'f-1',
      reason: 'Temporary acceptance',
      approved_by: 'security-team',
      expires_at: '2000-01-01',
    });
    const decision = evaluateFinding(fakeAssessment('f-1', 'CRITICAL'), POLICY, [exception]);
    expect(decision.action).toBe('BLOCK');
    expect(decision.exceptionApplied).toBe(false);
  });

  it('rejects an exception without a reason', () => {
    expect(() =>
      validateException({ finding_id: 'f-1', approved_by: 'security-team', expires_at: '2999-12-31' }),
    ).toThrow(/reason/);
  });
});

describe('evaluateAll', () => {
  it('escalates the final action to the most severe decision and sets the exit code', () => {
    const assessments = [fakeAssessment('f-1', 'LOW'), fakeAssessment('f-2', 'CRITICAL'), fakeAssessment('f-3', 'MEDIUM')];
    const evaluation = evaluateAll(assessments, POLICY, []);
    expect(evaluation.finalAction).toBe('BLOCK');
    expect(evaluation.exitCode).toBe(1);
    expect(evaluation.counts.CRITICAL).toBe(1);
  });

  it('passes with exit code 0 when nothing exceeds WARN', () => {
    const assessments = [fakeAssessment('f-1', 'LOW'), fakeAssessment('f-2', 'MEDIUM')];
    const evaluation = evaluateAll(assessments, POLICY, []);
    expect(evaluation.finalAction).toBe('WARN');
    expect(evaluation.exitCode).toBe(0);
  });
});
