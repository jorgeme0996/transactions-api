import { calculateImpact } from '../../../src/domain/impact/Impact';

describe('calculateImpact', () => {
  it('produces LOW when both technical and business impact are low', () => {
    const result = calculateImpact(
      { factors: { confidentiality: 1, integrity: 1, availability: 1, accountability: 1 }, explanations: [] },
      { factors: { financial: 2, reputation: 2, compliance: 2, privacy: 2, businessContinuity: 1 }, explanations: [] },
    );
    expect(result.level).toBe('LOW');
  });

  it('produces MEDIUM when technical and business impact are mid-range', () => {
    const result = calculateImpact(
      { factors: { confidentiality: 4, integrity: 4, availability: 4, accountability: 4 }, explanations: [] },
      { factors: { financial: 4, reputation: 4, compliance: 4, privacy: 4, businessContinuity: 4 }, explanations: [] },
    );
    expect(result.level).toBe('MEDIUM');
  });

  it('produces HIGH when both technical and business impact are high', () => {
    const result = calculateImpact(
      { factors: { confidentiality: 9, integrity: 9, availability: 8, accountability: 8 }, explanations: [] },
      { factors: { financial: 8, reputation: 9, compliance: 8, privacy: 8, businessContinuity: 7 }, explanations: [] },
    );
    expect(result.level).toBe('HIGH');
  });

  it('mode "max" takes business impact over a lower technical impact', () => {
    const result = calculateImpact(
      { factors: { confidentiality: 2, integrity: 2, availability: 2, accountability: 2 }, explanations: [] },
      { factors: { financial: 8, reputation: 9, compliance: 8, privacy: 8, businessContinuity: 7 }, explanations: [] },
      'max',
    );
    expect(result.level).toBe('HIGH');
    expect(result.score).toBe(result.business.score);
  });

  it('mode "average" blends technical and business impact instead of taking the max', () => {
    const result = calculateImpact(
      { factors: { confidentiality: 2, integrity: 2, availability: 2, accountability: 2 }, explanations: [] },
      { factors: { financial: 8, reputation: 9, compliance: 8, privacy: 8, businessContinuity: 7 }, explanations: [] },
      'average',
    );
    expect(result.score).toBeCloseTo((2 + 8) / 2, 5);
  });
});
