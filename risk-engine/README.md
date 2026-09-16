# risk-engine

OWASP Risk Rating engine for the `transacciones-api` DevSecOps pipeline. It normalizes
findings from SAST (CodeQL), SCA (dependency graph), Secret Scanning (gitleaks), and the
Threat Model (Threagile), enriches them with this application's business context, computes a risk level using
the OWASP Risk Rating Methodology (Likelihood × Impact), and applies a configurable
policy to decide **PASS / WARN / BLOCK**.

Full specification: [`docs/risk-bases-pipeline/readme.md`](../docs/risk-bases-pipeline/readme.md).

The core principle: **a scanner's severity is not the organizational risk.** The same
CWE-89 (SQL Injection) is CRITICAL in a production, internet-facing, PCI-scoped
payments API, and much lower risk in an internal dev tool with no sensitive data.

## Architecture

```
Raw scanner output (CodeQL alerts API / gitleaks SARIF / sca-findings.json / threagile risks.json)
        │
        ▼
   parsers/*         -> Finding (scanner-agnostic, validated)
        │
        ▼
   context/           -> AssetContext (from config/application.yml)
        │
        ▼
   engine/riskEngine   -> Likelihood, Impact, OWASP Risk, Contextual Risk, Final Risk
        │                 (every factor traces back to a rule in
        │                  config/likelihood-impact-rules.yml -- no magic numbers)
        ▼
   policy/evaluate     -> PolicyDecision per finding (config/risk-policy.yml + exceptions.yml)
        │
        ▼
   output/*            -> PR comment (markdown), Check Run payload, JSON, CLI text
```

Design principles this follows (see `docs/risk-bases-pipeline/readme.md` section 21):
explainable, auditable, configurable, deterministic, reproducible, scanner-agnostic,
context-based. Every `derive*`/`calculate*` function returns `{ factors, explanations }`
instead of a bare number, and `RiskAssessment.explanation[]` is built by concatenating
those explanations -- it is never text written after the fact.

## Data model

- `Finding` (`src/domain/finding/Finding.ts`) -- scanner-agnostic normalized finding.
- `AssetContext` (`src/context/AssetContext.ts`) -- business/technical context of the app.
- `LikelihoodResult` / `ImpactResult` (`src/domain/likelihood`, `src/domain/impact`).
- `RiskAssessment` (`src/domain/risk/RiskAssessment.ts`) -- the full explainable result.
- `RiskPolicyConfig` / `PolicyDecision` / `RiskException` (`src/domain/policy`).

## Configuration

- `config/application.yml` -- business context for **transacciones-api** itself
  (production, internet-exposed, business-critical, PCI-DSS, financial/PII data).
- `config/risk-policy.yml` -- risk level -> action (BLOCK/WARN/ALLOW) mapping.
- `config/exceptions.yml` -- risk acceptance exceptions (never a bare `ignore: true`).
- `config/likelihood-impact-rules.yml` -- the CWE -> OWASP factor lookup table, threat
  agent / business impact derivation rules, and the contextual override thresholds.

## CLI

```bash
yarn build

node dist/cli.js analyze \
  --sast codeql-alerts.json \
  --sca sca-findings.json \
  --secrets gitleaks-results.sarif \
  --threat-model risks.json \
  --context config/application.yml \
  --policy config/risk-policy.yml \
  --format markdown

node dist/cli.js explain codeql-transacciones-api-1 \
  --sast codeql-alerts.json \
  --context config/application.yml \
  --policy config/risk-policy.yml
```

`analyze` exits `0` on PASS/WARN and `1` on BLOCK. `--findings <file>` also accepts a
plain JSON array of already-normalized findings (useful for fixtures/testing, and
matches the CLI shown in the original spec).

## Tests

```bash
yarn test
```

Covers: Likelihood/Impact LOW/MEDIUM/HIGH classification, all 9 OWASP matrix
combinations, policy actions and exceptions (valid/expired), 5 application archetypes
(public/internal/payment/admin/dev-tool), the 4 parsers (including a negative test that
a raw secret value never appears in engine output, and that Threagile risks already
resolved via `risk_tracking` -- `mitigated`/`accepted`/`false-positive` -- are filtered
out before reaching the engine), input validation (malformed YAML, malformed findings,
path traversal), and an integration test that replays the intentional findings from
commit `1458890` end-to-end and asserts the PR is BLOCKED.

## GitHub Actions integration

This package does not call the GitHub API itself (kept testable without mocking
network calls). The glue lives in `.github/workflows/risk-assessment.yml` and
`.github/scripts/`, which fetch each scanner's output, run this CLI, and publish the
PR comment / Check Run / exit code.
