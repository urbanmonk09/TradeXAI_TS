// src/utils/xaiLogic.ts
import { StockData } from "./api";

// =========================================================
// --- Indicator Helpers ---
// =========================================================

export function calculateSMA(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1] ?? 0;
  const slice = data.slice(-period);
  return slice.reduce((sum, val) => sum + val, 0) / period;
}

export function calculateEMA(data: number[], period: number): number {
  if (data.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = data[0];
  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

export function calculateRSI(data: number[], period = 14): number {
  if (data.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = data.length - period; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// =========================================================
// --- SMC Detection Helpers ---
// =========================================================

// 🔹 Fair Value Gap (FVG)
export function detectFairValueGap(highs: number[], lows: number[]): boolean {
  if (highs.length < 3 || lows.length < 3) return false;
  const i = highs.length - 3;
  const prevHigh = highs[i];
  const nextLow = lows[i + 2];
  return Math.abs(nextLow - prevHigh) / prevHigh > 0.005; // >0.5% imbalance
}

// 🔹 Order Block (simple version)
export function detectOrderBlock(prices: number[]): "BULLISH" | "BEARISH" | null {
  if (prices.length < 5) return null;
  const lastFive = prices.slice(-5);
  const avg = lastFive.reduce((a, b) => a + b, 0) / 5;
  const recent = prices[prices.length - 1];
  if (recent > avg * 1.01) return "BULLISH";
  if (recent < avg * 0.99) return "BEARISH";
  return null;
}

// 🔹 Volume Surge
export function detectVolumeSurge(volumes: number[]): boolean {
  if (volumes.length < 10) return false;
  const avgVol = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const latest = volumes[volumes.length - 1];
  return latest > avgVol * 1.5;
}

// 🔹 Liquidity Sweep
export function detectLiquiditySweep(
  highs: number[],
  lows: number[],
  current: number
): "BULLISH" | "BEARISH" | null {
  if (highs.length < 5 || lows.length < 5) return null;
  const recentHigh = Math.max(...highs.slice(-5, -1));
  const recentLow = Math.min(...lows.slice(-5, -1));

  if (current > recentHigh * 1.001 && current < highs[highs.length - 2])
    return "BEARISH";
  if (current < recentLow * 0.999 && current > lows[lows.length - 2])
    return "BULLISH";

  return null;
}

// 🔹 Break of Structure (BOS)
export function detectBOS(highs: number[], lows: number[]): "BULLISH" | "BEARISH" | null {
  if (highs.length < 6 || lows.length < 6) return null;

  const prevHigh = highs[highs.length - 3];
  const currHigh = highs[highs.length - 1];
  const prevLow = lows[lows.length - 3];
  const currLow = lows[lows.length - 1];

  if (currHigh > prevHigh * 1.002) return "BULLISH";
  if (currLow < prevLow * 0.998) return "BEARISH";
  return null;
}

// 🔹 Change of Character (CHoCH)
export function detectCHoCH(highs: number[], lows: number[]): "BULLISH" | "BEARISH" | null {
  if (highs.length < 8 || lows.length < 8) return null;

  const lastHigh = highs[highs.length - 1];
  const secondLastHigh = highs[highs.length - 3];
  const lastLow = lows[lows.length - 1];
  const secondLastLow = lows[lows.length - 3];

  const brokeHigh = lastHigh > secondLastHigh * 1.001;
  const brokeLow = lastLow < secondLastLow * 0.999;

  if (brokeHigh && !brokeLow) return "BULLISH";
  if (brokeLow && !brokeHigh) return "BEARISH";
  return null;
}

// =========================================================
// --- Signal Structure ---
// =========================================================

export interface SignalResult {
  signal: "BUY" | "SELL" | "HOLD";
  stoploss: number;
  targets: number[];
  confidence: number;
  explanation: string;
  hitStatus: "ACTIVE" | "TARGET ✅" | "STOP ❌";
  entryPrice?: number;
  finalPrice?: number;
  resolved?: boolean;
  resolvedAt?: string;
}

// =========================================================
// --- Generate SMC-Based Signal ---
// =========================================================

export function generateSMCSignal(stock: StockData): SignalResult {
  const prices = stock.prices || [];
  const highs = stock.highs || [];
  const lows = stock.lows || [];
  const volumes = stock.volumes || [];
  const current = stock.current;
  const prevClose = stock.previousClose;

  const sma20 = calculateSMA(prices, 20);
  const ema50 = calculateEMA(prices, 50);
  const rsi = calculateRSI(prices, 14);
  const change = ((current - prevClose) / prevClose) * 100;

  // --- Detect SMC features ---
  const hasFVG = detectFairValueGap(highs, lows);
  const orderBlock = detectOrderBlock(prices);
  const volumeSurge = detectVolumeSurge(volumes);
  const liquiditySweep = detectLiquiditySweep(highs, lows, current);
  const bos = detectBOS(highs, lows);
  const choch = detectCHoCH(highs, lows);

  let signal: "BUY" | "SELL" | "HOLD" = "HOLD";
  let confidence = 50;
  let explanation = "Neutral: waiting for confirmation.";

  // --- Combined logic ---
  if (current > sma20 && current > ema50 && rsi < 70 && change > 0) {
    signal = "BUY";
    confidence = 70;
    explanation = "Price above SMA20 & EMA50 with positive momentum.";

    if (bos === "BULLISH") {
      confidence += 10;
      explanation += " Break of Structure confirmed — trend continuation.";
    }
    if (choch === "BULLISH") {
      confidence += 10;
      explanation += " Change of Character indicates bullish reversal.";
    }
    if (orderBlock === "BULLISH") {
      confidence += 5;
      explanation += " Bullish Order Block confirmed.";
    }
    if (hasFVG) {
      confidence += 5;
      explanation += " Fair Value Gap suggests rebalancing move.";
    }
    if (volumeSurge) {
      confidence += 5;
      explanation += " Volume surge supports institutional buying.";
    }
    if (liquiditySweep === "BULLISH") {
      confidence += 5;
      explanation += " Bullish liquidity sweep below lows detected.";
    }
  } else if (current < sma20 && current < ema50 && rsi > 30 && change < 0) {
    signal = "SELL";
    confidence = 70;
    explanation = "Price below SMA20 & EMA50 with downside momentum.";

    if (bos === "BEARISH") {
      confidence += 10;
      explanation += " Break of Structure confirmed — bearish continuation.";
    }
    if (choch === "BEARISH") {
      confidence += 10;
      explanation += " Change of Character indicates bearish reversal.";
    }
    if (orderBlock === "BEARISH") {
      confidence += 5;
      explanation += " Bearish Order Block detected.";
    }
    if (hasFVG) {
      confidence += 5;
      explanation += " Fair Value Gap indicates imbalance on downside.";
    }
    if (volumeSurge) {
      confidence += 5;
      explanation += " Volume surge supports selling pressure.";
    }
    if (liquiditySweep === "BEARISH") {
      confidence += 5;
      explanation += " Bearish liquidity sweep above highs detected.";
    }
  }

  confidence = Math.min(confidence, 98);

  const stoploss =
    signal === "BUY" ? current * 0.985 : signal === "SELL" ? current * 1.015 : current;
  const targets =
    signal === "BUY"
      ? [current * 1.01, current * 1.02, current * 1.03]
      : signal === "SELL"
      ? [current * 0.99, current * 0.98, current * 0.97]
      : [current];

  return {
    signal,
    stoploss,
    targets,
    confidence,
    explanation,
    hitStatus: "ACTIVE",
    entryPrice: current,
    resolved: false,
  };
}

// =========================================================
// --- Live Update Tracking ---
// =========================================================

export function updateHitStatus(result: SignalResult, currentPrice: number): SignalResult {
  if (result.resolved) return result;

  if (result.signal === "BUY") {
    if (currentPrice <= result.stoploss)
      return { ...result, hitStatus: "STOP ❌", explanation: "Stoploss hit — trade invalidated.", resolved: true, resolvedAt: new Date().toISOString(), finalPrice: currentPrice };
    if (currentPrice >= result.targets[0])
      return { ...result, hitStatus: "TARGET ✅", explanation: "Target reached — take profits.", resolved: true, resolvedAt: new Date().toISOString(), finalPrice: currentPrice };
  }

  if (result.signal === "SELL") {
    if (currentPrice >= result.stoploss)
      return { ...result, hitStatus: "STOP ❌", explanation: "Stoploss hit — trade invalidated.", resolved: true, resolvedAt: new Date().toISOString(), finalPrice: currentPrice };
    if (currentPrice <= result.targets[0])
      return { ...result, hitStatus: "TARGET ✅", explanation: "Target reached — take profits.", resolved: true, resolvedAt: new Date().toISOString(), finalPrice: currentPrice };
  }

  return result;
}

// =========================================================
// --- End-of-Day Evaluation ---
// =========================================================

export function evaluateEndOfDayResult(
  signal: SignalResult,
  dayHigh: number,
  dayLow: number,
  closePrice: number
): SignalResult {
  if (signal.resolved) return signal;

  let finalStatus: SignalResult["hitStatus"] = "ACTIVE";
  let finalExplanation = signal.explanation;

  if (signal.signal === "BUY") {
    if (dayLow <= signal.stoploss) {
      finalStatus = "STOP ❌";
      finalExplanation = "Stoploss hit intraday — trade failed.";
    } else if (dayHigh >= signal.targets[0]) {
      finalStatus = "TARGET ✅";
      finalExplanation = "Target reached — take profits.";
    }
  } else if (signal.signal === "SELL") {
    if (dayHigh >= signal.stoploss) {
      finalStatus = "STOP ❌";
      finalExplanation = "Stoploss hit intraday — trade failed.";
    } else if (dayLow <= signal.targets[0]) {
      finalStatus = "TARGET ✅";
      finalExplanation = "Target reached — take profits.";
    }
  }

  return {
    ...signal,
    hitStatus: finalStatus,
    finalPrice: closePrice,
    resolved: true,
    resolvedAt: new Date().toISOString(),
    explanation: finalExplanation,
  };
}
