// utils/indicators.ts

// Simple moving average
export function calculateSMA(data: number[], period: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      out.push(NaN);
      continue;
    }
    const slice = data.slice(i - period + 1, i + 1);
    const sum = slice.reduce((s, v) => s + v, 0);
    out.push(sum / period);
  }
  return out;
}

// Exponential moving average (standard)
export function calculateEMA(data: number[], period: number): number[] {
  const out: number[] = [];
  const k = 2 / (period + 1);
  let prevEma = data[0];
  out.push(prevEma);
  for (let i = 1; i < data.length; i++) {
    const ema = data[i] * k + prevEma * (1 - k);
    out.push(ema);
    prevEma = ema;
  }
  return out;
}

// RSI (Wilder's smoothing) returns last RSI value (0..100)
export function calculateRSI(prices: number[], period = 14): number {
  if (!prices || prices.length < period + 1) return 50;
  // initial avg gain/loss
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  // Wilder smoothing for the rest
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// MACD returns last macd/ signal / histogram numbers
export function calculateMACD(prices: number[]) {
  // compute EMAs for each index
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  // macd line
  const macdLine = ema12.map((v, i) => v - (ema26[i] ?? ema12[i]));
  const signalLine = calculateEMA(macdLine, 9);
  const hist = macdLine[macdLine.length - 1] - (signalLine[signalLine.length - 1] ?? 0);
  return {
    macd: macdLine[macdLine.length - 1],
    signal: signalLine[signalLine.length - 1],
    histogram: hist,
  };
}

// Bollinger bands (returns upper/mid/lower using SMA)
export function calculateBollinger(prices: number[], period = 20, multiplier = 2) {
  if (prices.length < period) {
    const last = prices[prices.length - 1] ?? 0;
    return { upper: last, mid: last, lower: last };
  }
  const smaArr = calculateSMA(prices, period);
  const mid = smaArr[smaArr.length - 1];
  const slice = prices.slice(-period);
  const variance = slice.reduce((s, v) => s + Math.pow(v - mid, 2), 0) / period;
  const std = Math.sqrt(variance);
  return {
    upper: mid + multiplier * std,
    mid,
    lower: mid - multiplier * std,
  };
}
