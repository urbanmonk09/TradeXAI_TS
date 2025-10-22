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

// ─── Normalize symbol ─────────────────────────────────────────────
function normalizeSymbol(
  input: string
): { kind: "stock" | "crypto" | "index"; code: string; key: string } {
  const s = input.trim().toUpperCase();

  // ✅ Use correct Yahoo Finance symbols for indices (no .NS)
  if (["NIFTY", "NIFTY50", "NSE:NIFTY50"].includes(s))
    return { kind: "index", code: "^NSEI", key: "NIFTY" };

  if (["BANKNIFTY", "NSE:BANKNIFTY"].includes(s))
    return { kind: "index", code: "^NSEBANK", key: "BANKNIFTY" };

  if (["BTC/USD", "BTCUSDT", "BTC-USD"].includes(s))
    return { kind: "crypto", code: "BTCUSDT", key: "BTC/USD" };

  if (["ETH/USD", "ETHUSDT", "ETH-USD"].includes(s))
    return { kind: "crypto", code: "ETHUSDT", key: "ETH/USD" };

  if (["SOL/USD", "SOLUSDT", "SOL-USD"].includes(s))
    return { kind: "crypto", code: "SOLUSDT", key: "SOL/USD" };

  const code = s.endsWith(".NS") ? s : `${s}.NS`;
  return { kind: "stock", code, key: code };
}

// ─── Fill missing / zero values ──────────────────────────────────
function sanitize(arr: number[]): number[] {
  const result: number[] = [];
  let last = 1;
  for (const n of arr) {
    if (Number.isFinite(n) && n > 0) {
      result.push(n);
      last = n;
    } else {
      result.push(last);
    }
  }
  return result;
}

// ─── Default fallback ────────────────────────────────────────────
function empty(symbol: string): StockData {
  const arr = Array(100).fill(1);
  return {
    symbol,
    current: 1,
    high: 1,
    low: 1,
    open: 1,
    previousClose: 1,
    prices: arr,
    highs: arr,
    lows: arr,
    volumes: arr,
    lastUpdated: Date.now(),
  };
}

// ─── Yahoo Finance for stocks / indices ──────────────────────────
async function fetchYahoo(code: string): Promise<StockData | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      code
    )}?interval=1d&range=6mo`;
    const r = await axios.get(url, { timeout: 8000 });
    const result = r.data?.chart?.result?.[0];

    if (!result) return null;
    const q = result.indicators?.quote?.[0];
    if (!q?.close) return null;

    const closes = sanitize(q.close.map((n: number | null) => n ?? NaN));
    const highs = sanitize((q.high ?? []).map((n: number | null) => n ?? NaN));
    const lows = sanitize((q.low ?? []).map((n: number | null) => n ?? NaN));
    const vols = sanitize((q.volume ?? []).map((n: number | null) => n ?? NaN));

    const last = closes.length - 1;
    const start = Math.max(0, closes.length - 100);

    return {
      symbol: code,
      current: closes[last],
      high: Math.max(...highs.slice(start)),
      low: Math.min(...lows.slice(start)),
      open: Number(q.open?.[last]) || closes[last],
      previousClose: closes[last - 1] || closes[last],
      prices: closes.slice(-100),
      highs: highs.slice(-100),
      lows: lows.slice(-100),
      volumes: vols.slice(-100),
      lastUpdated: Date.now(),
    };
  } catch (e: any) {
    console.warn(`fetchYahoo failed ${code}: ${e.message}`);
    return null;
  }
}

// ─── Binance for crypto ──────────────────────────────────────────
async function fetchBinance(code: string): Promise<StockData | null> {
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(
      code
    )}&interval=1h&limit=500`;
    const r = await axios.get(url, { timeout: 8000 });
    const rows: any[] = r.data;

    if (!Array.isArray(rows) || !rows.length) return null;

    const closes = sanitize(rows.map((x) => +x[4]));
    const highs = sanitize(rows.map((x) => +x[2]));
    const lows = sanitize(rows.map((x) => +x[3]));
    const vols = sanitize(rows.map((x) => +x[5]));

    const last = closes.length - 1;
    const start = Math.max(0, closes.length - 100);

    return {
      symbol: code,
      current: closes[last],
      high: Math.max(...highs.slice(start)),
      low: Math.min(...lows.slice(start)),
      open: +rows[last][1] || closes[last],
      previousClose: closes[last - 1] || closes[last],
      prices: closes.slice(-100),
      highs: highs.slice(-100),
      lows: lows.slice(-100),
      volumes: vols.slice(-100),
      lastUpdated: Date.now(),
    };
  } catch (e: any) {
    console.warn(`fetchBinance failed ${code}: ${e.message}`);
    return null;
  }
}

// ─── Alpha Vantage fallback ──────────────────────────────────────
async function fetchAlpha(code: string): Promise<StockData | null> {
  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(
      code
    )}&apikey=${ALPHA_VANTAGE_KEY}`;
    const r = await axios.get(url, { timeout: 8000 });
    const ts = r.data?.["Time Series (Daily)"];
    if (!ts) return null;

    const dates = Object.keys(ts).slice(0, 200).reverse();

    const closes = sanitize(dates.map((d) => +ts[d]["4. close"]));
    const highs = sanitize(dates.map((d) => +ts[d]["2. high"]));
    const lows = sanitize(dates.map((d) => +ts[d]["3. low"]));
    const vols = sanitize(dates.map((d) => +ts[d]["5. volume"]));

    const last = closes.length - 1;
    const start = Math.max(0, closes.length - 100);

    return {
      symbol: code,
      current: closes[last],
      high: Math.max(...highs.slice(start)),
      low: Math.min(...lows.slice(start)),
      open: +ts[dates[last]]["1. open"] || closes[last],
      previousClose: closes[last - 1] || closes[last],
      prices: closes.slice(-100),
      highs: highs.slice(-100),
      lows: lows.slice(-100),
      volumes: vols.slice(-100),
      lastUpdated: Date.now(),
    };
  } catch (e: any) {
    console.warn(`fetchAlphaVantage failed ${code}: ${e.message}`);
    return null;
  }
}

// ─── Main fetch function ─────────────────────────────────────────
export async function fetchStockData(symbol: string): Promise<StockData> {
  const { kind, code, key } = normalizeSymbol(symbol);

  // Use cache if valid
  const cached = cache[key];
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  let data: StockData | null = null;
  if (kind === "crypto") {
    data = await fetchBinance(code);
  } else {
    data = (await fetchYahoo(code)) || (await fetchAlpha(code));
  }

  const final = data ?? empty(key);
  cache[key] = { data: final, ts: Date.now() };
  return final;
}
