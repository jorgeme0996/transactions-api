import { AssetContext } from '../context/AssetContext';
import { BusinessImpactFactors } from '../domain/impact/Impact';
import { RulesConfig } from './cweRules';

export function deriveBusinessImpactFactors(
  context: AssetContext,
  rules: RulesConfig,
): { factors: BusinessImpactFactors; explanations: string[] } {
  const explanations: string[] = [];

  const financial = context.dataClassification.financial
    ? rules.businessImpact.financial.financialData
    : rules.businessImpact.financial.noFinancialData;
  explanations.push(`Financial damage=${financial} (${context.dataClassification.financial ? 'financial data' : 'no financial data'})`);

  const privacy = context.dataClassification.pii ? rules.businessImpact.privacy.pii : rules.businessImpact.privacy.noPii;
  explanations.push(`Privacy=${privacy} (${context.dataClassification.pii ? 'PII' : 'no PII'})`);

  let compliance = rules.businessImpact.compliance.none;
  if (context.compliance.pciDss) {
    compliance = rules.businessImpact.compliance.pciDss;
    explanations.push(`Compliance=${compliance} (PCI-DSS in scope)`);
  } else if (context.compliance.soc2) {
    compliance = rules.businessImpact.compliance.soc2Only;
    explanations.push(`Compliance=${compliance} (SOC2 in scope)`);
  } else {
    explanations.push(`Compliance=${compliance} (no compliance frameworks in scope)`);
  }

  const reputation = rules.businessImpact.reputationByCriticality[context.businessCriticality];
  explanations.push(`Reputation damage=${reputation} (business criticality ${context.businessCriticality})`);

  const businessContinuity = rules.businessImpact.businessContinuityByCriticality[context.businessCriticality];
  explanations.push(`Business continuity=${businessContinuity} (business criticality ${context.businessCriticality})`);

  return { factors: { financial, reputation, compliance, privacy, businessContinuity }, explanations };
}
