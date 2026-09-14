#!/usr/bin/env node
'use strict';

const fs = require('fs');

const GITHUB_API = 'https://api.github.com';
const OUTPUT_PATH = process.env.CODEQL_ALERTS_OUTPUT || 'codeql-alerts.json';

async function githubRequest(path, token) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 404) return []; // no code scanning analysis found for this ref yet
  if (!res.ok) {
    throw new Error(`GitHub API ${path} -> ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/**
 * Fetches open CodeQL alerts for a PR's merge ref via the Code Scanning Alerts API.
 * This is how CodeQL findings reach the risk engine without requiring any change to
 * codeql.yml (see risk-engine/README.md and .github/workflows/risk-assessment.yml).
 */
async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not set');
  const prNumber = process.env.PR_NUMBER;
  if (!prNumber) throw new Error('PR_NUMBER is not set');

  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  const ref = `refs/pull/${prNumber}/merge`;

  const alerts = await githubRequest(
    `/repos/${owner}/${repo}/code-scanning/alerts?ref=${encodeURIComponent(ref)}&state=open&tool_name=CodeQL&per_page=100`,
    token,
  );

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(alerts, null, 2));
  console.log(`Wrote ${Array.isArray(alerts) ? alerts.length : 0} CodeQL alert(s) to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
