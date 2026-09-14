import { calculateLikelihood, levelForScore } from '../../../src/domain/likelihood/Likelihood';

describe('levelForScore', () => {
  it('classifies scores below 3 as LOW', () => {
    expect(levelForScore(0)).toBe('LOW');
    expect(levelForScore(2.9)).toBe('LOW');
  });

  it('classifies scores from 3 to below 6 as MEDIUM', () => {
    expect(levelForScore(3)).toBe('MEDIUM');
    expect(levelForScore(5.9)).toBe('MEDIUM');
  });

  it('classifies scores from 6 to 9 as HIGH', () => {
    expect(levelForScore(6)).toBe('HIGH');
    expect(levelForScore(9)).toBe('HIGH');
  });
});

describe('calculateLikelihood', () => {
  it('produces LOW when both factor groups are low', () => {
    const result = calculateLikelihood(
      { factors: { skill: 1, motive: 1, opportunity: 1, size: 1 }, explanations: [] },
      { factors: { discovery: 1, exploit: 1, awareness: 1, detection: 1 }, explanations: [] },
    );
    expect(result.level).toBe('LOW');
    expect(result.threatAgent.score).toBe(1);
    expect(result.vulnerability.score).toBe(1);
  });

  it('produces MEDIUM when both factor groups are mid-range', () => {
    const result = calculateLikelihood(
      { factors: { skill: 5, motive: 5, opportunity: 5, size: 5 }, explanations: [] },
      { factors: { discovery: 4, exploit: 4, awareness: 4, detection: 4 }, explanations: [] },
    );
    expect(result.level).toBe('MEDIUM');
  });

  it('produces HIGH when both factor groups are high', () => {
    const result = calculateLikelihood(
      { factors: { skill: 9, motive: 9, opportunity: 9, size: 9 }, explanations: [] },
      { factors: { discovery: 9, exploit: 9, awareness: 9, detection: 8 }, explanations: [] },
    );
    expect(result.level).toBe('HIGH');
  });

  it('preserves explanations from both factor groups', () => {
    const result = calculateLikelihood(
      { factors: { skill: 6, motive: 9, opportunity: 9, size: 9 }, explanations: ['ta-reason'] },
      { factors: { discovery: 9, exploit: 9, awareness: 9, detection: 8 }, explanations: ['vuln-reason'] },
    );
    expect(result.explanations).toEqual(['ta-reason', 'vuln-reason']);
  });
});
