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
const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart'
const OWNER_AVATAR = 'https://github.com/brown9804.png'
const ORG_AVATAR = 'https://github.com/Cloud2BR.png'

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

const fetchChartData = async (symbol) => {
  const response = await fetch(
    `${YAHOO_CHART_URL}/${symbol}?range=1y&interval=1d&includePrePost=false&events=div,splits`,
  )

  if (!response.ok) {
    throw new Error(`Unable to load data for ${symbol}.`)
  }

  return response.json()
}

const parseChartData = (payload) => {
  const chartResult = payload?.chart?.result?.[0]
  const closes = chartResult?.indicators?.quote?.[0]?.close ?? []

  return {
    meta: chartResult?.meta ?? {},
    prices: closes.filter((value) => Number.isFinite(value)),
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

  const loadData = async () => {
    setLoading(true)
    setError('')

    try {
      const [stockPayload, marketPayload] = await Promise.all([
        fetchChartData(STOCK_SYMBOL),
        fetchChartData(MARKET_SYMBOL),
      ])

      const stockSeries = parseChartData(stockPayload)
      const marketSeries = parseChartData(marketPayload)
      const stockPrices = stockSeries.prices
      const marketPrices = marketSeries.prices
      const currentPrice = stockSeries.meta?.regularMarketPrice ?? stockPrices[stockPrices.length - 1]

      if (!Number.isFinite(currentPrice) || stockPrices.length < 30 || marketPrices.length < 30) {
        throw new Error('No price history returned from Yahoo Finance.')
      }

      const stockReturns = dailyReturns(stockPrices)
      const marketReturns = dailyReturns(marketPrices)
      const volatility = calculateVolatility(stockReturns)
      const beta = calculateBeta(stockReturns, marketReturns)
      const maxDrawdown = calculateMaxDrawdown(stockPrices)
      const recentPrices = stockPrices.slice(-252)
      const recentHigh = Math.max(...recentPrices)
      const potentialGain =
        recentHigh > 0 ? Math.max(0, ((recentHigh - currentPrice) / currentPrice) * 100) : 0

      const riskScore =
        volatility * 100 * 0.45 +
        Math.abs(beta - 1) * 20 * 0.2 +
        Math.abs(maxDrawdown) * 100 * 0.35

      const riskLevel = classifyRisk(riskScore)
      const signal = trafficSignal(riskLevel, potentialGain)

      setDashboard({
        stockName: stockSeries.meta?.longName || stockSeries.meta?.shortName || STOCK_SYMBOL,
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
      })
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
          label: (context) => `${context.label}: ${Number(context.raw).toFixed(2)}`,
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
                Stock Dashboards 101
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
                      <Tooltip title="Loads from Yahoo Finance chart data when you click Load Data.">
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
                      <Link href="https://github.com/Cloud2BR/docs-foundry" target="_blank" rel="noreferrer">
                        Cloud2BR/docs-foundry
                      </Link>
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
                      <strong>Data source:</strong> Yahoo Finance chart endpoint, no API key required
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
