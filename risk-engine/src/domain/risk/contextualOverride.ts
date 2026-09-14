import { AssetContext, hasSensitiveData } from '../../context/AssetContext';
import { riskLevelRank, RISK_LEVEL_ORDER, RiskLevel } from './owaspRiskMatrix';

export interface ContextualOverrideResult {
  level: RiskLevel;
  escalated: boolean;
  deescalated: boolean;
  explanations: string[];
}

/**
 * Applies readme.md section 11's organizational context layer on top of the raw
 * OWASP matrix result. Intentionally conservative: escalation only ever raises to
 * CRITICAL from HIGH, and de-escalation is capped at one level, so this layer can
 * never fully hide a finding — it only sharpens the signal the matrix already gave.
 */
export function applyContextualOverride(owaspRisk: RiskLevel, context: AssetContext): ContextualOverrideResult {
  const explanations: string[] = [];

  const exposed = context.environment.internetExposed && context.environment.production;
  const sensitive = hasSensitiveData(context);

  if (riskLevelRank(owaspRisk) >= riskLevelRank('HIGH') && exposed && sensitive) {
    if (context.environment.internetExposed) explanations.push('Internet exposed');
    if (context.environment.production) explanations.push('Production environment');
    if (context.dataClassification.financial) explanations.push('Financial data');
    if (context.dataClassification.pii) explanations.push('PII');
    if (context.dataClassification.credentials) explanations.push('Credentials at risk');
    if (owaspRisk !== 'CRITICAL') {
      explanations.push(`Escalated from ${owaspRisk} to CRITICAL due to production internet-facing exposure of sensitive data`);
      return { level: 'CRITICAL', escalated: true, deescalated: false, explanations };
    }
    return { level: owaspRisk, escalated: false, deescalated: false, explanations };
  }

  const isolated = !context.environment.internetExposed && !context.environment.production && !sensitive;
  if (isolated && riskLevelRank(owaspRisk) <= riskLevelRank('HIGH') && riskLevelRank(owaspRisk) > 0) {
    const deescalatedIndex = riskLevelRank(owaspRisk) - 1;
    const deescalatedLevel = RISK_LEVEL_ORDER[deescalatedIndex];
    explanations.push('Internal development context, no sensitive data, not production');
    explanations.push(`De-escalated from ${owaspRisk} to ${deescalatedLevel} (max 1 level, contextual risk layer)`);
    return { level: deescalatedLevel, escalated: false, deescalated: true, explanations };
  }

  return { level: owaspRisk, escalated: false, deescalated: false, explanations: [] };
}
