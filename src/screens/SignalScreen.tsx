// screens/SignalScreen.tsx
import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { getSubscription } from "../utils/subscription";

type ParamList = {
  Signal: { stock: { symbol: string; price: number; signal: string; explanation: string; stoploss: number; targets: number[]; confidence: number } };
};

const SignalScreen: React.FC = () => {
  const route = useRoute<RouteProp<ParamList, "Signal">>();
  const { stock } = route.params;
  const subscription = getSubscription();

  return (
    <View style={styles.container}>
      <Text style={styles.symbol}>{stock.symbol}</Text>
      <Text style={styles.price}>₹{Number(stock.price).toFixed(2)}</Text>
      <Text style={styles.signal}>Signal: {stock.explanation} ({stock.confidence}%)</Text>

      <Text style={styles.heading}>Price Can Move towards</Text>
      {stock.targets.map((t, i) => (
        <Text key={i} style={styles.target}>T{i + 1}: ₹{Number(t).toFixed(2)}</Text>
      ))}

      <Text style={styles.heading}>Reverse</Text>
      <Text style={styles.target}>₹{Number(stock.stoploss).toFixed(2)}</Text>

      {subscription === "Pro" ? (
        <>
          <Text style={styles.heading}>Explanation</Text>
          <Text style={styles.explain}>{stock.explanation}</Text>
        </>
      ) : (
        <Button title="Upgrade to Pro to see detailed explanation" onPress={() => {}} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  symbol: { fontSize: 28, fontWeight: "800" },
  price: { fontSize: 20, marginVertical: 8 },
  signal: { fontSize: 18, marginBottom: 12 },
  heading: { fontSize: 16, fontWeight: "700", marginTop: 12 },
  target: { fontSize: 14, marginTop: 6 },
  explain: { marginTop: 8, color: "#333" },
});

export default SignalScreen;
