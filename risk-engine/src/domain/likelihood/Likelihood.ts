export type RatingLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/** Each factor is scored 0-9 per OWASP Risk Rating Methodology. */
export interface ThreatAgentFactors {
  skill: number;
  motive: number;
  opportunity: number;
  size: number;
}

export interface VulnerabilityFactors {
  discovery: number;
  exploit: number;
  awareness: number;
  detection: number;
}

export interface FactorGroupResult<F> {
  factors: F;
  score: number;
  explanations: string[];
}

export interface LikelihoodResult {
  score: number;
  level: RatingLevel;
  threatAgent: FactorGroupResult<ThreatAgentFactors>;
  vulnerability: FactorGroupResult<VulnerabilityFactors>;
  explanations: string[];
}

/** OWASP Risk Rating thresholds: 0-<3 LOW, 3-<6 MEDIUM, 6-9 HIGH. */
export function levelForScore(score: number): RatingLevel {
  if (score < 3) return 'LOW';
  if (score < 6) return 'MEDIUM';
  return 'HIGH';
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function calculateLikelihood(
  threatAgent: { factors: ThreatAgentFactors; explanations: string[] },
  vulnerability: { factors: VulnerabilityFactors; explanations: string[] },
): LikelihoodResult {
  const threatAgentScore = average(Object.values(threatAgent.factors));
  const vulnerabilityScore = average(Object.values(vulnerability.factors));
  const score = average([threatAgentScore, vulnerabilityScore]);

  return {
    score,
    level: levelForScore(score),
    threatAgent: { factors: threatAgent.factors, score: threatAgentScore, explanations: threatAgent.explanations },
    vulnerability: {
      factors: vulnerability.factors,
      score: vulnerabilityScore,
      explanations: vulnerability.explanations,
    },
    explanations: [...threatAgent.explanations, ...vulnerability.explanations],
  };
}
