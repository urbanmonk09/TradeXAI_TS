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
  explanation: string;
  entry?: number;
  finalPrice?: number;
  resolved?: boolean;
  resolvedAt?: string;
  price: number;
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

          const newStatus = updateHitStatus(
            {
              signal: s.signal,
              stoploss: s.stoploss,
              targets: s.targets,
              confidence: s.confidence,
              hitStatus: s.hitStatus,
              explanation: s.explanation,
              entryPrice: s.entry,
              resolved: s.resolved,
              finalPrice: s.finalPrice,
            },
            data.current
          );

          return {
            ...s,
            price: data.current,
            hitStatus: newStatus.hitStatus,
            resolved: newStatus.resolved,
            finalPrice: newStatus.finalPrice,
            explanation: newStatus.explanation || "",
            justUpdated: true,
          };
        })
      );

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
        const smc = generateSMCSignal(data);
        const trade = signalToTradeResult(smc, s);

        const trades = await loadTradeHistory();
        const updatedTrades = [...trades.filter((t) => t.symbol !== s), trade];
        await saveTradeHistory(updatedTrades);

        out.push({
          ...trade,
          price: data.current,
          explanation: trade.explanation || "",
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
    setAccuracy(computeAccuracy(trades));
  };

  const refreshPrices = async () => {
    setLoading(true);
    const updated: StockDisplay[] = [];

    for (const stock of stockData) {
      try {
        const data = await fetchStockData(stock.symbol);
        const newHit = updateHitStatus(
          {
            signal: stock.signal,
            stoploss: stock.stoploss,
            targets: stock.targets,
            confidence: stock.confidence,
            hitStatus: stock.hitStatus,
            explanation: stock.explanation,
            entryPrice: stock.entry,
            resolved: stock.resolved,
            finalPrice: stock.finalPrice,
          },
          data.current
        );

        updated.push({
          ...stock,
          price: data.current,
          hitStatus: newHit.hitStatus,
          resolved: newHit.resolved,
          finalPrice: newHit.finalPrice,
          explanation: newHit.explanation || "",
          justUpdated: true,
        });
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
    if (!q) return setSearchResults([]);
    setSearchResults(stockData.filter((st) => st.symbol.toLowerCase().includes(q)));
  };

  // Categorize results
  const indexes = stockData.filter((s) => s.symbol.startsWith("^"));
  const cryptos = stockData.filter((s) => s.symbol.includes("/USD"));
  const stocks = stockData.filter(
    (s) => !s.symbol.startsWith("^") && !s.symbol.includes("/USD")
  );

  const visibleData = searchResults.length ? searchResults : stockData;

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
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>📊 Indexes</Text>
          {indexes.map((s) => (
            <StockCard
              key={s.symbol}
              {...s}
              onPress={() => nav.navigate("Signal", { stock: s })}
              style={s.justUpdated ? styles.updatedCard : undefined}
            />
          ))}

          <Text style={styles.title}>🏦 Stocks</Text>
          {stocks.map((s) => (
            <StockCard
              key={s.symbol}
              {...s}
              onPress={() => nav.navigate("Signal", { stock: s })}
              style={s.justUpdated ? styles.updatedCard : undefined}
            />
          ))}

          <Text style={styles.title}>💎 Crypto</Text>
          {cryptos.map((s) => (
            <StockCard
              key={s.symbol}
              {...s}
              onPress={() => nav.navigate("Signal", { stock: s })}
              style={s.justUpdated ? styles.updatedCard : undefined}
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
  updatedCard: { borderWidth: 2, borderColor: "#0a8", borderRadius: 12 },
});

export default HomeScreen;
