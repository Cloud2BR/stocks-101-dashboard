import { useMemo, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import LocalAtmIcon from '@mui/icons-material/LocalAtm'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import SsidChartIcon from '@mui/icons-material/SsidChart'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip as ChartTooltip,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import './App.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Legend,
  ChartTooltip,
)

const DEFAULT_STOCK_SYMBOL = 'IBM'
const MARKET_SYMBOL = 'SPY'
const OWNER_AVATAR = 'https://github.com/brown9804.png'
const ORG_AVATAR = 'https://github.com/Cloud2BR.png'
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 12

// Investment planner risk profiles
const RISK_PROFILES = {
  Conservative: { stopLoss: -0.05, maxExpectedReturn: 0.12, label: 'Conservative (−5% stop-loss)' },
  Moderate:     { stopLoss: -0.10, maxExpectedReturn: 0.25, label: 'Moderate (−10% stop-loss)' },
  Aggressive:   { stopLoss: -0.20, maxExpectedReturn: 0.60, label: 'Aggressive (−20% stop-loss)' },
}

// Which stock risk levels are compatible with each investor risk tolerance
const STOCK_RISK_FIT = {
  Conservative: ['Low'],
  Moderate:     ['Low', 'Medium'],
  Aggressive:   ['Low', 'Medium', 'High'],
}

const COMMON_STOCK_OPTIONS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. Class A' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'IBM', name: 'International Business Machines Corporation' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
  { symbol: 'NFLX', name: 'Netflix Inc.' },
]

const INDICATOR_META = [
  {
    key: 'volatility',
    title: 'Volatility',
    description: 'how much the price fluctuates',
    link: 'https://www.investopedia.com/terms/v/volatility.asp',
  },
  {
    key: 'beta',
    title: 'Beta',
    description: 'sensitivity to the overall market',
    link: 'https://www.investopedia.com/terms/b/beta.asp',
  },
  {
    key: 'maxDrawdown',
    title: 'Max Drawdown',
    description: 'largest loss in a period',
    link: 'https://www.investopedia.com/terms/m/maximum-drawdown-mdd.asp',
  },
]

const formatLabelsFromTimestamps = (timestamps) =>
  timestamps.map((ts) => {
    const d = new Date(ts * 1000)
    return `${d.getMonth() + 1}/${d.getDate()}`
  })

const fetchYahooFinanceSeries = async (symbol) => {
  const endpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`
  const response = await fetch(endpoint)
  if (!response.ok) throw new Error(`Yahoo Finance HTTP ${response.status}`)

  const json = await response.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error('No chart result from Yahoo Finance')

  const rawCloses = result.indicators?.quote?.[0]?.close ?? []
  const timestamps = result.timestamp ?? []

  const valid = rawCloses
    .map((price, i) => ({ price, ts: timestamps[i] }))
    .filter(({ price, ts }) => price !== null && price !== undefined && Number.isFinite(price) && ts)

  if (valid.length < 30) throw new Error('Yahoo Finance returned insufficient data')

  const prices = valid.map(({ price }) => Number(price.toFixed(2)))
  const labels = formatLabelsFromTimestamps(valid.map(({ ts }) => ts))
  const currentPrice = result.meta?.regularMarketPrice ?? prices.at(-1)

  return {
    prices,
    labels,
    currentPrice: Number(Number(currentPrice).toFixed(2)),
    source: 'yahoo',
  }
}

const fetchStooqSeries = async (symbol) => {
  const stooqSymbol = symbol === 'SPY' ? 'spy.us' : `${symbol.toLowerCase()}.us`
  const endpoint = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`
  const response = await fetch(endpoint)
  if (!response.ok) throw new Error(`Stooq HTTP ${response.status}`)

  const csv = await response.text()
  const rows = csv.trim().split('\n').slice(1)
  const parsed = rows
    .map((row) => {
      const [date, open, high, low, close] = row.split(',')
      const closeValue = Number.parseFloat(close)
      if (!date || !Number.isFinite(closeValue)) return null
      return { date, close: closeValue, open, high, low }
    })
    .filter(Boolean)

  if (parsed.length < 30) throw new Error('Stooq returned insufficient data')

  const lastYear = parsed.slice(-252)
  const prices = lastYear.map((item) => Number(item.close.toFixed(2)))
  const labels = lastYear.map((item) => {
    const d = new Date(`${item.date}T00:00:00`)
    return `${d.getMonth() + 1}/${d.getDate()}`
  })

  return {
    prices,
    labels,
    currentPrice: Number(prices.at(-1).toFixed(2)),
    source: 'stooq',
  }
}

