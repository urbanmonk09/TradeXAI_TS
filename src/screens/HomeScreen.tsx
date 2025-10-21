// src/screens/HomeScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  Text,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Button,
} from "react-native";
import StockCard from "../components/StockCard";
import { fetchStockData, StockData } from "../api/fetchStockData";
import { generateSMCSignal, SignalResult, updateHitStatus } from "../utils/xaiLogic";
import { startLiveFeed } from "../api/liveFeed";
import { useNavigation } from "@react-navigation/native";
import {
  saveTradeHistory,
  loadTradeHistory,
  TradeResult,
  signalToTradeResult,
  computeAccuracy,
} from "../utils/tradeManager";

interface StockDisplay {
  symbol: string;
  signal: "BUY" | "SELL" | "HOLD";
  stoploss: number;
  targets: number[];
  confidence: number;
  hitStatus: "ACTIVE" | "TARGET ✅" | "STOP ❌";
  explanation: string; // always string, not optional
  entry?: number;
  finalPrice?: number;
  resolved?: boolean;
  resolvedAt?: string;
  price: number; // live price
  justUpdated?: boolean;
}

const defaultSymbols = [
  "^NSEI",
  "^NSEBANK",
  "RELIANCE.NS",
  "TCS.NS",
  "INFY.NS",
  "HDFCBANK.NS",
  "ICICIBANK.NS",
  "LT.NS",
  "SBIN.NS",
  "ITC.NS",
  "HINDUNILVR.NS",
  "MARUTI.NS",
  "AXISBANK.NS",
  "KOTAKBANK.NS",
  "BAJFINANCE.NS",
  "BHARTIARTL.NS",
  "SUNPHARMA.NS",
  "TATAMOTORS.NS",
  "TATASTEEL.NS",
  "HCLTECH.NS",
  "WIPRO.NS",
  "ADANIENT.NS",
  "BTC/USD",
  "ETH/USD",
  "SOL/USD",
];

