#!/usr/bin/env node
'use strict';

const fs = require('fs');

const GITHUB_API = 'https://api.github.com';

// Must match the `name:` field of each workflow exactly (see workflow_run trigger
// in risk-assessment.yml). Dependency Review and Threat Model only run on
// pull_request, so a workflow_run event with no associated open PR (e.g. a push
// to main) must be treated as a no-op instead of waiting forever for a run that
// will never happen.
const REQUIRED_WORKFLOWS = ['CodeQL', 'Secret Scanning', 'Dependency Review', 'Threat Model'];

async function githubRequest(path, token) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${path} -> ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function readEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error('GITHUB_EVENT_PATH is not set');
  return JSON.parse(fs.readFileSync(eventPath, 'utf8'));
}

function writeOutputs(outputs) {
  const outputPath = process.env.GITHUB_OUTPUT;
  const lines = Object.entries(outputs)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  if (outputPath) {
    fs.appendFileSync(outputPath, `${lines}\n`);
  }
  console.log(lines);
}

async function findOpenPullRequestForSha(owner, repo, sha, token) {
  const pulls = await githubRequest(`/repos/${owner}/${repo}/commits/${sha}/pulls`, token);
  return pulls.find((pr) => pr.state === 'open' && pr.base.ref === 'main');
}

/** Picks the most recently created run for a given head_sha, per workflow name. */
function latestRunByName(runs, name) {
  return runs.filter((run) => run.name === name).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not set');
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

  const event = readEvent();
  const headSha = event.workflow_run?.head_sha || process.env.MANUAL_HEAD_SHA;
  if (!headSha) {
    console.log('No head_sha available (not a workflow_run event and no manual input); no-op.');
    writeOutputs({ proceed: 'false' });
    return;
  }

  const pr = await findOpenPullRequestForSha(owner, repo, headSha, token);
  if (!pr) {
    console.log(`No open PR against main found for ${headSha}; no-op (likely a push-to-main run).`);
    writeOutputs({ proceed: 'false' });
    return;
  }

  const { workflow_runs: runs } = await githubRequest(
    `/repos/${owner}/${repo}/actions/runs?head_sha=${headSha}&per_page=50`,
    token,
  );

  const latestRuns = REQUIRED_WORKFLOWS.map((name) => latestRunByName(runs, name));
  const missing = REQUIRED_WORKFLOWS.filter((_, i) => !latestRuns[i]);
  const incomplete = latestRuns.filter((run) => run && run.status !== 'completed');

  if (missing.length > 0 || incomplete.length > 0) {
    console.log(
      `Not all required workflows have completed yet for ${headSha} (missing: [${missing.join(', ')}], incomplete: ${incomplete.length}). A later workflow_run event will re-check.`,
    );
    writeOutputs({ proceed: 'false' });
    return;
  }

  const runIdFor = (name) => latestRuns[REQUIRED_WORKFLOWS.indexOf(name)].id;

  writeOutputs({
    proceed: 'true',
    pr_number: pr.number,
    head_sha: headSha,
    secret_scanning_run_id: runIdFor('Secret Scanning'),
    dependency_review_run_id: runIdFor('Dependency Review'),
    threat_model_run_id: runIdFor('Threat Model'),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