const fetchRealSeriesWithBackup = async (symbol) => {
  try {
    return await fetchYahooFinanceSeries(symbol)
  } catch {
    return fetchStooqSeries(symbol)
  }
}

const readCachedPrices = (cacheKey) => {
  try {
    const serialized = localStorage.getItem(cacheKey)
    if (!serialized) return null

    const parsed = JSON.parse(serialized)
    if (!Array.isArray(parsed?.prices) || !parsed?.savedAt) return null
    if (Date.now() - parsed.savedAt > CACHE_MAX_AGE_MS) return null

    return parsed.prices
  } catch {
    return null
  }
}

const writeCachedPrices = (cacheKey, prices) => {
  try {
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        prices,
        savedAt: Date.now(),
      }),
    )
  } catch {
    // Ignore storage write failures.
  }
}

const dailyReturns = (prices) =>
  prices
    .slice(1)
    .map((price, index) => (prices[index] > 0 ? price / prices[index] - 1 : 0))
    .filter((value) => Number.isFinite(value))

const average = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0

const standardDeviation = (values) => {
  if (!values.length) return 0

  const mean = average(values)
  const variance =
    values.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) /
    values.length

  return Math.sqrt(variance)
}

const calculateVolatility = (returns) => standardDeviation(returns) * Math.sqrt(252)

const calculateBeta = (assetReturns, marketReturns) => {
  const samples = Math.min(assetReturns.length, marketReturns.length)
  if (!samples) return 0

  const stock = assetReturns.slice(-samples)
  const market = marketReturns.slice(-samples)
  const stockMean = average(stock)
  const marketMean = average(market)

  let covariance = 0
  let marketVariance = 0

  for (let index = 0; index < samples; index += 1) {
    const stockDelta = stock[index] - stockMean
    const marketDelta = market[index] - marketMean
    covariance += stockDelta * marketDelta
    marketVariance += marketDelta * marketDelta
  }

  if (!marketVariance) return 0
  return covariance / marketVariance
}

const calculateMaxDrawdown = (prices) => {
  if (!prices.length) return 0

  let peak = prices[0]
  let maxDrawdown = 0

  for (const price of prices) {
    peak = Math.max(peak, price)
    const drawdown = peak ? (price - peak) / peak : 0
    maxDrawdown = Math.min(maxDrawdown, drawdown)
  }

  return maxDrawdown
}

const classifyRisk = (riskScore) => {
  if (riskScore < 25) return 'Low'
  if (riskScore < 45) return 'Medium'
  return 'High'
}

const trafficSignal = (riskLevel, potentialGain) => {
  if (riskLevel === 'Low' && potentialGain >= 10) return 'green'
  if (riskLevel === 'High' || potentialGain < 5) return 'red'
  return 'yellow'
}

