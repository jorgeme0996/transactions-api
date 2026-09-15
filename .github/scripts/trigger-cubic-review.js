#!/usr/bin/env node
'use strict';

// Asks cubic (the AI code reviewer GitHub App) for a plain-language pass over the
// finished 🔐 Security Risk Assessment comment, once the risk-assessment pipeline
// (CodeQL, dependency review, gitleaks, risk-engine) has completed for this commit.
//
// This deliberately does NOT send "@cubic-dev-ai review this PR" (a full re-review,
// which would pile inline comments on top of cubic's own automatic first pass on
// every push). Instead it asks a direct question, which cubic answers with a single
// reply -- see docs.cubic.dev/ai-review/quickstart. The standing instruction for how
// to answer (one consolidated comment, capped, plain language) lives in cubic.yaml.
//
// Only one "ask" comment is kept alive per PR: the previous one (for an older commit)
// is deleted before posting a new one, so a long-lived PR with many pushes doesn't
// accumulate a growing pile of these on top of cubic's own replies. The
// risk-assessment job only runs this script when has_findings == 'true', so a clean
// scan doesn't get an extra "nothing to report" comment either.

const GITHUB_API = 'https://api.github.com';
const RISK_COMMENT_MARKER = '<!-- risk-assessment-report -->'; // set by risk-assessment-report.js
const TRIGGER_COMMENT_MARKER = '<!-- cubic-human-review-trigger -->';

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

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not set');
  const prNumber = process.env.PR_NUMBER;
  const headSha = process.env.HEAD_SHA;
  if (!prNumber || !headSha) throw new Error('PR_NUMBER and HEAD_SHA must be set');
  const decision = process.env.RISK_DECISION || '<empty>';

  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

  const comments = await githubRequest(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, token);

  const previousTrigger = comments.find((c) => c.body?.includes(TRIGGER_COMMENT_MARKER));
  if (previousTrigger?.body.includes(headSha)) {
    console.log(`Already asked cubic to translate findings for ${headSha}, skipping.`);
    return;
  }
  if (previousTrigger) {
    // Only removes our own trigger comment, not cubic's reply -- that reply stays as
    // the historical record; we just avoid stacking a new "please translate" ask on
    // top of an older one every push.
    await githubRequest(`/repos/${owner}/${repo}/issues/comments/${previousTrigger.id}`, token, {
      method: 'DELETE',
    });
  }

  const riskComment = comments.find((c) => c.body?.includes(RISK_COMMENT_MARKER));
  const reportLink = riskComment ? riskComment.html_url : '(no se encontró el comentario de Security Risk Assessment)';

  const body = [
    TRIGGER_COMMENT_MARKER,
    `<!-- ${headSha} -->`,
    `@cubic-dev-ai los checks de seguridad y el [Security Risk Assessment](${reportLink}) ya terminaron para este commit (decisión: **${decision}**).`,
    '',
    '¿Puedes responder con **un solo comentario**, en lenguaje simple, que traduzca esos hallazgos para un developer? Para cada uno: 1-2 frases del riesgo real (qué podría salir mal en producción) + el cambio de código concreto para resolverlo. Máximo los 5 más importantes, ordenados por severidad, y sin repetir lo que ya señalaste en tu revisión del diff.',
  ].join('\n');

  await githubRequest(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
