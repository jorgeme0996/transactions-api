import { execFileSync } from 'child_process';
import * as path from 'path';

const CLI = path.join(__dirname, '..', 'src', 'cli.ts');
const CONFIG = path.join(__dirname, '..', 'config');
const FIXTURES = path.join(__dirname, 'fixtures');

function runCli(args: string[]): { stdout: string; status: number } {
  try {
    const stdout = execFileSync('node', ['-r', 'ts-node/register/transpile-only', CLI, ...args], {
      encoding: 'utf8',
    });
    return { stdout, status: 0 };
  } catch (err) {
    const e = err as { stdout?: string; status?: number };
    return { stdout: e.stdout ?? '', status: e.status ?? 1 };
  }
}

describe('risk-engine CLI', () => {
  it('analyze exits 1 and prints BLOCK for the intentional findings fixture set', () => {
    const result = runCli([
      'analyze',
      '--sast',
      path.join(FIXTURES, 'codeql-alerts.json'),
      '--sca',
      path.join(FIXTURES, 'sca-findings.json'),
      '--secrets',
      path.join(FIXTURES, 'gitleaks-results.sarif'),
      '--context',
      path.join(CONFIG, 'application.yml'),
      '--policy',
      path.join(CONFIG, 'risk-policy.yml'),
    ]);

    expect(result.stdout).toContain('Final Decision: BLOCK');
    expect(result.status).toBe(1);
  });

  it('analyze exits 0 for a low-risk finding in a non-sensitive context', () => {
    const result = runCli([
      'analyze',
      '--findings',
      path.join(FIXTURES, 'low-risk-finding.json'),
      '--context',
      path.join(__dirname, 'fixtures', 'contexts', 'dev-tool.yml'),
      '--policy',
      path.join(CONFIG, 'risk-policy.yml'),
    ]);

    expect(result.status).toBe(0);
  });

  it('explain prints the reasoning for a specific finding id', () => {
    const result = runCli([
      'explain',
      'codeql-transacciones-api-1',
      '--sast',
      path.join(FIXTURES, 'codeql-alerts.json'),
      '--context',
      path.join(CONFIG, 'application.yml'),
      '--policy',
      path.join(CONFIG, 'risk-policy.yml'),
    ]);

    expect(result.stdout).toContain('Reasons:');
    expect(result.stdout).toContain('Risk:');
  });
});
