import { RatingLevel } from '../likelihood/Likelihood';

export type RiskLevel = 'NOTE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** readme.md section 10 decision matrix: Impact (rows) x Likelihood (columns). */
const MATRIX: Record<RatingLevel, Record<RatingLevel, RiskLevel>> = {
  LOW: { LOW: 'NOTE', MEDIUM: 'LOW', HIGH: 'MEDIUM' },
  MEDIUM: { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
  HIGH: { LOW: 'MEDIUM', MEDIUM: 'HIGH', HIGH: 'CRITICAL' },
};

export function mapLikelihoodImpactToRisk(likelihood: RatingLevel, impact: RatingLevel): RiskLevel {
  return MATRIX[impact][likelihood];
}

export const RISK_LEVEL_ORDER: RiskLevel[] = ['NOTE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function riskLevelRank(level: RiskLevel): number {
  return RISK_LEVEL_ORDER.indexOf(level);
}
