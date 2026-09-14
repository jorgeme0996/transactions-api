import { Finding } from '../domain/finding/Finding';
import { AssetContext } from '../context/AssetContext';
import { calculateLikelihood } from '../domain/likelihood/Likelihood';
import { calculateImpact } from '../domain/impact/Impact';
import { mapLikelihoodImpactToRisk, RiskLevel } from '../domain/risk/owaspRiskMatrix';
import { applyContextualOverride } from '../domain/risk/contextualOverride';
import { RiskAssessment } from '../domain/risk/RiskAssessment';
import { RulesConfig, resolveCweRule } from './cweRules';
import { deriveThreatAgentFactors } from './deriveThreatAgent';
import { deriveBusinessImpactFactors } from './deriveBusinessImpact';
import { deriveTechnicalImpactFactors } from './deriveTechnicalImpact';

/**
 * Orchestrates the full readme.md section 20 pipeline for a single finding:
 * classification -> likelihood -> impact -> OWASP risk -> contextual risk -> final risk.
 * Pure function: same finding + context + rules always produce the same assessment
 * (readme.md section 21: deterministic, reproducible).
 */
export function assess(finding: Finding, context: AssetContext, rules: RulesConfig): RiskAssessment {
  const cweRule = resolveCweRule(rules, finding);

  const threatAgent = deriveThreatAgentFactors(context, finding, rules);
  const vulnerability = { factors: cweRule.vulnerability, explanations: cweRule.explanations };
  const likelihood = calculateLikelihood(threatAgent, vulnerability);

  const cappedTechnical = deriveTechnicalImpactFactors(cweRule.technicalImpact, context, rules);
  const technical = {
    factors: cappedTechnical.factors,
    explanations: [...cweRule.explanations, ...cappedTechnical.explanations],
  };
  const business = deriveBusinessImpactFactors(context, rules);
  const impact = calculateImpact(technical, business, rules.impactMode);

  const owaspLevel: RiskLevel = mapLikelihoodImpactToRisk(likelihood.level, impact.level);
  const contextual = applyContextualOverride(owaspLevel, context);

  const explanation = [
    `Classification: ${finding.rule.cwe.join(', ') || finding.rule.id} (${finding.source}/${finding.scanner})`,
    ...cweRule.explanations,
    `Likelihood: ${likelihood.level} (score ${likelihood.score.toFixed(1)})`,
    ...threatAgent.explanations,
    `Impact: ${impact.level} (score ${impact.score.toFixed(1)}, mode=${impact.mode})`,
    ...cappedTechnical.explanations,
    ...business.explanations,
    `OWASP Risk (Likelihood x Impact): ${owaspLevel}`,
    ...contextual.explanations,
    `Final Risk: ${contextual.level}`,
  ];

  return {
    findingId: finding.id,
    finding,
    likelihood,
    impact,
    owaspRisk: { level: owaspLevel },
    finalRisk: { level: contextual.level, escalated: contextual.escalated, deescalated: contextual.deescalated },
    explanation,
  };
}

export function assessAll(findings: Finding[], context: AssetContext, rules: RulesConfig): RiskAssessment[] {
  return findings.map((finding) => assess(finding, context, rules));
}
