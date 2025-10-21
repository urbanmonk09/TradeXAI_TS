import axios from "axios";

export interface StockData {
  symbol: string;
  current: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  prices: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
}

/** 
 * 🧠 In-memory cache: stores { data, timestamp }
 */
const cache = new Map<string, { data: StockData; timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds cache duration

/**
 * 🧭 Map user symbol to Yahoo-compatible ticker
 */
function mapSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase();

  // 🏦 Indian indices
  if (["NIFTY", "NSE:NIFTY50", "NIFTY50"].includes(s)) return "^NSEI";
  if (["BANKNIFTY", "NSE:BANKNIFTY"].includes(s)) return "^NSEBANK";

  // 💰 Cryptocurrencies
  if (["BTC/USD", "BTCUSDT", "BTC-USD"].includes(s)) return "BTC-USD";
  if (["ETH/USD", "ETHUSDT", "ETH-USD"].includes(s)) return "ETH-USD";
  if (["SOL/USD", "SOLUSDT", "SOL-USD"].includes(s)) return "SOL-USD";

  // 🏢 Regular NSE stocks
  return s.endsWith(".NS") ? s : `${s}.NS`;
}

/**
 * 🔄 Fetches stock/crypto/index data from Yahoo Finance with:
 * - smart interval fallback
 * - quote API fallback
 * - 30s in-memory caching
 */
export async function fetchStockData(symbol: string): Promise<StockData | null> {
  const yahooSymbol = mapSymbol(symbol);

  // ✅ Cache check
  const cached = cache.get(yahooSymbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    // console.log(`⚡ Using cached data for ${yahooSymbol}`);
    return cached.data;
  }

  const logError = (msg: string) =>
    console.error(`❌ Error fetching data for ${symbol} (${yahooSymbol}): ${msg}`);

  // Multiple intervals: fall back progressively
  const intervals = [
    { interval: "1d", range: "1mo" },
    { interval: "1h", range: "7d" },
    { interval: "15m", range: "5d" },
  ];

  for (const { interval, range } of intervals) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${interval}&range=${range}`;
      const response = await axios.get(url);
      const result = response.data?.chart?.result?.[0];

      if (!result?.indicators?.quote?.[0]) throw new Error("No valid chart data.");

      const quote = result.indicators.quote[0];
      const { open, high, low, close, volume } = quote;
      if (!close?.length) throw new Error("Empty close array.");

      const lastIndex = close.length - 1;
      const current = close[lastIndex];
      const prevClose = close[lastIndex - 1] ?? current;

      const data: StockData = {
        symbol: yahooSymbol,
        current,
        high: Math.max(...high.filter((v: number) => v != null)),
        low: Math.min(...low.filter((v: number) => v != null)),
        open: open[lastIndex],
        previousClose: prevClose,
        prices: close.filter((v: number) => v != null),
        highs: high.filter((v: number) => v != null),
        lows: low.filter((v: number) => v != null),
        volumes: volume.filter((v: number) => v != null),
      };

      // ✅ Store in cache
      cache.set(yahooSymbol, { data, timestamp: Date.now() });
      return data;
    } catch (err: any) {
      logError(`Chart fetch failed (${interval}/${range}) → ${err.message}`);
    }
  }

  // 🧭 Fallback to quote API
  try {
    const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooSymbol}`;
    const resp = await axios.get(quoteUrl);
    const q = resp.data?.quoteResponse?.result?.[0];
    if (!q) throw new Error("Quote endpoint returned empty result.");

    const data: StockData = {
      symbol: yahooSymbol,
      current: q.regularMarketPrice ?? 0,
      high: q.regularMarketDayHigh ?? 0,
      low: q.regularMarketDayLow ?? 0,
      open: q.regularMarketOpen ?? 0,
      previousClose: q.regularMarketPreviousClose ?? 0,
      prices: [],
      highs: [],
      lows: [],
      volumes: [],
    };

    // ✅ Cache fallback data too
    cache.set(yahooSymbol, { data, timestamp: Date.now() });
    return data;
  } catch (err: any) {
    logError(`Quote fallback failed → ${err.message}`);
    return null;
  }
}
