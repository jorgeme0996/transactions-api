import * as fs from 'fs';
import { parse } from 'yaml';
import { VulnerabilityFactors } from '../domain/likelihood/Likelihood';
import { TechnicalImpactFactors } from '../domain/impact/Impact';
import { Finding, ScannerSeverity } from '../domain/finding/Finding';
import { ImpactMode } from '../domain/impact/Impact';

interface FactorSet {
  vulnerability: VulnerabilityFactors;
  technical_impact: TechnicalImpactFactors;
  description?: string;
}

export interface RulesConfig {
  impactMode: ImpactMode;
  cweRules: Record<string, FactorSet>;
  severityFallback: Record<ScannerSeverity, FactorSet>;
  threatAgent: {
    skillBySource: Record<string, number>;
    motive: { sensitiveData: number; noSensitiveData: number };
    opportunity: { authenticationRequired: number; authenticationNotRequired: number };
    size: { internetExposedAndCritical: number; internetExposed: number; internalOnly: number };
  };
  businessImpact: {
    financial: { financialData: number; noFinancialData: number };
    privacy: { pii: number; noPii: number };
    compliance: { pciDss: number; soc2Only: number; none: number };
    reputationByCriticality: Record<string, number>;
    businessContinuityByCriticality: Record<string, number>;
  };
  contextualOverride: {
    escalateMinOwaspRisk: string;
    deescalateMaxOwaspRisk: string;
    deescalateMaxLevels: number;
  };
  technicalImpactCeilingByCriticality: Record<string, number>;
}

export function loadRulesConfig(filePath: string): RulesConfig {
  const raw = parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  const ta = raw.threat_agent as Record<string, unknown>;
  const bi = raw.business_impact as Record<string, unknown>;
  const co = raw.contextual_override as Record<string, unknown>;

  return {
    impactMode: (raw.impact_mode as ImpactMode) ?? 'max',
    cweRules: raw.cwe_rules as Record<string, FactorSet>,
    severityFallback: raw.severity_fallback as Record<ScannerSeverity, FactorSet>,
    threatAgent: {
      skillBySource: ta.skill_by_source as Record<string, number>,
      motive: {
        sensitiveData: (ta.motive as Record<string, number>).sensitive_data,
        noSensitiveData: (ta.motive as Record<string, number>).no_sensitive_data,
      },
      opportunity: {
        authenticationRequired: (ta.opportunity as Record<string, number>).authentication_required,
        authenticationNotRequired: (ta.opportunity as Record<string, number>).authentication_not_required,
      },
      size: {
        internetExposedAndCritical: (ta.size as Record<string, number>).internet_exposed_and_critical,
        internetExposed: (ta.size as Record<string, number>).internet_exposed,
        internalOnly: (ta.size as Record<string, number>).internal_only,
      },
    },
    businessImpact: {
      financial: {
        financialData: (bi.financial as Record<string, number>).financial_data,
        noFinancialData: (bi.financial as Record<string, number>).no_financial_data,
      },
      privacy: {
        pii: (bi.privacy as Record<string, number>).pii,
        noPii: (bi.privacy as Record<string, number>).no_pii,
      },
      compliance: {
        pciDss: (bi.compliance as Record<string, number>).pci_dss,
        soc2Only: (bi.compliance as Record<string, number>).soc2_only,
        none: (bi.compliance as Record<string, number>).none,
      },
      reputationByCriticality: bi.reputation_by_criticality as Record<string, number>,
      businessContinuityByCriticality: bi.business_continuity_by_criticality as Record<string, number>,
    },
    contextualOverride: {
      escalateMinOwaspRisk: co.escalate_min_owasp_risk as string,
      deescalateMaxOwaspRisk: co.deescalate_max_owasp_risk as string,
      deescalateMaxLevels: co.deescalate_max_levels as number,
    },
    technicalImpactCeilingByCriticality: raw.technical_impact_ceiling_by_criticality as Record<string, number>,
  };
}

export interface ResolvedCweRule {
  vulnerability: VulnerabilityFactors;
  technicalImpact: TechnicalImpactFactors;
  matched: boolean;
  matchedCwe?: string;
  explanations: string[];
}

/**
 * Resolution order: exact CWE match -> severity fallback -> UNKNOWN fallback.
 * Always returns a usable result (see file header in likelihood-impact-rules.yml)
 * and always says which path it took, so an unmapped CWE is visible, not silent.
 */
export function resolveCweRule(rules: RulesConfig, finding: Finding): ResolvedCweRule {
  for (const cwe of finding.rule.cwe) {
    const match = rules.cweRules[cwe];
    if (match) {
      return {
        vulnerability: match.vulnerability,
        technicalImpact: match.technical_impact,
        matched: true,
        matchedCwe: cwe,
        explanations: [`Matched ${cwe}${match.description ? ` (${match.description})` : ''} in rule table`],
      };
    }
  }

  const fallback = rules.severityFallback[finding.severity.scanner] ?? rules.severityFallback.UNKNOWN;
  return {
    vulnerability: fallback.vulnerability,
    technicalImpact: fallback.technical_impact,
    matched: false,
    explanations: [
      `No CWE rule matched for [${finding.rule.cwe.join(', ') || 'none'}]; used severity fallback for ${finding.severity.scanner} (rule_matched=false, consider adding this CWE to likelihood-impact-rules.yml)`,
    ],
  };
}
