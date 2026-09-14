import { AssetContext, hasSensitiveData } from '../context/AssetContext';
import { Finding } from '../domain/finding/Finding';
import { ThreatAgentFactors } from '../domain/likelihood/Likelihood';
import { RulesConfig } from './cweRules';

export function deriveThreatAgentFactors(
  context: AssetContext,
  finding: Finding,
  rules: RulesConfig,
): { factors: ThreatAgentFactors; explanations: string[] } {
  const explanations: string[] = [];

  const skill = rules.threatAgent.skillBySource[finding.source] ?? rules.threatAgent.skillBySource.SAST;
  explanations.push(`Skill=${skill} (based on finding source ${finding.source})`);

  const sensitive = hasSensitiveData(context);
  const motive = sensitive ? rules.threatAgent.motive.sensitiveData : rules.threatAgent.motive.noSensitiveData;
  explanations.push(`Motive=${motive} (${sensitive ? 'sensitive data present' : 'no sensitive data'})`);

  const opportunity = context.authentication.required
    ? rules.threatAgent.opportunity.authenticationRequired
    : rules.threatAgent.opportunity.authenticationNotRequired;
  explanations.push(
    `Opportunity=${opportunity} (authentication ${context.authentication.required ? 'required' : 'not required'})`,
  );

  let size = rules.threatAgent.size.internalOnly;
  if (context.environment.internetExposed && context.businessCriticality === 'CRITICAL') {
    size = rules.threatAgent.size.internetExposedAndCritical;
    explanations.push('Size=' + size + ' (internet exposed + critical asset)');
  } else if (context.environment.internetExposed) {
    size = rules.threatAgent.size.internetExposed;
    explanations.push('Size=' + size + ' (internet exposed)');
  } else {
    explanations.push('Size=' + size + ' (internal only)');
  }

  return { factors: { skill, motive, opportunity, size }, explanations };
}
