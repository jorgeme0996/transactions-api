#!/usr/bin/env node
'use strict';

const fs = require('fs');

const GITHUB_API = 'https://api.github.com';
const EPSS_API = 'https://api.first.org/data/v1/epss';
const COMMENT_MARKER = '<!-- sca-epss-report -->';

const EPSS_RED_THRESHOLD = 0.5;
const CVSS_YELLOW_THRESHOLD = 7.0;

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

function readEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    throw new Error('GITHUB_EVENT_PATH no definido; este script debe correr en un evento pull_request.');
  }
  return JSON.parse(fs.readFileSync(eventPath, 'utf8'));
}

function severityFallbackScore(severity) {
  switch ((severity || '').toLowerCase()) {
    case 'critical':
      return 9.8;
    case 'high':
      return 8.9;
    case 'moderate':
      return 6.9;
    case 'low':
      return 3.9;
    default:
      return 0;
  }
}

function cvssFromAdvisory(advisory, fallbackSeverity) {
  const v3 = advisory?.cvss_severities?.cvss_v3?.score;
  const v4 = advisory?.cvss_severities?.cvss_v4?.score;
  if (typeof v3 === 'number' && v3 > 0) return v3;
  if (typeof v4 === 'number' && v4 > 0) return v4;
  return severityFallbackScore(fallbackSeverity);
}

function priorityFor(cvss, epss) {
  if (epss >= EPSS_RED_THRESHOLD) return { emoji: '🔴', label: 'Alta' };
  if (cvss >= CVSS_YELLOW_THRESHOLD) return { emoji: '🟡', label: 'Media' };
  return { emoji: '🟢', label: 'Baja' };
}

async function fetchEpssScores(cves) {
  const scores = new Map();
  const batchSize = 100;
  for (let i = 0; i < cves.length; i += batchSize) {
    const batch = cves.slice(i, i + batchSize);
    const url = `${EPSS_API}?cve=${batch.join(',')}`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const body = await res.json();
    for (const entry of body.data || []) {
      scores.set(entry.cve, parseFloat(entry.epss));
    }
  }
  return scores;
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

const SCA_FINDINGS_PATH = 'sca-findings.json';

function fixedVersionFor(advisory, packageName) {
  const entry = (advisory?.vulnerabilities || []).find((v) => v.package?.name === packageName);
  return entry?.first_patched_version?.identifier;
}

/**
 * Writes the interchange file risk-engine's scaJsonParser.ts consumes, so the risk
 * engine stays independent of dependency-review-action's own internal output format
 * (readme.md section 6). Always written, even when empty, so the artifact upload
 * step in dependency-review.yml never fails on a missing file.
 */
function writeScaFindings(rows) {
  fs.writeFileSync(SCA_FINDINGS_PATH, JSON.stringify(rows, null, 2));
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN no definido.');

  const event = readEvent();
  const pr = event.pull_request;
  if (!pr) {
    console.log('No es un evento de pull_request, se omite el reporte SCA.');
    writeScaFindings([]);
    return;
  }

  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  const basehead = `${pr.base.sha}...${pr.head.sha}`;

  const comparison = await githubRequest(
    `/repos/${owner}/${repo}/dependency-graph/compare/${basehead}`,
    token,
  );

  const findings = [];
  for (const dep of comparison) {
    if (dep.change_type !== 'added') continue;
    for (const vuln of dep.vulnerabilities || []) {
      findings.push({
        package: `${dep.name}@${dep.version}`,
        ghsa: vuln.advisory_ghsa_id,
        severity: vuln.severity,
        url: vuln.advisory_url,
      });
    }
  }

  if (findings.length === 0) {
    await upsertComment(
      owner,
      repo,
      pr.number,
      token,
      `${COMMENT_MARKER}\n✅ **SCA:** no se detectaron vulnerabilidades nuevas en las dependencias agregadas por este PR.`,
    );
    writeScaFindings([]);
    console.log('Sin hallazgos.');
    return;
  }

  const ghsaCache = new Map();
  for (const finding of findings) {
    if (ghsaCache.has(finding.ghsa)) continue;
    try {
      const advisory = await githubRequest(`/advisories/${finding.ghsa}`, token);
      ghsaCache.set(finding.ghsa, advisory);
    } catch (err) {
      console.warn(`No se pudo obtener el advisory ${finding.ghsa}: ${err.message}`);
      ghsaCache.set(finding.ghsa, null);
    }
  }

  const cveList = [
    ...new Set([...ghsaCache.values()].filter(Boolean).map((a) => a.cve_id).filter(Boolean)),
  ];
  const epssScores = cveList.length ? await fetchEpssScores(cveList) : new Map();

  const rows = findings.map((finding) => {
    const advisory = ghsaCache.get(finding.ghsa);
    const cve = advisory?.cve_id || finding.ghsa;
    const cvss = cvssFromAdvisory(advisory, finding.severity);
    const epss = epssScores.get(advisory?.cve_id) ?? 0;
    const priority = priorityFor(cvss, epss);
    const packageName = finding.package.split('@').slice(0, -1).join('@') || finding.package;
    return {
      cve,
      package: finding.package,
      cvss,
      epss,
      priority,
      url: finding.url,
      cwe_ids: advisory?.cwe_ids || [],
      fixed_version: fixedVersionFor(advisory, packageName),
    };
  });

  rows.sort((a, b) => b.epss - a.epss || b.cvss - a.cvss);
  writeScaFindings(rows);

  const tableRows = rows
    .map(
      (r) =>
        `| [${r.cve}](${r.url}) | ${r.package} | ${r.cvss.toFixed(1)} | ${r.epss.toFixed(2)} | ${r.priority.emoji} ${r.priority.label} |`,
    )
    .join('\n');

  const body = [
    COMMENT_MARKER,
    '### 🔎 Reporte SCA — CVSS + EPSS',
    '',
    '| Vulnerabilidad | Paquete | CVSS | EPSS | Prioridad |',
    '|---|---|---|---|---|',
    tableRows,
    '',
    `<sub>Prioridad: 🔴 EPSS ≥ ${EPSS_RED_THRESHOLD} (alta probabilidad de explotación en 30 días) · 🟡 CVSS ≥ ${CVSS_YELLOW_THRESHOLD} · 🟢 el resto. EPSS: <a href="https://www.first.org/epss/">FIRST.org</a>. CVSS/CVE: GitHub Advisory Database.</sub>`,
  ].join('\n');

  await upsertComment(owner, repo, pr.number, token, body);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
