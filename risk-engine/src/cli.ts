#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import { Finding, validateFinding } from './domain/finding/Finding';
import { loadApplicationContext } from './context/loadApplicationContext';
import { loadRulesConfig } from './engine/cweRules';
import { assessAll } from './engine/riskEngine';
import { loadRiskPolicy } from './policy/loadRiskPolicy';
import { loadExceptions } from './policy/loadExceptions';
import { evaluateAll } from './policy/evaluate';
import { parseCodeqlAlerts } from './parsers/sast/codeqlAlertsParser';
import { parseGitleaksSarif } from './parsers/secrets/gitleaksSarifParser';
import { parseScaFindings } from './parsers/sca/scaJsonParser';
import { parseThreagileRisks } from './parsers/threat-model/threagileRisksParser';
import { renderPrComment } from './output/markdown';
import { renderJson } from './output/json';
import { renderAnalyzeSummary, renderExplain } from './output/cliTable';

const DEFAULT_RULES_PATH = path.join(__dirname, '..', 'config', 'likelihood-impact-rules.yml');
const DEFAULT_EXCEPTIONS_PATH = path.join(__dirname, '..', 'config', 'exceptions.yml');

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

interface SharedOptions {
  findings?: string;
  sast?: string;
  sca?: string;
  secrets?: string;
  threatModel?: string;
  context: string;
  policy: string;
  exceptions?: string;
  rules?: string;
  repository?: string;
}

function collectFindings(options: SharedOptions, repository: string): Finding[] {
  const findings: Finding[] = [];

  if (options.findings) {
    const raw = readJson(options.findings);
    if (!Array.isArray(raw)) throw new Error(`${options.findings} must contain a JSON array of findings`);
    findings.push(...raw.map(validateFinding));
  }
  if (options.sast) {
    const raw = readJson(options.sast);
    findings.push(...parseCodeqlAlerts(Array.isArray(raw) ? raw : [], repository));
  }
  if (options.sca) {
    const raw = readJson(options.sca);
    findings.push(...parseScaFindings(Array.isArray(raw) ? raw : [], repository));
  }
  if (options.secrets) {
    const raw = readJson(options.secrets);
    findings.push(...parseGitleaksSarif(raw, repository));
  }
  if (options.threatModel) {
    const raw = readJson(options.threatModel);
    findings.push(...parseThreagileRisks(Array.isArray(raw) ? raw : [], repository));
  }

  if (
    findings.length === 0 &&
    !options.findings &&
    !options.sast &&
    !options.sca &&
    !options.secrets &&
    !options.threatModel
  ) {
    throw new Error('Provide at least one of --findings, --sast, --sca, --secrets, --threat-model');
  }

  return findings;
}

function runAssessment(options: SharedOptions) {
  const context = loadApplicationContext(options.context);
  const repository = options.repository ?? context.name;
  const findings = collectFindings(options, repository);
  const rules = loadRulesConfig(options.rules ?? DEFAULT_RULES_PATH);
  const policyConfig = loadRiskPolicy(options.policy);
  const exceptions = loadExceptions(options.exceptions ?? DEFAULT_EXCEPTIONS_PATH);

  const assessments = assessAll(findings, context, rules);
  const evaluation = evaluateAll(assessments, policyConfig, exceptions);

  return { assessments, evaluation };
}

function writeOutput(content: string, outPath: string | undefined) {
  if (outPath) {
    fs.writeFileSync(outPath, content);
  } else {
    console.log(content);
  }
}

const program = new Command();
program.name('risk-engine').description('OWASP Risk Rating engine for transacciones-api DevSecOps pipeline');

program
  .command('analyze')
  .description('Analyze findings and produce a risk-based PASS/WARN/BLOCK decision')
  .option('--findings <path>', 'JSON array of pre-normalized findings')
  .option('--sast <path>', 'GitHub Code Scanning alerts JSON (CodeQL)')
  .option('--sca <path>', 'sca-findings.json produced by sca-epss-report.js')
  .option('--secrets <path>', 'gitleaks SARIF report')
  .option('--threat-model <path>', 'risks.json produced by threagile')
  .requiredOption('--context <path>', 'application.yml')
  .requiredOption('--policy <path>', 'risk-policy.yml')
  .option('--exceptions <path>', 'exceptions.yml')
  .option('--rules <path>', 'likelihood-impact-rules.yml')
  .option('--repository <name>', 'repository name override')
  .option('--format <format>', 'output format: table | json | markdown', 'table')
  .option('--out <path>', 'write output to a file instead of stdout')
  .action((options: SharedOptions & { format: string; out?: string }) => {
    try {
      const { assessments, evaluation } = runAssessment(options);

      const content =
        options.format === 'json'
          ? renderJson(assessments, evaluation)
          : options.format === 'markdown'
            ? renderPrComment(assessments, evaluation)
            : renderAnalyzeSummary(assessments, evaluation);

      writeOutput(content, options.out);
      process.exitCode = evaluation.exitCode;
    } catch (err) {
      console.error(`risk-engine analyze: ${(err as Error).message}`);
      process.exitCode = 1;
    }
  });

program
  .command('explain')
  .description('Explain how the risk was computed for a specific finding id')
  .argument('<findingId>', 'Finding id, e.g. finding-123')
  .option('--findings <path>', 'JSON array of pre-normalized findings')
  .option('--sast <path>', 'GitHub Code Scanning alerts JSON (CodeQL)')
  .option('--sca <path>', 'sca-findings.json produced by sca-epss-report.js')
  .option('--secrets <path>', 'gitleaks SARIF report')
  .option('--threat-model <path>', 'risks.json produced by threagile')
  .requiredOption('--context <path>', 'application.yml')
  .requiredOption('--policy <path>', 'risk-policy.yml')
  .option('--exceptions <path>', 'exceptions.yml')
  .option('--rules <path>', 'likelihood-impact-rules.yml')
  .option('--repository <name>', 'repository name override')
  .action((findingId: string, options: SharedOptions) => {
    try {
      const { assessments } = runAssessment(options);
      const assessment = assessments.find((a) => a.findingId === findingId);
      if (!assessment) {
        console.error(`No finding found with id "${findingId}"`);
        process.exitCode = 1;
        return;
      }
      console.log(renderExplain(assessment));
    } catch (err) {
      console.error(`risk-engine explain: ${(err as Error).message}`);
      process.exitCode = 1;
    }
  });

program.parse(process.argv);
