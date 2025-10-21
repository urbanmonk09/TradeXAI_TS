// src/api/fetchStockData.ts
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
  lastUpdated: number;
}

const CACHE_TTL_MS = 60_000;
const cache: Record<string, { data: StockData; ts: number }> = {};
const ALPHA_VANTAGE_KEY = "BXLPMWZIQZSNVQXL";

// --- normalize symbol
function normalizeSymbol(input: string): { kind: "stock" | "crypto" | "index"; code: string; key: string } {
  const s = input.trim().toUpperCase();
  if (["NIFTY", "NIFTY50", "NSE:NIFTY50"].includes(s)) return { kind: "index", code: "^NSEI", key: "NIFTY" };
  if (["BANKNIFTY", "NSE:BANKNIFTY"].includes(s)) return { kind: "index", code: "^NSEBANK", key: "BANKNIFTY" };
  if (["BTC/USD", "BTCUSDT", "BTC-USD"].includes(s)) return { kind: "crypto", code: "BTCUSDT", key: "BTC/USD" };
  if (["ETH/USD", "ETHUSDT", "ETH-USD"].includes(s)) return { kind: "crypto", code: "ETHUSDT", key: "ETH/USD" };
  if (["SOL/USD", "SOLUSDT", "SOL-USD"].includes(s)) return { kind: "crypto", code: "SOLUSDT", key: "SOL/USD" };
  const code = s.endsWith(".NS") ? s : `${s}.NS`;
  return { kind: "stock", code, key: code };
}

// --- fill missing or zero values
function sanitizeArray(arr: number[]): number[] {
  const result: number[] = [];
  let lastValid = 0;
  for (const n of arr) {
    if (!Number.isFinite(n) || n <= 0) result.push(lastValid || 1);
    else {
      result.push(n);
      lastValid = n;
    }
  }
  return result;
}

// --- create empty fallback
function emptyStock(symbolKey: string): StockData {
  return {
    symbol: symbolKey,
    current: 1,
    high: 1,
    low: 1,
    open: 1,
    previousClose: 1,
    prices: Array(100).fill(1),
    highs: Array(100).fill(1),
    lows: Array(100).fill(1),
    volumes: Array(100).fill(1),
    lastUpdated: Date.now(),
  };
}

// --- fetch Yahoo data (for stocks/indices)
async function fetchYahoo(code: string): Promise<StockData | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      code
    )}?interval=1d&range=6mo`;
    const resp = await axios.get(url, { timeout: 8000 });
    const result = resp.data?.chart?.result?.[0];
    if (!result) return null;

    const quote = result.indicators?.quote?.[0];
    if (!quote?.close) return null;

    const closes = sanitizeArray(quote.close.map((n: number | null) => n ?? NaN));
    const highs = sanitizeArray((quote.high ?? []).map((n: number | null) => n ?? NaN));
    const lows = sanitizeArray((quote.low ?? []).map((n: number | null) => n ?? NaN));
    const volumes = sanitizeArray((quote.volume ?? []).map((n: number | null) => n ?? NaN));

    const lastIdx = closes.length - 1;
    const sliced = Math.max(closes.length - 100, 0);

    return {
      symbol: code,
      current: closes[lastIdx],
      high: Math.max(...highs.slice(sliced)),
      low: Math.min(...lows.slice(sliced)),
      open: Number(quote.open?.[lastIdx]) || closes[lastIdx],
      previousClose: closes[lastIdx - 1] || closes[lastIdx],
      prices: closes.slice(-100),
      highs: highs.slice(-100),
      lows: lows.slice(-100),
      volumes: volumes.slice(-100),
      lastUpdated: Date.now(),
    };
  } catch (err: any) {
    console.warn(`fetchYahoo failed ${code}: ${err?.message ?? err}`);
    return null;
  }
}

// --- fetch from Binance (for crypto)
async function fetchBinance(symbolCode: string): Promise<StockData | null> {
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(
      symbolCode
    )}&interval=1h&limit=500`;
    const resp = await axios.get(url, { timeout: 8000 });
    const rows: any[] = Array.isArray(resp.data) ? resp.data : [];
    if (!rows.length) return null;

    const closes = sanitizeArray(rows.map((r) => Number(r[4])));
    const highs = sanitizeArray(rows.map((r) => Number(r[2])));
    const lows = sanitizeArray(rows.map((r) => Number(r[3])));
    const volumes = sanitizeArray(rows.map((r) => Number(r[5])));

    const lastIdx = closes.length - 1;
    const sliced = Math.max(closes.length - 100, 0);

    return {
      symbol: symbolCode,
      current: closes[lastIdx],
      high: Math.max(...highs.slice(sliced)),
      low: Math.min(...lows.slice(sliced)),
      open: Number(rows[lastIdx][1]) || closes[lastIdx],
      previousClose: closes[lastIdx - 1] || closes[lastIdx],
      prices: closes.slice(-100),
      highs: highs.slice(-100),
      lows: lows.slice(-100),
      volumes: volumes.slice(-100),
      lastUpdated: Date.now(),
    };
  } catch (err: any) {
    console.warn(`fetchBinance failed ${symbolCode}: ${err?.message ?? err}`);
    return null;
  }
}

// --- fallback Alpha Vantage (for stocks)
async function fetchAlphaVantage(code: string): Promise<StockData | null> {
  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(
      code
    )}&apikey=${ALPHA_VANTAGE_KEY}`;
    const resp = await axios.get(url, { timeout: 8000 });
    const data = resp.data?.["Time Series (Daily)"];
    if (!data) return null;

    const dates = Object.keys(data).slice(0, 200).reverse();
    const closes: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const volumes: number[] = [];

    for (const d of dates) {
      const item = data[d];
      closes.push(Number(item["4. close"]));
      highs.push(Number(item["2. high"]));
      lows.push(Number(item["3. low"]));
      volumes.push(Number(item["5. volume"]));
    }

    const sc = sanitizeArray(closes);
    const sh = sanitizeArray(highs);
    const sl = sanitizeArray(lows);
    const sv = sanitizeArray(volumes);
    const lastIdx = sc.length - 1;
    const sliced = Math.max(sc.length - 100, 0);

    return {
      symbol: code,
      current: sc[lastIdx],
      high: Math.max(...sh.slice(sliced)),
      low: Math.min(...sl.slice(sliced)),
      open: Number(data[dates[lastIdx]]["1. open"]),
      previousClose: sc[lastIdx - 1] || sc[lastIdx],
      prices: sc.slice(-100),
      highs: sh.slice(-100),
      lows: sl.slice(-100),
      volumes: sv.slice(-100),
      lastUpdated: Date.now(),
    };
  } catch (err: any) {
    console.warn(`fetchAlphaVantage failed ${code}: ${err?.message ?? err}`);
    return null;
  }
}

// --- main fetch function
export async function fetchStockData(inputSymbol: string): Promise<StockData> {
  const { kind, code, key } = normalizeSymbol(inputSymbol);
  const cached = cache[key];
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  let result: StockData | null = null;
  if (kind === "crypto") {
    result = await fetchBinance(code);
  } else {
    result = (await fetchYahoo(code)) || (await fetchAlphaVantage(code));
  }

  const final = result ?? emptyStock(key);
  cache[key] = { data: final, ts: Date.now() };
  return final;
}
