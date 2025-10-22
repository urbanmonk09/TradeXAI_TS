export interface StockData {
  symbol: string;
  current: number;
  open: number;
  previousClose: number;
  high: number;
  low: number;
  prices: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  lastUpdated: number;
}
