// src/utils/tradeManager.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SignalResult, evaluateEndOfDayResult, updateHitStatus } from "./xaiLogic";

// --- Trade Storage Key ---
const TRADE_STORAGE_KEY = "@trade_history";

// --- Trade Result Interface ---
export interface TradeResult {
  symbol: string;
  signal: "BUY" | "SELL" | "HOLD";
  stoploss: number;
  targets: number[];
  confidence: number;
  hitStatus: "ACTIVE" | "TARGET ✅" | "STOP ❌";
  explanation?: string;
  entry?: number;
  finalPrice?: number;
  resolved?: boolean;
  resolvedAt?: string;
  bos?: "BOS" | "CHoCH" | null; // Smart Money Concept
}

// --- Helper: Convert SignalResult -> TradeResult ---
export const signalToTradeResult = (signal: SignalResult, symbol: string): TradeResult => {
  // Determine BOS / CHoCH (simplified)
  let bos: TradeResult["bos"] = null;
  if (signal.entryPrice && signal.targets.length > 0) {
    if (signal.signal === "BUY") {
      bos = signal.entryPrice > signal.targets[0] ? "BOS" : "CHoCH";
    } else if (signal.signal === "SELL") {
      bos = signal.entryPrice < signal.targets[0] ? "BOS" : "CHoCH";
    }
  }

  return {
    symbol,
    signal: signal.signal,
    stoploss: signal.stoploss,
    targets: signal.targets,
    confidence: signal.confidence,
    hitStatus: signal.hitStatus,
    explanation: signal.explanation,
    entry: signal.entryPrice,
    finalPrice: signal.finalPrice,
    resolved: signal.resolved,
    resolvedAt: signal.resolvedAt,
    bos,
  };
};

// --- Save trade history ---
export const saveTradeHistory = async (trades: TradeResult[]) => {
  try {
    await AsyncStorage.setItem(TRADE_STORAGE_KEY, JSON.stringify(trades));
  } catch (e) {
    console.warn("Error saving trades", e);
  }
};

// --- Load trade history ---
export const loadTradeHistory = async (): Promise<TradeResult[]> => {
  try {
    const data = await AsyncStorage.getItem(TRADE_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.warn("Error loading trades", e);
    return [];
  }
};

// --- Update live trade price ---
export const updateLiveTrade = (trade: TradeResult, currentPrice: number): TradeResult => {
  const updatedSignal = updateHitStatus(
    {
      signal: trade.signal,
      stoploss: trade.stoploss,
      targets: trade.targets,
      confidence: trade.confidence,
      hitStatus: trade.hitStatus,
      explanation: trade.explanation ?? "No explanation",
      entryPrice: trade.entry,
      resolved: trade.resolved ?? false,
      finalPrice: trade.finalPrice,
    },
    currentPrice
  );

  return {
    ...trade,
    hitStatus: updatedSignal.hitStatus,
    resolved: updatedSignal.resolved,
    finalPrice: updatedSignal.finalPrice,
    resolvedAt: updatedSignal.resolvedAt,
    explanation: updatedSignal.explanation,
  };
};

// --- Evaluate end of day trade result ---
export const endOfDayEvaluate = (
  trade: TradeResult,
  dayHigh: number,
  dayLow: number,
  closePrice: number
): TradeResult => {
  const updatedSignal = evaluateEndOfDayResult(
    {
      signal: trade.signal,
      stoploss: trade.stoploss,
      targets: trade.targets,
      confidence: trade.confidence,
      hitStatus: trade.hitStatus,
      explanation: trade.explanation ?? "No explanation",
      entryPrice: trade.entry,
      resolved: trade.resolved ?? false,
      finalPrice: trade.finalPrice,
    },
    dayHigh,
    dayLow,
    closePrice
  );

  return {
    ...trade,
    hitStatus: updatedSignal.hitStatus,
    resolved: updatedSignal.resolved,
    finalPrice: updatedSignal.finalPrice,
    resolvedAt: updatedSignal.resolvedAt,
    explanation: updatedSignal.explanation,
  };
};

// --- Compute Overall Accuracy ---
export const computeAccuracy = (trades: TradeResult[]): number => {
  const resolvedTrades = trades.filter((t) => t.resolved);
  if (resolvedTrades.length === 0) return 0;
  const success = resolvedTrades.filter((t) => t.hitStatus === "TARGET ✅").length;
  return Math.round((success / resolvedTrades.length) * 100);
};
