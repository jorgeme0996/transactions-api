import { Finding } from '../finding/Finding';
import { LikelihoodResult } from '../likelihood/Likelihood';
import { ImpactResult } from '../impact/Impact';
import { RiskLevel } from './owaspRiskMatrix';

export interface RiskAssessment {
  findingId: string;
  finding: Finding;
  likelihood: LikelihoodResult;
  impact: ImpactResult;
  owaspRisk: { level: RiskLevel };
  finalRisk: { level: RiskLevel; escalated: boolean; deescalated: boolean };
  explanation: string[];
}
