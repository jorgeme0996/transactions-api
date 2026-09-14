#!/usr/bin/env node
'use strict';

const fs = require('fs');

const GITHUB_API = 'https://api.github.com';
const COMMENT_MARKER = '<!-- risk-assessment-report -->'; // distinct from sca-epss-report.js's own marker

async function githubRequest(path, token, options = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${path} -> ${res.status}: ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

async function upsertComment(owner, repo, prNumber, token, body) {
  const comments = await githubRequest(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, token);
  const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER));
  if (existing) {
    await githubRequest(`/repos/${owner}/${repo}/issues/comments/${existing.id}`, token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
  } else {
    await githubRequest(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
  }
}

/** Mirrors risk-engine/src/output/checkRun.ts#buildCheckRunPayload (kept in sync manually; see that file). */
function checkRunPayload(result) {
  const conclusion = result.final_decision === 'BLOCK' ? 'failure' : result.final_decision === 'WARN' ? 'neutral' : 'success';
  const title =
    result.final_decision === 'BLOCK'
      ? 'Blocked by risk-based security gate'
      : result.final_decision === 'WARN'
        ? 'Passed with warnings'
        : 'Passed';
  const s = result.summary;
  return {
    name: 'Security Risk Gate',
    conclusion,
    title,
    summary: `Critical: ${s.CRITICAL} | High: ${s.HIGH} | Medium: ${s.MEDIUM} | Low: ${s.LOW} | Note: ${s.NOTE}`,
  };
}

async function upsertCheckRun(owner, repo, headSha, token, payload) {
  await githubRequest(`/repos/${owner}/${repo}/check-runs`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      head_sha: headSha,
      status: 'completed',
      conclusion: payload.conclusion,
      output: { title: payload.title, summary: payload.summary },
    }),
  });
}

function writeOutputs(outputs) {
  const outputPath = process.env.GITHUB_OUTPUT;
  const lines = Object.entries(outputs)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  if (outputPath) fs.appendFileSync(outputPath, `${lines}\n`);
  console.log(lines);
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not set');
  const prNumber = process.env.PR_NUMBER;
  const headSha = process.env.HEAD_SHA;
  if (!prNumber || !headSha) throw new Error('PR_NUMBER and HEAD_SHA must be set');

  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

  const commentPath = process.env.RISK_COMMENT_PATH || 'risk-comment.md';
  const resultPath = process.env.RISK_RESULT_PATH || 'risk-result.json';

  const comment = fs.readFileSync(commentPath, 'utf8');
  const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));

  await upsertComment(owner, repo, prNumber, token, comment);
  await upsertCheckRun(owner, repo, headSha, token, checkRunPayload(result));

  writeOutputs({ decision: result.final_decision });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
