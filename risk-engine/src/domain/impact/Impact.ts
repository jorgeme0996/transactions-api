import { FactorGroupResult, RatingLevel, levelForScore } from '../likelihood/Likelihood';

/** Each factor is scored 0-9 per OWASP Risk Rating Methodology. */
export interface TechnicalImpactFactors {
  confidentiality: number;
  integrity: number;
  availability: number;
  accountability: number;
}

/** readme.md section 9 extends the standard OWASP business factors with "Business Continuity". */
export interface BusinessImpactFactors {
  financial: number;
  reputation: number;
  compliance: number;
  privacy: number;
  businessContinuity: number;
}

export type ImpactMode = 'max' | 'average';

export interface ImpactResult {
  score: number;
  level: RatingLevel;
  mode: ImpactMode;
  technical: FactorGroupResult<TechnicalImpactFactors>;
  business: FactorGroupResult<BusinessImpactFactors>;
  explanations: string[];
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function calculateImpact(
  technical: { factors: TechnicalImpactFactors; explanations: string[] },
  business: { factors: BusinessImpactFactors; explanations: string[] },
  mode: ImpactMode = 'max',
): ImpactResult {
  const technicalScore = average(Object.values(technical.factors));
  const businessScore = average(Object.values(business.factors));

  // mode 'max': a finding with low technical impact but high business impact
  // (e.g. a PCI-DSS compliance exposure) must not be underrated. See risk-engine
  // README / plan notes for the rationale behind defaulting to 'max' over 'average'.
  const score = mode === 'max' ? Math.max(technicalScore, businessScore) : average([technicalScore, businessScore]);

  const explanations = [...technical.explanations, ...business.explanations];
  if (mode === 'max' && businessScore > technicalScore) {
    explanations.push(
      `Impact driven by business factors (${businessScore.toFixed(1)}) over technical factors (${technicalScore.toFixed(1)}), mode=max`,
    );
  }

  return {
    score,
    level: levelForScore(score),
    mode,
    technical: { factors: technical.factors, score: technicalScore, explanations: technical.explanations },
    business: { factors: business.factors, score: businessScore, explanations: business.explanations },
    explanations,
  };
}
