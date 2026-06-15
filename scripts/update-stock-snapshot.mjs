import { writeFile } from 'node:fs/promises'

const OUTPUT_PATH = new URL('../src/data/stocks-snapshot.json', import.meta.url)

const SYMBOLS = [
  'AAPL', 'AMGN', 'AMZN', 'AXP', 'BA', 'CAT', 'CRM', 'CSCO', 'CVX', 'DIS',
  'GS', 'HD', 'HON', 'IBM', 'JNJ', 'JPM', 'KO', 'MCD', 'MMM', 'MRK',
  'MSFT', 'NKE', 'NVDA', 'PG', 'SHW', 'TRV', 'UNH', 'V', 'VZ', 'WMT', 'SPY',
]

const toLabels = (dates) =>
  dates.map((dateText) => {
    const d = new Date(`${dateText}T00:00:00Z`)
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
  })

const toLabelsFromEpoch = (timestamps) =>
  timestamps.map((ts) => {
    const d = new Date(ts * 1000)
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
  })

const fetchYahooSeries = async (symbol) => {
  const endpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`
  const response = await fetch(endpoint)
  if (!response.ok) {
    throw new Error(`${symbol}: Yahoo HTTP ${response.status}`)
  }

  const json = await response.json()
  const result = json?.chart?.result?.[0]
  if (!result) {
    throw new Error(`${symbol}: Yahoo returned no chart result`)
  }

  const rawCloses = result.indicators?.quote?.[0]?.close ?? []
  const timestamps = result.timestamp ?? []

  const valid = rawCloses
    .map((price, index) => ({ price, ts: timestamps[index] }))
    .filter(({ price, ts }) => Number.isFinite(price) && Number.isFinite(ts))

  if (valid.length < 40) {
    throw new Error(`${symbol}: Yahoo returned insufficient data`)
  }

  const trimmed = valid.slice(-252)
  const prices = trimmed.map((item) => Number(item.price.toFixed(2)))
  const labels = toLabelsFromEpoch(trimmed.map((item) => item.ts))
  const currentPrice = Number((result.meta?.regularMarketPrice ?? prices[prices.length - 1]).toFixed(2))

  return { prices, labels, currentPrice }
}

const fetchStooqSeries = async (symbol) => {
  const stooqSymbol = symbol === 'SPY' ? 'spy.us' : `${symbol.toLowerCase()}.us`
  const endpoint = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`
  const response = await fetch(endpoint)
  if (!response.ok) {
    throw new Error(`${symbol}: Stooq HTTP ${response.status}`)
  }

  const csv = await response.text()
  const rows = csv.trim().split('\n').slice(1)

  const parsed = rows
    .map((row) => {
      const [date, , , , close] = row.split(',')
      const closeValue = Number.parseFloat(close)
      if (!date || !Number.isFinite(closeValue)) return null
      return { date, close: closeValue }
    })
    .filter(Boolean)

  if (parsed.length < 40) {
    throw new Error(`${symbol}: insufficient data returned from Stooq`)
  }

  const lastYear = parsed.slice(-252)
  return {
    prices: lastYear.map((item) => Number(item.close.toFixed(2))),
    labels: toLabels(lastYear.map((item) => item.date)),
    currentPrice: Number(lastYear[lastYear.length - 1].close.toFixed(2)),
  }
}

const fetchSeriesWithFallback = async (symbol) => {
  try {
    return await fetchYahooSeries(symbol)
  } catch {
    return fetchStooqSeries(symbol)
  }
}

const buildSnapshot = async () => {
  const symbolsData = {}

  for (const symbol of SYMBOLS) {
    process.stdout.write(`Fetching ${symbol}...\n`)
    const series = await fetchSeriesWithFallback(symbol)
    symbolsData[symbol] = series
  }

  return {
    generatedAt: new Date().toISOString(),
    provider: 'stooq-server-side-snapshot',
    symbols: symbolsData,
  }
}

const snapshot = await buildSnapshot()
await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
process.stdout.write(`Snapshot written to ${OUTPUT_PATH.pathname}\n`)