const HomeScreen: React.FC = () => {
  const [symbols] = useState<string[]>(defaultSymbols);
  const [stockData, setStockData] = useState<StockDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [accuracy, setAccuracy] = useState<number>(0);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<StockDisplay[]>([]);
  const nav = useNavigation<any>();

  useEffect(() => {
    loadData();
  }, [symbols]);

  useEffect(() => {
    const feed = startLiveFeed(symbols, async (symbol: string, data: StockData) => {
      setStockData((prev) =>
        prev.map((s) => {
          if (s.symbol !== symbol) return s;

          const updatedSignal: SignalResult = {
            signal: s.signal,
            stoploss: s.stoploss,
            targets: s.targets,
            confidence: s.confidence,
            hitStatus: s.hitStatus,
            explanation: s.explanation,
            entryPrice: s.entry,
            resolved: s.resolved,
            finalPrice: s.finalPrice,
          };

          const newStatus = updateHitStatus(updatedSignal, data.current);

          return {
            ...s,
            price: data.current,
            hitStatus: newStatus.hitStatus,
            resolved: newStatus.resolved,
            finalPrice: newStatus.finalPrice,
            explanation: newStatus.explanation || "", // force string
            justUpdated: true,
          };
        })
      );

      const trades = await loadTradeHistory();
      const existingTrade = trades.find((t) => t.symbol === symbol);
      if (existingTrade) {
        const updatedTrade: TradeResult = {
          ...existingTrade,
          hitStatus: updateHitStatus(
            {
              signal: existingTrade.signal,
              stoploss: existingTrade.stoploss,
              targets: existingTrade.targets,
              confidence: existingTrade.confidence,
              hitStatus: existingTrade.hitStatus,
              explanation: existingTrade.explanation || "",
              entryPrice: existingTrade.entry,
              resolved: existingTrade.resolved,
              finalPrice: existingTrade.finalPrice,
            },
            data.current
          ).hitStatus,
        };

        const updatedTrades = trades.map((t) => (t.symbol === symbol ? updatedTrade : t));
        await saveTradeHistory(updatedTrades);
        refreshAccuracy();
      }

      setTimeout(() => {
        setStockData((prev) => prev.map((s) => ({ ...s, justUpdated: false })));
      }, 1500);
    });

    return () => feed.stop();
  }, [symbols]);

  const loadData = async () => {
    setLoading(true);
    const out: StockDisplay[] = [];

    for (const s of symbols) {
      try {
        const data = await fetchStockData(s);
        const smc: SignalResult = generateSMCSignal(data);
        const trade: TradeResult = signalToTradeResult(smc, s);

        const trades = await loadTradeHistory();
        const updatedTrades = [...trades.filter((t) => t.symbol !== s), trade];
        await saveTradeHistory(updatedTrades);

        out.push({
          ...trade,
          price: data.current,
          explanation: trade.explanation || "", // force string
          justUpdated: false,
        });
      } catch (e) {
        console.warn("Error processing", s, e);
      }
    }

    out.sort((a, b) => b.confidence - a.confidence);
    setStockData(out);
    setLoading(false);
    refreshAccuracy();
  };

  const refreshAccuracy = async () => {
    const trades = await loadTradeHistory();
    const acc = computeAccuracy(trades);
    setAccuracy(acc);
  };

  const refreshPrices = async () => {
    setLoading(true);
    const updated: StockDisplay[] = [];

    for (const stock of stockData) {
      try {
        const data = await fetchStockData(stock.symbol);
        const updatedSignal: SignalResult = {
          signal: stock.signal,
          stoploss: stock.stoploss,
          targets: stock.targets,
          confidence: stock.confidence,
          hitStatus: stock.hitStatus,
          explanation: stock.explanation,
          entryPrice: stock.entry,
          resolved: stock.resolved,
          finalPrice: stock.finalPrice,
        };
        const newHit = updateHitStatus(updatedSignal, data.current);

        updated.push({
          ...stock,
          price: data.current,
          hitStatus: newHit.hitStatus,
          resolved: newHit.resolved,
          finalPrice: newHit.finalPrice,
          explanation: newHit.explanation || "", // force string
          justUpdated: true,
        });

        const trades = await loadTradeHistory();
        const existingTrade = trades.find((t) => t.symbol === stock.symbol);
        if (existingTrade) {
          const updatedTrades = trades.map((t) =>
            t.symbol === stock.symbol
              ? {
                  ...existingTrade,
                  hitStatus: newHit.hitStatus,
                  resolved: newHit.resolved,
                  finalPrice: newHit.finalPrice,
                  explanation: newHit.explanation || "",
                }
              : t
          );
          await saveTradeHistory(updatedTrades);
        }
      } catch (e) {
        console.warn("Error refreshing", stock.symbol, e);
        updated.push(stock);
      }
    }

    setStockData(updated);
    await refreshAccuracy();
    setLoading(false);
  };

  const handleSearch = () => {
    const q = search.trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const filtered = stockData.filter((st) => st.symbol.toLowerCase().includes(q));
    setSearchResults(filtered);
  };

  return (
    <View style={styles.container}>
      <View style={{ flexDirection: "row", marginBottom: 12 }}>
        <TextInput
          placeholder="🔍 Search stock or crypto..."
          value={search}
          onChangeText={setSearch}
          style={[styles.searchBar, { flex: 1 }]}
        />
        <Button title="Search" onPress={handleSearch} />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
        <Button title="🔄 Refresh" onPress={refreshPrices} />
        <Text style={styles.accuracyText}>🎯 Accuracy: {accuracy.toFixed(2)}%</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <ScrollView>
          <Text style={styles.title}>🔥 Market Scanner</Text>
          {stockData.slice(0, 3).map((s) => (
            <StockCard
              key={s.symbol}
              {...s}
              onPress={() => nav.navigate("Signal", { stock: s })}
              style={s.justUpdated ? { borderWidth: 2, borderColor: "#0a8", borderRadius: 12 } : undefined}
            />
          ))}

          <Text style={styles.title}>📈 Market Watch</Text>
          {(searchResults.length ? searchResults : stockData.slice(3)).map((s) => (
            <StockCard
              key={s.symbol}
              {...s}
              onPress={() => nav.navigate("Signal", { stock: s })}
              style={s.justUpdated ? { borderWidth: 2, borderColor: "#0a8", borderRadius: 12 } : undefined}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f0f2f5" },
  searchBar: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#fff",
  },
  title: { fontSize: 18, fontWeight: "700", marginVertical: 12 },
  accuracyText: { fontSize: 16, fontWeight: "600", color: "#007b00" },
});

export default HomeScreen;
