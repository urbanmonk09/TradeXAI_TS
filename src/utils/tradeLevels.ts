// utils/tradeLevels.ts
export function calculateTradeLevels(prices: number[], signal: string) {
  if (!prices || prices.length < 2) return null;

  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const current = prices[prices.length - 1];
  const range = high - low;

  // 📈 Fibonacci retracement levels
  const fiboLevels = {
    "23.6": high - range * 0.236,
    "38.2": high - range * 0.382,
    "50.0": high - range * 0.5,
    "61.8": high - range * 0.618,
  };

  let target = current;
  let stopLoss = current;

  if (signal === "Buy") {
    target = current + range * 0.618; // near golden ratio target
    stopLoss = current - range * 0.236; // 23.6% below current
  } else if (signal === "Sell") {
    target = current - range * 0.618;
    stopLoss = current + range * 0.236;
  }

  return {
    entry: current,
    target: parseFloat(target.toFixed(2)),
    stopLoss: parseFloat(stopLoss.toFixed(2)),
    fibonacci: Object.fromEntries(
      Object.entries(fiboLevels).map(([k, v]) => [k, parseFloat(v.toFixed(2))])
    ),
  };
}
