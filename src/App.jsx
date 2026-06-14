import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Link,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import LocalAtmIcon from '@mui/icons-material/LocalAtm'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip as ChartTooltip,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import './App.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, Legend, ChartTooltip)

const STOCK_SYMBOL = 'IBM'
const MARKET_SYMBOL = 'SPY'
const ALPHA_VANTAGE_KEY = 'demo'
const ALPHA_VANTAGE_URL = 'https://www.alphavantage.co/query'

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

const readSeriesCloses = (payload) => {
  const series = payload?.['Time Series (Daily)']
  if (!series) return []

  return Object.entries(series)
    .map(([date, bar]) => ({
      date,
      close: Number.parseFloat(bar['4. close']),
    }))
    .filter((point) => Number.isFinite(point.close))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((point) => point.close)
}

const dailyReturns = (prices) =>
  prices
    .slice(1)
    .map((price, i) => (prices[i] > 0 ? price / prices[i] - 1 : 0))
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

  for (let i = 0; i < samples; i += 1) {
    const stockDelta = stock[i] - stockMean
    const marketDelta = market[i] - marketMean
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

  const loadData = async () => {
    setLoading(true)
    setError('')

    try {
      const urls = [
        `${ALPHA_VANTAGE_URL}?function=GLOBAL_QUOTE&symbol=${STOCK_SYMBOL}&apikey=${ALPHA_VANTAGE_KEY}`,
        `${ALPHA_VANTAGE_URL}?function=OVERVIEW&symbol=${STOCK_SYMBOL}&apikey=${ALPHA_VANTAGE_KEY}`,
        `${ALPHA_VANTAGE_URL}?function=TIME_SERIES_DAILY&symbol=${STOCK_SYMBOL}&outputsize=compact&apikey=${ALPHA_VANTAGE_KEY}`,
        `${ALPHA_VANTAGE_URL}?function=TIME_SERIES_DAILY&symbol=${MARKET_SYMBOL}&outputsize=compact&apikey=${ALPHA_VANTAGE_KEY}`,
      ]

      const responses = await Promise.all(urls.map((url) => fetch(url)))
      const payloads = await Promise.all(responses.map((response) => response.json()))

      if (payloads.some((payload) => payload?.Information || payload?.Note || payload?.Error)) {
        throw new Error('API rate limit reached or invalid response received.')
      }

      const [quotePayload, overviewPayload, stockSeriesPayload, marketSeriesPayload] = payloads
      const quote = quotePayload?.['Global Quote']
      const currentPrice = Number.parseFloat(quote?.['05. price'])
      const stockPrices = readSeriesCloses(stockSeriesPayload)
      const marketPrices = readSeriesCloses(marketSeriesPayload)

      if (!Number.isFinite(currentPrice) || stockPrices.length < 30 || marketPrices.length < 30) {
        throw new Error('Not enough market data returned from the API.')
      }

      const stockReturns = dailyReturns(stockPrices)
      const marketReturns = dailyReturns(marketPrices)
      const volatility = calculateVolatility(stockReturns)

      const betaFromOverview = Number.parseFloat(overviewPayload?.Beta)
      const beta = Number.isFinite(betaFromOverview)
        ? betaFromOverview
        : calculateBeta(stockReturns, marketReturns)

      const maxDrawdown = calculateMaxDrawdown(stockPrices)
      const recentPrices = stockPrices.slice(-252)
      const recentHigh = Math.max(...recentPrices)
      const potentialGain = recentHigh > 0 ? Math.max(0, ((recentHigh - currentPrice) / currentPrice) * 100) : 0

      const riskScore =
        volatility * 100 * 0.45 +
        Math.abs(beta - 1) * 20 * 0.2 +
        Math.abs(maxDrawdown) * 100 * 0.35

      const riskLevel = classifyRisk(riskScore)
      const signal = trafficSignal(riskLevel, potentialGain)

      const computedDashboard = {
        stockName: overviewPayload?.Name || STOCK_SYMBOL,
        symbol: STOCK_SYMBOL,
        currentPrice,
        riskLevel,
        potentialGain,
        riskScore,
        signal,
        indicators: {
          volatility,
          beta,
          maxDrawdown,
        },
      }

      setDashboard(computedDashboard)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to load stock data.')
    } finally {
      setLoading(false)
    }
  }

  const chartData = useMemo(() => {
    if (!dashboard) return null

    return {
      labels: ['Risk Score', 'Potential Return (%)'],
      datasets: [
        {
          label: `${dashboard.symbol} Snapshot`,
          data: [dashboard.riskScore, dashboard.potentialGain],
          backgroundColor: ['#b7410e', '#2f7a3f'],
          borderRadius: 8,
        },
      ],
    }
  }, [dashboard])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${context.raw.toFixed(2)}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }

  const signalLabel = {
    green: 'Attractive',
    yellow: 'Neutral',
    red: 'Risky',
  }

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
                Stocks 101 Dashboard
              </Typography>
              <Typography variant="body1" className="dashboard-subtitle">
                Beginner-friendly view of risk, return, and market behavior for {STOCK_SYMBOL}.
              </Typography>
            </Box>

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
                      <Tooltip title="Loads from Alpha Vantage when you click Load Data.">
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
                    {chartData ? (
                      <Bar data={chartData} options={chartOptions} />
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
        </Stack>
      </Container>
    </Box>
  )
}

export default App
