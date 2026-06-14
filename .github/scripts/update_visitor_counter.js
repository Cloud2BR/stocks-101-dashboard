#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const BADGE_START = '<!-- START BADGE -->';
const BADGE_END = '<!-- END BADGE -->';
const BADGE_COLOR = 'limegreen';

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function listMarkdownFiles(repoRoot) {
  const output = execFileSync('git', ['-C', repoRoot, 'ls-files', '*.md'], {
    encoding: 'utf8',
  });

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((relativePath) => path.join(repoRoot, relativePath));
}

function buildBadgeBlock(totalViews, refreshDate) {
  return [
    BADGE_START,
    '<div align="center">',
    `  <img src="https://img.shields.io/badge/Total%20views-${totalViews}-${BADGE_COLOR}" alt="Total views">`,
    `  <p>Refresh Date: ${refreshDate}</p>`,
    '</div>',
    BADGE_END,
  ].join('\n');
}

function replaceBadgeBlock(text, totalViews, refreshDate) {
  const badgePattern = /<!-- START BADGE -->[\s\S]*?<!-- END BADGE -->/;
  if (!badgePattern.test(text)) {
    return { changed: false, updatedText: text };
  }

  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const replacement = buildBadgeBlock(totalViews, refreshDate).replace(/\n/g, newline);
  const updatedText = text.replace(badgePattern, replacement);
  return { changed: updatedText !== text, updatedText };
}

async function fetchTrafficViews(repo) {
  const token = getRequiredEnv('TRAFFIC_TOKEN');
  const response = await fetch(`https://api.github.com/repos/${repo}/traffic/views?per=day`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'org-repo-template-visitor-counter',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub traffic API request failed with ${response.status}: ${errorBody}`);
  }

  const payload = await response.json();
  if (typeof payload.count !== 'number' || typeof payload.uniques !== 'number' || !Array.isArray(payload.views)) {
    throw new Error('GitHub traffic API returned an unexpected response payload.');
  }

  return payload;
}

function writeMetricsFile(repoRoot, repo, refreshDate, trafficViews) {
  const metrics = {
    repository: repo,
    refresh_date: refreshDate,
    count: trafficViews.count,
    uniques: trafficViews.uniques,
    views: trafficViews.views,
  };

  const metricsPath = path.join(repoRoot, 'metrics.json');
  fs.writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');
}

function updateMarkdownBadges(repoRoot, totalViews, refreshDate) {
  const updatedFiles = [];
  const markdownFiles = listMarkdownFiles(repoRoot);

  for (const markdownFile of markdownFiles) {
    const originalText = fs.readFileSync(markdownFile, 'utf8');
    const { changed, updatedText } = replaceBadgeBlock(originalText, totalViews, refreshDate);
    if (!changed) {
      continue;
    }

    fs.writeFileSync(markdownFile, updatedText, 'utf8');
    updatedFiles.push(path.relative(repoRoot, markdownFile));
  }

  return updatedFiles;
}

async function main() {
  const repoRoot = process.cwd();
  const repo = getRequiredEnv('REPO');
  const refreshDate = new Date().toISOString().slice(0, 10);
  const trafficViews = await fetchTrafficViews(repo);

  writeMetricsFile(repoRoot, repo, refreshDate, trafficViews);
  const updatedFiles = updateMarkdownBadges(repoRoot, trafficViews.count, refreshDate);

  console.log(`Wrote metrics.json for ${repo}.`);
  if (updatedFiles.length === 0) {
    console.log('No Markdown badge blocks were updated.');
    return;
  }

  console.log('Updated visitor badge blocks in:');
  for (const relativePath of updatedFiles) {
    console.log(`- ${relativePath}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  buildBadgeBlock,
  replaceBadgeBlock,
};