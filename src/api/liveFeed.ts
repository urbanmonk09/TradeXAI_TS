// src/api/liveFeed.ts
import { StockData, fetchStockData } from "./fetchStockData";

type UpdateCallback = (symbol: string, data: StockData) => void;

export function startLiveFeed(symbols: string[], callback: UpdateCallback) {
  const cryptoSymbols = symbols.filter(s => ["BTC/USD","ETH/USD","SOL/USD"].includes(s));
  const sockets: WebSocket[] = [];

  // --- WebSocket for crypto
  cryptoSymbols.forEach(sym => {
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${sym.replace("/","").toLowerCase()}@kline_1m`);

    ws.onmessage = (event: WebSocketMessageEvent) => {
      const msgData = JSON.parse(event.data);
      const price = Number(msgData.k.c);
      if (!isNaN(price)) {
        fetchStockData(sym).then(data => {
          callback(sym, { ...data, current: price });
        });
      }
    };

    sockets.push(ws);
  });

  // --- Polling for non-crypto symbols
  const stockSymbols = symbols.filter(s => !cryptoSymbols.includes(s));
  const interval = setInterval(() => {
    stockSymbols.forEach(async sym => {
      const data = await fetchStockData(sym);
      callback(sym, data);
    });
  }, 15000);

  return {
    stop: () => {
      sockets.forEach(ws => ws.close());
      clearInterval(interval);
    }
  };
}
