import * as fs from 'fs';
import * as path from 'path';
import { loadApplicationContext } from '../../src/context/loadApplicationContext';
import { loadRulesConfig } from '../../src/engine/cweRules';
import { loadRiskPolicy } from '../../src/policy/loadRiskPolicy';
import { loadExceptions } from '../../src/policy/loadExceptions';
import { assessAll } from '../../src/engine/riskEngine';
import { evaluateAll } from '../../src/policy/evaluate';
import { parseCodeqlAlerts } from '../../src/parsers/sast/codeqlAlertsParser';
import { parseGitleaksSarif } from '../../src/parsers/secrets/gitleaksSarifParser';
import { parseScaFindings } from '../../src/parsers/sca/scaJsonParser';

const CONFIG = path.join(__dirname, '..', '..', 'config');
const FIXTURES = path.join(__dirname, '..', 'fixtures');

/**
 * End-to-end regression for the intentional findings introduced in commit 1458890
 * ("test: introduce intentional SAST/SCA/secret findings for CI guardrail testing"):
 * SQLi, command injection, prototype pollution, a hardcoded AWS-style key, and a
 * vulnerable lodash dependency, assessed against transacciones-api's real context.
 * This is the concrete case from readme.md sections 3/20: production + internet
 * exposed + financial/PII data must turn these into a BLOCK, not just "HIGH severity".
 */
describe('risk pipeline against transacciones-api real findings (commit 1458890)', () => {
  it('blocks the pull request', () => {
    const context = loadApplicationContext(path.join(CONFIG, 'application.yml'));
    const rules = loadRulesConfig(path.join(CONFIG, 'likelihood-impact-rules.yml'));
    const policy = loadRiskPolicy(path.join(CONFIG, 'risk-policy.yml'));
    const exceptions = loadExceptions(path.join(CONFIG, 'exceptions.yml'));

    const codeqlAlerts = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'codeql-alerts.json'), 'utf8'));
    const gitleaksSarif = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'gitleaks-results.sarif'), 'utf8'));
    const scaFindings = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'sca-findings.json'), 'utf8'));

    const findings = [
      ...parseCodeqlAlerts(codeqlAlerts, context.name),
      ...parseGitleaksSarif(gitleaksSarif, context.name),
      ...parseScaFindings(scaFindings, context.name),
    ];

    expect(findings).toHaveLength(5);

    const assessments = assessAll(findings, context, rules);
    const evaluation = evaluateAll(assessments, policy, exceptions);

    expect(evaluation.finalAction).toBe('BLOCK');
    expect(evaluation.exitCode).toBe(1);
    expect(evaluation.counts.CRITICAL + evaluation.counts.HIGH).toBeGreaterThan(0);

    const sqli = assessments.find((a) => a.finding.rule.cwe.includes('CWE-89'))!;
    expect(sqli.finalRisk.level).toBe('CRITICAL');
    expect(sqli.explanation.join(' ')).toMatch(/Internet exposed|Production|Financial|PII/);

    const secret = assessments.find((a) => a.finding.source === 'SECRET')!;
    expect(JSON.stringify(secret)).not.toContain('AKIA');
  });
});
