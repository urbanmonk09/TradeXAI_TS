// src/api/liveFeed.ts
import { StockData, fetchStockData } from "./fetchStockData";

type UpdateCallback = (symbol: string, data: StockData) => void;

export function startLiveFeed(symbols: string[], callback: UpdateCallback) {
  // Map user-facing crypto symbols to Binance pair
  const cryptoSymbols = symbols.filter((s) =>
    ["BTC/USD", "ETH/USD", "SOL/USD", "BTCUSDT", "ETHUSDT", "SOLUSDT"].includes(s.toUpperCase())
  );

  const sockets: WebSocket[] = [];

  cryptoSymbols.forEach((sym) => {
    // normalized binance pair
    let pair = sym.toUpperCase().replace("/", "");
    // ensure USDT at end
    if (!pair.endsWith("USDT")) pair = pair.endsWith("USD") ? `${pair.slice(0, -3)}USDT` : `${pair}USDT`;
    const wsUrl = `wss://stream.binance.com:9443/ws/${pair.toLowerCase()}@kline_1m`;

    try {
      const ws = new WebSocket(wsUrl);
      ws.onmessage = async (event: any) => {
        try {
          const msgData = JSON.parse(event.data);
          const price = Number(msgData.k?.c ?? msgData.p ?? msgData.c);
          if (!isNaN(price)) {
            // get base cached data then override current
            const base = await fetchStockData(sym);
            callback(sym, { ...base, current: price });
          }
        } catch (e) {
          console.warn("binance onmessage parse error:", e);
        }
      };
      ws.onopen = () => console.log("binance ws open for", pair);
      ws.onerror = (e) => console.warn("binance ws error for", pair, e);
      sockets.push(ws);
    } catch (err) {
      console.warn("Failed to create ws for", pair, err);
    }
  });

  // Polling for non-crypto symbols every 30s
  const stockSymbols = symbols.filter((s) => !cryptoSymbols.includes(s));
  const interval = setInterval(async () => {
    for (const sym of stockSymbols) {
      try {
        const data = await fetchStockData(sym);
        callback(sym, data);
      } catch (e) {
        console.warn("Polling error for", sym, e);
      }
    }
  }, 30_000);

  return {
    stop: () => {
      sockets.forEach((ws) => {
        try {
          ws.close();
        } catch {}
      });
      clearInterval(interval);
    },
  };
}
