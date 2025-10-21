import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, Animated } from "react-native";

interface Props {
  symbol: string;
  price: number;
  signal: "BUY" | "SELL" | "HOLD";
  stoploss: number;
  targets: number[];
  confidence: number;
  explanation: string;
  hitStatus?: "ACTIVE" | "TARGET ✅" | "STOP ❌";
  onPress?: () => void;
  style?: ViewStyle;
}

const SignalColor = (s: Props["signal"]) =>
  s === "BUY" ? "#0a8" : s === "SELL" ? "#e53" : "#888";

const StockCard: React.FC<Props> = ({
  symbol,
  price,
  signal,
  stoploss,
  targets,
  confidence,
  explanation,
  hitStatus = "ACTIVE",
  onPress,
  style,
}) => {
  const animatedWidth = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  // Animate confidence bar
  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: confidence,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [confidence]);

  // Flash card on target/stop hit
  useEffect(() => {
    if (hitStatus === "TARGET ✅") {
      flash("#0a8"); // green flash
    } else if (hitStatus === "STOP ❌") {
      flash("#e53"); // red flash
    }
  }, [hitStatus]);

  const flash = (color: string) => {
    flashAnim.setValue(1);
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
    ]).start();
  };

  const flashBackground = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#fff", hitStatus === "TARGET ✅" ? "#d4ffd4" : "#ffd4d4"],
  });

  const widthInterpolate = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  const stopLabel = signal === "BUY" ? "Support" : signal === "SELL" ? "Resistance" : "Stop";

  return (
    <Animated.View style={[styles.card, style, { backgroundColor: flashBackground }]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        <View style={styles.row}>
          <Text style={styles.symbol}>{symbol}</Text>
          <View style={[styles.badge, { backgroundColor: SignalColor(signal) }]} />
        </View>

        <Text style={styles.price}>₹{Number(price).toFixed(2)}</Text>

        {/* Animated Confidence / Health Bar */}
        <View style={styles.healthBarContainer}>
          <Animated.View
            style={[styles.healthBarFill, { width: widthInterpolate, backgroundColor: SignalColor(signal) }]}
          />
        </View>

        <View style={styles.rowSmall}>
          <Text style={styles.small}>
            {stopLabel}: ₹{Number(stoploss).toFixed(2)}
          </Text>
          <Text style={styles.small}>Status: {hitStatus}</Text>
        </View>

        <View style={styles.targetsRow}>
          {targets.map((t, i) => {
            let label = "T" + (i + 1);
            if (signal === "BUY") label = "R" + (i + 1);
            else if (signal === "SELL") label = "S" + (i + 1);
            return (
              <Text key={i} style={styles.target}>
                {label}: ₹{Number(t).toFixed(2)}
              </Text>
            );
          })}
        </View>

        <Text style={styles.explain} numberOfLines={2}>
          {explanation}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowSmall: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  symbol: { fontSize: 16, fontWeight: "700" },
  price: { fontSize: 20, fontWeight: "700", marginTop: 8 },
  badge: { width: 24, height: 24, borderRadius: 12 },
  small: { color: "#444" },
  targetsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  target: { fontSize: 12 },
  explain: { marginTop: 8, color: "#555" },
  healthBarContainer: {
    height: 6,
    width: "100%",
    backgroundColor: "#eee",
    borderRadius: 3,
    marginTop: 6,
  },
  healthBarFill: {
    height: "100%",
    borderRadius: 3,
  },
});

export default StockCard;
