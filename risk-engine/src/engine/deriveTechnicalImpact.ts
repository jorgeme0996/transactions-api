import { AssetContext } from '../context/AssetContext';
import { TechnicalImpactFactors } from '../domain/impact/Impact';
import { RulesConfig } from './cweRules';

/**
 * Caps the CWE table's technical impact factors by how critical this asset is
 * (technical_impact_ceiling_by_criticality). Without this, the same CWE always
 * produces the same technical impact regardless of context, which would defeat
 * readme.md section 3's core principle -- severity is not risk. This is what lets
 * a SQLi in a disposable dev tool score lower than the same SQLi in a payment API.
 */
export function deriveTechnicalImpactFactors(
  cweTechnicalImpact: TechnicalImpactFactors,
  context: AssetContext,
  rules: RulesConfig,
): { factors: TechnicalImpactFactors; explanations: string[] } {
  const ceiling = rules.technicalImpactCeilingByCriticality[context.businessCriticality];
  const capped = (value: number) => Math.min(value, ceiling);

  const factors: TechnicalImpactFactors = {
    confidentiality: capped(cweTechnicalImpact.confidentiality),
    integrity: capped(cweTechnicalImpact.integrity),
    availability: capped(cweTechnicalImpact.availability),
    accountability: capped(cweTechnicalImpact.accountability),
  };

  const wasCapped = Object.values(cweTechnicalImpact).some((v) => v > ceiling);
  const explanations = wasCapped
    ? [`Technical impact capped at ${ceiling} for business criticality ${context.businessCriticality}`]
    : [];

  return { factors, explanations };
}
