# Stock Dashboards 101

Atlanta, USA

[![GitHub](https://img.shields.io/badge/--181717?logo=github&logoColor=ffffff)](https://github.com/)
[Cloud2BR OSS - Learning Hub](https://github.com/Cloud2BR-MSFTLearningHub)

Last updated: 2026-06-14

----------

Beginner-friendly React dashboard that starts empty and loads stock analytics on demand with one **Load Data** button.

## Features

- Placeholder-first UI: all cards and charts initially show `No data loaded yet`.
- Single-click load flow updates all visualizations simultaneously.
- Dashboard reads same-origin stock snapshot data (`src/data/stocks-snapshot.json`) generated server-side.
- Technical indicators include plain-language descriptions and source links:
	- Volatility (how much the price fluctuates)
	- Beta (sensitivity to the overall market)
	- Max Drawdown (largest loss in a period)
- Beginner visuals:
	- Stock summary cards (name, current price, risk level, potential gain)
	- Bar chart comparing risk vs. potential return
	- Traffic-light signal (green / yellow / red)

## Stack

- React + Vite
- Material UI
- Chart.js + react-chartjs-2
- Server-side stock snapshot generator (`scripts/update-stock-snapshot.mjs`)
- Daily GitHub Actions snapshot refresh (`.github/workflows/update-stock-snapshot.yml`)

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## GitHub Pages Deployment

Pages base path is set for this repository (`/stocks-101-dashboard/`).

GitHub Pages is deployed by the workflow at [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml).

1. Open the repository settings on GitHub.
2. Set Pages source to `GitHub Actions`.
3. Push to `main` or run the workflow manually.
4. The workflow builds `dist/` and publishes the site from the latest successful run.

## Data Refresh Pipeline

- Trigger manually from the `Update Stock Snapshot` workflow.
- Scheduled on weekdays to refresh `src/data/stocks-snapshot.json`.
- The app uses this same-origin snapshot at runtime, so the browser does not call third-party APIs directly.

```bash
npm run build
```

<!-- START BADGE -->
<div align="center">
	<img src="https://img.shields.io/badge/Total%20views-40-limegreen" alt="Total views">
	<p>Refresh Date: 2026-04-07</p>
</div>
<!-- END BADGE -->
