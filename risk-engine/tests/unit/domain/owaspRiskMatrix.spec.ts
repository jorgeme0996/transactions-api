import { mapLikelihoodImpactToRisk } from '../../../src/domain/risk/owaspRiskMatrix';
import { RatingLevel } from '../../../src/domain/likelihood/Likelihood';

describe('mapLikelihoodImpactToRisk', () => {
  const cases: [RatingLevel, RatingLevel, string][] = [
    ['LOW', 'LOW', 'NOTE'],
    ['MEDIUM', 'LOW', 'LOW'],
    ['HIGH', 'LOW', 'MEDIUM'],
    ['LOW', 'MEDIUM', 'LOW'],
    ['MEDIUM', 'MEDIUM', 'MEDIUM'],
    ['HIGH', 'MEDIUM', 'HIGH'],
    ['LOW', 'HIGH', 'MEDIUM'],
    ['MEDIUM', 'HIGH', 'HIGH'],
    ['HIGH', 'HIGH', 'CRITICAL'],
  ];

  it.each(cases)('likelihood=%s x impact=%s -> %s', (likelihood, impact, expected) => {
    expect(mapLikelihoodImpactToRisk(likelihood, impact)).toBe(expected);
  });
});
