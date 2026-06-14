# Stocks 101 Dashboard

Atlanta, USA

[![GitHub](https://img.shields.io/badge/--181717?logo=github&logoColor=ffffff)](https://github.com/)
[Cloud2BR OSS - Learning Hub](https://github.com/Cloud2BR-MSFTLearningHub)

Last updated: 2026-06-14

----------

Beginner-friendly React dashboard that starts empty and loads stock analytics on demand with one **Load Data** button.

## Features

- Placeholder-first UI: all cards and charts initially show `No data loaded yet`.
- Single-click load flow updates all visualizations simultaneously.
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
- Alpha Vantage public REST API (`demo` key)

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

```bash
npm run deploy
```
