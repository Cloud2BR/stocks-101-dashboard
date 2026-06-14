# org-repo-template

Atlanta, USA

[![GitHub](https://img.shields.io/badge/--181717?logo=github&logoColor=ffffff)](https://github.com/)
[Cloud2BR OSS - Learning Hub](https://github.com/Cloud2BR-MSFTLearningHub)

Last updated: 2026-04-07

----------

> Organizational repo ([Cloud2BR Open Source Microsoft Cloud Sandbox - Learning Hub](https://github.com/Cloud2BR-MSFTLearningHub)) template with automated pipelines (update date, update counter, notebook/markdown review, formatting checks, etc). Includes a general README structure with preferred header and counter badge. Ensures consistency, automation, and best practices across all org projects.

## Workflow Summary

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `.github/workflows/validate_and_fix_markdown.yml` | Pull requests to `main` | Runs `markdownlint`, auto-fixes Markdown style issues when possible, validates the required header block for every tracked Markdown file, and pushes any fixes back to the PR branch. |
| `.github/workflows/update-md-date.yml` | Pull requests to `main` | Looks at the full PR diff, updates the `Last updated:` line inside the standard Markdown header block for changed Markdown files, and pushes the result back to the PR branch. |
| `.github/workflows/validate_and_fix_notebook.yml` | Pull requests to `main` | Validates Jupyter notebooks, normalizes widget metadata when needed, and commits notebook-format fixes back to the PR branch. |
| `.github/workflows/use-visitor-counter.yml` | Pull requests to `main` and manual runs | Runs the vendored visitor-counter script stored in this repo to refresh Markdown counter badges and `metrics.json`, then commits the updated repository traffic data. |

## Required Markdown Header

> Within this org, every tracked Markdown file must include the following block immediately below the main `# Title` line. The location line can vary, but it must exist. The GitHub badge line, the `Cloud2BR OSS - Learning Hub` org link line, the date format, and the separator are org-wide standard and must match this structure exactly. The `Validate and Fix Markdown` workflow checks every tracked `.md` file against this header pattern on pull requests.

```md
# Document Title

City, Country

[![GitHub](https://img.shields.io/badge/--181717?logo=github&logoColor=ffffff)](https://github.com/)
[Cloud2BR OSS - Learning Hub](https://github.com/Cloud2BR-MSFTLearningHub)

Last updated: YYYY-MM-DD

----------
```

<!-- START BADGE -->
<div align="center">
  <img src="https://img.shields.io/badge/Total%20views-40-limegreen" alt="Total views">
  <p>Refresh Date: 2026-04-07</p>
</div>
<!-- END BADGE -->
