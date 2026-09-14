import * as path from 'path';
import { loadApplicationContext } from '../../../src/context/loadApplicationContext';
import { loadRulesConfig } from '../../../src/engine/cweRules';
import { assess } from '../../../src/engine/riskEngine';
import { validateFinding } from '../../../src/domain/finding/Finding';
import { riskLevelRank } from '../../../src/domain/risk/owaspRiskMatrix';

const FIXTURES = path.join(__dirname, '..', '..', 'fixtures', 'contexts');
const RULES = loadRulesConfig(path.join(__dirname, '..', '..', '..', 'config', 'likelihood-impact-rules.yml'));

const SQLI_FINDING = validateFinding({
  id: 'finding-sqli',
  source: 'SAST',
  scanner: 'codeql',
  rule: { id: 'js/sql-injection', cwe: ['CWE-89'] },
  severity: { scanner: 'HIGH', cvss: null },
  location: { repository: 'test-app', file: 'src/app.ts', line: 1 },
});

describe('application context archetypes', () => {
  it('rates the same SQLi finding higher for a payment API than for a dev tool', () => {
    const paymentContext = loadApplicationContext(path.join(FIXTURES, 'payment-api.yml'));
    const devToolContext = loadApplicationContext(path.join(FIXTURES, 'dev-tool.yml'));

    const paymentAssessment = assess(SQLI_FINDING, paymentContext, RULES);
    const devToolAssessment = assess(SQLI_FINDING, devToolContext, RULES);

    expect(riskLevelRank(paymentAssessment.finalRisk.level)).toBeGreaterThan(
      riskLevelRank(devToolAssessment.finalRisk.level),
    );
    expect(paymentAssessment.finalRisk.level).toBe('CRITICAL');
  });

  it.each(['public-api', 'internal-api', 'payment-api', 'admin-api', 'dev-tool'])(
    'loads the %s fixture and produces a deterministic, repeatable assessment',
    (archetype) => {
      const context = loadApplicationContext(path.join(FIXTURES, `${archetype}.yml`));
      const first = assess(SQLI_FINDING, context, RULES);
      const second = assess(SQLI_FINDING, context, RULES);
      expect(second.finalRisk.level).toBe(first.finalRisk.level);
      expect(second.explanation).toEqual(first.explanation);
    },
  );

  it('an internal admin tool never escalates to CRITICAL even with credentials in scope', () => {
    const adminContext = loadApplicationContext(path.join(FIXTURES, 'admin-api.yml'));
    const assessment = assess(SQLI_FINDING, adminContext, RULES);
    expect(assessment.finalRisk.escalated).toBe(false);
  });

  it('a public API with no sensitive data is never escalated by the contextual layer', () => {
    const publicContext = loadApplicationContext(path.join(FIXTURES, 'public-api.yml'));
    const assessment = assess(SQLI_FINDING, publicContext, RULES);
    expect(assessment.finalRisk.escalated).toBe(false);
  });
});