function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dashboard, setDashboard] = useState(null)
  const [priceHistory, setPriceHistory] = useState(null)   // { prices, labels }
  const [dataSource, setDataSource]     = useState(null)   // 'yahoo' | 'stooq'
  const [stockOptions] = useState(COMMON_STOCK_OPTIONS)
  const [symbolInput, setSymbolInput] = useState(DEFAULT_STOCK_SYMBOL)

  // Investment planner state
  const [investAmount,   setInvestAmount]   = useState('1000')
  const [riskTolerance,  setRiskTolerance]  = useState('Moderate')
  const [targetReturn,   setTargetReturn]   = useState('10')
  const [planResult,     setPlanResult]     = useState(null)
  const [planError,      setPlanError]      = useState('')

  const loadData = async () => {
    setLoading(true)
    setError('')
    setPlanResult(null)

    try {
      const symbolToLoad = symbolInput.trim().toUpperCase()
      if (!symbolToLoad) throw new Error('Please select or type a stock symbol.')

      const stockCacheKey  = `stocks-101:${symbolToLoad}`
      const marketCacheKey = `stocks-101:${MARKET_SYMBOL}`

      // ── Stock prices (real providers only) ──────────────────────────────
      let stockPrices   = readCachedPrices(stockCacheKey)
      let historyLabels = null
      let stockSource = 'cache'
      let currentPriceFromFeed = null

      if (!stockPrices) {
        const liveData = await fetchRealSeriesWithBackup(symbolToLoad)
        stockPrices = liveData.prices
        historyLabels = liveData.labels
        stockSource = liveData.source
        currentPriceFromFeed = liveData.currentPrice
        writeCachedPrices(stockCacheKey, stockPrices)
      } else {
        historyLabels = stockPrices.map((_, i) => `Day ${i + 1}`)
      }

      // ── Market benchmark (real provider, same fallback chain) ───────────
      let marketPrices = readCachedPrices(marketCacheKey)
      if (!marketPrices) {
        const marketData = await fetchRealSeriesWithBackup(MARKET_SYMBOL)
        marketPrices = marketData.prices
        writeCachedPrices(marketCacheKey, marketPrices)
      }

      const currentPrice = currentPriceFromFeed ?? stockPrices.at(-1)
      if (!Number.isFinite(currentPrice) || stockPrices.length < 30 || marketPrices.length < 30) {
        throw new Error('Not enough price history to compute indicators.')
      }

      const stockReturns  = dailyReturns(stockPrices)
      const marketReturns = dailyReturns(marketPrices)
      const volatility    = calculateVolatility(stockReturns)
      const beta          = calculateBeta(stockReturns, marketReturns)
      const maxDrawdown   = calculateMaxDrawdown(stockPrices)
      const recentPrices  = stockPrices.slice(-252)
      const recentHigh    = Math.max(...recentPrices)
      const potentialGain = recentHigh > 0
        ? Math.max(0, ((recentHigh - currentPrice) / currentPrice) * 100)
        : 0

      const riskScore =
        volatility * 100 * 0.45 +
        Math.abs(beta - 1) * 20 * 0.2 +
        Math.abs(maxDrawdown) * 100 * 0.35

      const riskLevel = classifyRisk(riskScore)
      const signal    = trafficSignal(riskLevel, potentialGain)
      const matchedStock = stockOptions.find((item) => item.symbol === symbolToLoad)

      // Keep last 252 data points for the history chart
      const histSlice  = stockPrices.slice(-252)
      const labelSlice = historyLabels.slice(-252)

      setDataSource(stockSource === 'cache' ? 'yahoo' : stockSource)
      setPriceHistory({ prices: histSlice, labels: labelSlice })
      setDashboard({
        stockName: matchedStock?.name || symbolToLoad,
        symbol: symbolToLoad,
        currentPrice,
        riskLevel,
        potentialGain,
        riskScore,
        signal,
        indicators: { volatility, beta, maxDrawdown },
      })
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? `${caughtError.message}. Real-time providers may be blocking browser requests right now.`
          : 'Failed to load stock data from live providers.',
      )
    } finally {
      setLoading(false)
    }
  }

  // ── Investment planner ──────────────────────────────────────────────────
  const analyzePlan = () => {
    setPlanError('')
    if (!dashboard) { setPlanError('Load a stock first.'); return }

    const amount    = parseFloat(investAmount)
    const goalPct   = parseFloat(targetReturn)
    if (!isFinite(amount) || amount <= 0) { setPlanError('Enter a valid investment amount.'); return }
    if (!isFinite(goalPct) || goalPct <= 0) { setPlanError('Enter a valid target return (%).'); return }

    const { currentPrice, riskLevel, indicators } = dashboard
    if (currentPrice <= 0) { setPlanError('Current price is unavailable.'); return }

    const profile       = RISK_PROFILES[riskTolerance]
    const stopLossPct   = profile.stopLoss           // negative, e.g. -0.10
    const shares        = Math.floor(amount / currentPrice)
    const totalCost     = shares * currentPrice
    const leftover      = amount - totalCost
    const targetPrice   = currentPrice * (1 + goalPct / 100)
    const stopPrice     = currentPrice * (1 + stopLossPct)
    const maxGain       = shares * (targetPrice - currentPrice)
    const maxLoss       = shares * Math.abs(stopLossPct) * currentPrice
    const riskReward    = maxLoss > 0 ? maxGain / maxLoss : null
    const stockFit      = STOCK_RISK_FIT[riskTolerance]?.includes(riskLevel) ?? false

    // Rough "probability" heuristic using annualised volatility vs target
    const annVol = indicators.volatility
    const dailyVol = annVol > 0 ? annVol / Math.sqrt(252) : 0.01
    // Z-score: how many std-devs away is the daily return needed
    const dailyRetNeeded = goalPct / 100 / 252
    const z = dailyVol > 0 ? dailyRetNeeded / dailyVol : 0
    // Rough probability using logistic approximation
    const rawProb = 1 / (1 + Math.exp(z * 2.5))
    const probPct = Math.round(Math.min(90, Math.max(10, rawProb * 100)))

    setPlanResult({
      shares, totalCost, leftover,
      targetPrice, stopPrice,
      maxGain, maxLoss, riskReward,
      stockFit, probPct,
    })
  }

  // ── Chart data ──────────────────────────────────────────────────────────
  const barChartData = useMemo(() => {
    if (!dashboard) return null
    return {
      labels: ['Risk Score', 'Potential Return (%)'],
      datasets: [{
        label: `${dashboard.symbol} Snapshot`,
        data: [dashboard.riskScore, dashboard.potentialGain],
        backgroundColor: ['#b7410e', '#2f7a3f'],
        borderRadius: 8,
      }],
    }
  }, [dashboard])

  const lineChartData = useMemo(() => {
    if (!priceHistory) return null
    return {
      labels: priceHistory.labels,
      datasets: [{
        label: `${dashboard?.symbol ?? ''} Close Price`,
        data: priceHistory.prices,
        borderColor: '#1565c0',
        backgroundColor: 'rgba(21, 101, 192, 0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      }],
    }
  }, [priceHistory, dashboard])

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `$${Number(ctx.raw).toFixed(2)}`,
        },
      },
    },
    scales: {
      x: { ticks: { maxTicksLimit: 8, maxRotation: 0 } },
      y: {
        ticks: { callback: (v) => `$${v}` },
      },
    },
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${Number(context.raw).toFixed(2)}`,
        },
      },
    },
    scales: { y: { beginAtZero: true } },
  }

  const signalLabel = { green: 'Attractive', yellow: 'Neutral', red: 'Risky' }

  return (
    <Box className="dashboard-shell">
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Stack spacing={3}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            gap={2}
            className="dashboard-header"
          >
            <Box>
              <Typography variant="h3" className="dashboard-title">
                Stock Dashboards 101
              </Typography>
              <Typography variant="body1" className="dashboard-subtitle">
                Beginner-friendly view of risk, return, and market behavior for any stock symbol.
              </Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="stretch">
              <Autocomplete
                freeSolo
                disableClearable
                options={stockOptions}
                sx={{ minWidth: { xs: '100%', sm: 360 } }}
                getOptionLabel={(option) =>
                  typeof option === 'string' ? option : `${option.symbol} - ${option.name}`
                }
                inputValue={symbolInput}
                onInputChange={(_, newInputValue) => {
                  setSymbolInput(newInputValue.toUpperCase())
                }}
                onChange={(_, newValue) => {
                  if (typeof newValue === 'string') {
                    setSymbolInput(newValue.toUpperCase())
                    return
                  }
                  if (newValue?.symbol) {
                    setSymbolInput(newValue.symbol.toUpperCase())
                  }
                }}
                renderInput={(params) => {
                  const safeInputProps = { ...params.inputProps }
                  delete safeInputProps.autoCapitalize
                  delete safeInputProps.autocapitalize

                  const safeInnerInputProps = { ...(params.InputProps?.inputProps ?? {}) }
                  delete safeInnerInputProps.autoCapitalize
                  delete safeInnerInputProps.autocapitalize

                  const safeInputWrapperProps = {
                    ...params.InputProps,
                    inputProps: safeInnerInputProps,
                  }

                  return (
                    <TextField
                      {...params}
                      InputProps={safeInputWrapperProps}
                      inputProps={safeInputProps}
                      label="Stock symbol"
                      placeholder="Type any symbol (AAPL, MSFT, TSLA...)"
                      size="small"
                    />
                  )
                }}
              />

              <Stack spacing={0.5}>
                <Button
                  size="large"
                  variant="contained"
                  onClick={loadData}
                  disabled={loading}
                  className="load-button"
                  startIcon={loading ? <CircularProgress color="inherit" size={18} /> : <TrendingUpIcon />}
                >
                  {loading ? 'Loading...' : 'Load Data'}
                </Button>
                {dataSource && (
                  <Chip
                    size="small"
                    label={dataSource === 'yahoo' ? '● Yahoo Finance' : '● Stooq Backup'}
                    className={`source-chip source-chip--${dataSource}`}
                  />
                )}
                <Link
                  href={`https://www.marketwatch.com/investing/stock/${symbolInput.trim().toLowerCase()}`}
                  target="_blank"
                  rel="noreferrer"
                  className="source-link"
                >
                  View on MarketWatch
                </Link>
              </Stack>
            </Stack>
          </Stack>

          {error ? <Alert severity="error">{error}</Alert> : null}

          <Grid container spacing={2}>
            {[
              {
                title: 'Stock Name',
                icon: <ShowChartIcon fontSize="small" />,
                value: dashboard ? `${dashboard.stockName} (${dashboard.symbol})` : 'No data loaded yet',
              },
              {
                title: 'Current Price',
                icon: <LocalAtmIcon fontSize="small" />,
                value: dashboard ? `$${dashboard.currentPrice.toFixed(2)}` : 'No data loaded yet',
              },
              {
                title: 'Risk Level',
                icon: <WarningAmberIcon fontSize="small" />,
                value: dashboard ? dashboard.riskLevel : 'No data loaded yet',
              },
              {
                title: 'Potential Gain',
                icon: <TrendingUpIcon fontSize="small" />,
                value: dashboard ? `${dashboard.potentialGain.toFixed(2)}%` : 'No data loaded yet',
              },
            ].map((item) => (
              <Grid key={item.title} size={{ xs: 12, sm: 6, md: 3 }}>
                <Card className="dashboard-card">
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      {item.icon}
                      <Typography variant="subtitle2">{item.title}</Typography>
                      <Tooltip title="Uses real quote history from Yahoo Finance, with Stooq as backup if Yahoo fails.">
                        <InfoOutlinedIcon fontSize="inherit" className="hint-icon" />
                      </Tooltip>
                    </Stack>
                    <Typography variant="h6">{item.value}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Card className="dashboard-card chart-card">
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Risk vs. Potential Return
                  </Typography>
                  <Box className="chart-host">
                    {barChartData ? (
                      <Bar data={barChartData} options={chartOptions} />
                    ) : (
                      <Typography className="placeholder">No data loaded yet</Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <Card className="dashboard-card traffic-card">
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Traffic-Light Signal
                  </Typography>

                  <Stack direction="row" gap={2} sx={{ mb: 1.5 }}>
                    {['green', 'yellow', 'red'].map((light) => (
                      <Box
                        key={light}
                        className={`traffic-dot ${light} ${dashboard?.signal === light ? 'active' : ''}`}
                      />
                    ))}
                  </Stack>

                  <Typography variant="body1">
                    {dashboard ? signalLabel[dashboard.signal] : 'No data loaded yet'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card className="dashboard-card">
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <SsidChartIcon sx={{ color: '#1565c0' }} />
                <Typography variant="h6">Price History (1 Year)</Typography>
                {dataSource && (
                  <Chip
                    label={dataSource === 'yahoo' ? 'Yahoo Finance feed' : 'Stooq feed'}
                    size="small"
                    variant="outlined"
                    sx={{ ml: 'auto', color: '#1565c0', borderColor: '#1565c0' }}
                  />
                )}
              </Stack>
              <Box className="chart-host chart-host--tall">
                {lineChartData ? (
                  <Line data={lineChartData} options={lineChartOptions} />
                ) : (
                  <Typography className="placeholder">Load a stock symbol to see price history</Typography>
                )}
              </Box>
            </CardContent>
          </Card>

          <Card className="dashboard-card">
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Technical Indicators
              </Typography>

              <Stack spacing={1.25}>
                {INDICATOR_META.map((indicator) => (
                  <Box key={indicator.key} className="indicator-row">
                    <Typography variant="body1">
                      <strong>
                        {indicator.title} ({indicator.description})
                      </strong>
                      {': '}
                      {dashboard
                        ? indicator.key === 'volatility'
                          ? `${(dashboard.indicators.volatility * 100).toFixed(2)}% annualized`
                          : indicator.key === 'beta'
                            ? dashboard.indicators.beta.toFixed(2)
                            : `${(dashboard.indicators.maxDrawdown * 100).toFixed(2)}%`
                        : 'No data loaded yet'}
                    </Typography>

                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Link href={indicator.link} target="_blank" rel="noreferrer">
                        Learn more
                      </Link>
                      <Chip label="Investopedia" size="small" variant="outlined" />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>

          {/* ── Investment Planner ────────────────────────────────────────── */}
          <Card className="dashboard-card">
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <AccountBalanceWalletIcon sx={{ color: '#1565c0' }} />
                <Typography variant="h6">Investment Planner</Typography>
                <Tooltip title="Enter your budget, risk comfort, and return goal. Click Analyze to see how this stock fits your plan.">
                  <InfoOutlinedIcon fontSize="inherit" className="hint-icon" />
                </Tooltip>
              </Stack>
              <Typography variant="body2" sx={{ color: '#556070', mb: 2 }}>
                Model how a position in the loaded stock would perform relative to your goals. Data
                is for educational purposes only — not financial advice.
              </Typography>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Investment amount"
                    type="number"
                    size="small"
                    fullWidth
                    value={investAmount}
                    onChange={(e) => setInvestAmount(e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                    inputProps={{ min: 1, step: 100 }}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Risk tolerance</InputLabel>
                    <Select
                      value={riskTolerance}
                      label="Risk tolerance"
                      onChange={(e) => setRiskTolerance(e.target.value)}
                    >
                      {Object.keys(RISK_PROFILES).map((key) => (
                        <MenuItem key={key} value={key}>{RISK_PROFILES[key].label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Target return"
                    type="number"
                    size="small"
                    fullWidth
                    value={targetReturn}
                    onChange={(e) => setTargetReturn(e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                    inputProps={{ min: 0.1, step: 1 }}
                  />
                </Grid>
              </Grid>

              <Button
                variant="contained"
                onClick={analyzePlan}
                disabled={!dashboard}
                className="analyze-button"
                startIcon={<TrendingUpIcon />}
              >
                Analyze Investment
              </Button>

              {planError && <Alert severity="warning" sx={{ mt: 2 }}>{planError}</Alert>}

              {planResult && (
                <Box sx={{ mt: 3 }}>
                  <Divider sx={{ mb: 2 }} />

                  {/* Fit verdict banner */}
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    className={`plan-verdict plan-verdict--${planResult.stockFit ? 'good' : 'warn'}`}
                    sx={{ mb: 2, p: 1.5, borderRadius: 2 }}
                  >
                    {planResult.stockFit
                      ? <CheckCircleIcon sx={{ color: '#2e7d32' }} />
                      : <CancelIcon sx={{ color: '#c62828' }} />}
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {planResult.stockFit
                        ? `${dashboard.symbol} is a good fit for your ${riskTolerance} profile.`
                        : `${dashboard.symbol} risk level (${dashboard.riskLevel}) may be too high for a ${riskTolerance} profile.`}
                    </Typography>
                  </Stack>

                  <Grid container spacing={2}>
                    {[
                      { label: 'Shares you can buy',  value: planResult.shares.toLocaleString() },
                      { label: 'Capital deployed',    value: `$${planResult.totalCost.toFixed(2)}` },
                      { label: 'Leftover cash',       value: `$${planResult.leftover.toFixed(2)}` },
                      { label: 'Target sell price',   value: `$${planResult.targetPrice.toFixed(2)}` },
                      { label: 'Stop-loss price',     value: `$${planResult.stopPrice.toFixed(2)}` },
                      { label: 'Max potential gain',  value: `$${planResult.maxGain.toFixed(2)}` },
                      { label: 'Max potential loss',  value: `$${planResult.maxLoss.toFixed(2)}` },
                      {
                        label: 'Risk / Reward ratio',
                        value: planResult.riskReward != null
                          ? `${planResult.riskReward.toFixed(2)}:1`
                          : 'N/A',
                      },
                      { label: 'Est. probability of hitting goal', value: `~${planResult.probPct}%` },
                    ].map(({ label, value }) => (
                      <Grid key={label} size={{ xs: 6, sm: 4, md: 3 }}>
                        <Box className="plan-metric">
                          <Typography variant="caption" className="plan-metric__label">{label}</Typography>
                          <Typography variant="h6" className="plan-metric__value">{value}</Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </CardContent>
          </Card>

          <Card className="dashboard-card identity-shell">
            <CardContent>
              <Typography variant="overline" className="identity-label">
                Project Identity
              </Typography>
              <Typography variant="h4" className="identity-title">
                Owner / Founder
              </Typography>
              <Typography variant="body1" className="identity-description">
                Stock Dashboards 101 is maintained by Timna Brown and published through the
                Cloud2BR organization.
              </Typography>

              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card className="dashboard-card identity-card">
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2 }}>
                        Owner
                      </Typography>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box
                          component="img"
                          src={OWNER_AVATAR}
                          alt="Timna Brown"
                          className="identity-avatar"
                        />
                        <Stack spacing={0.5}>
                          <Typography variant="h6">Timna Brown</Typography>
                          <Typography variant="body1">Atlanta, USA</Typography>
                          <Link href="https://github.com/brown9804" target="_blank" rel="noreferrer">
                            @brown9804
                          </Link>
                          <Link
                            href="https://www.linkedin.com/in/timna-b-939492161/"
                            target="_blank"
                            rel="noreferrer"
                          >
                            LinkedIn
                          </Link>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Card className="dashboard-card identity-card">
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2 }}>
                        Founder / Organization
                      </Typography>
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                        <Box
                          component="img"
                          src={ORG_AVATAR}
                          alt="Cloud2BR"
                          className="identity-avatar"
                        />
                        <Typography variant="h6">Cloud2BR</Typography>
                      </Stack>
                      <Typography variant="body1" sx={{ mb: 1.5 }}>
                        Cloud2BR supports publishing, release workflows, and project distribution.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Card className="dashboard-card identity-card" sx={{ mt: 2 }}>
                <CardContent>
                  <Chip label="Release context" className="release-chip" />
                  <Typography variant="h6" sx={{ mt: 2, mb: 1.5 }}>
                    Dashboard details
                  </Typography>
                  <Box component="ul" className="release-list">
                    <li>
                      <strong>Product:</strong> Beginner stock analysis dashboard for GitHub Pages
                    </li>
                    <li>
                      <strong>Data source:</strong> Local deterministic market model for GitHub Pages compatibility
                    </li>
                    <li>
                      <strong>Release channel:</strong> GitHub Actions Pages deployment from main
                    </li>
                    <li>
                      <strong>Scope:</strong> IBM stock snapshot, benchmark comparison, and simple risk cues
                    </li>
                  </Box>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  )
}

export default App
