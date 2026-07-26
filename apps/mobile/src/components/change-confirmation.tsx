import { Check } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface ChangeNotice { id: number; message: string }

export function ChangeConfirmation({ notice }: { notice: ChangeNotice | null }) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const checkProgress = useRef(new Animated.Value(0)).current;
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion); const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion); return () => subscription.remove(); }, []);
  useEffect(() => {
    if (!notice) return;
    progress.stopAnimation(); checkProgress.stopAnimation();
    progress.setValue(0); checkProgress.setValue(0);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(progress, { toValue: 1, duration: reducedMotion ? 100 : 170, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        reducedMotion ? Animated.timing(checkProgress, { toValue: 1, duration: 100, useNativeDriver: true }) : Animated.sequence([Animated.delay(35), Animated.spring(checkProgress, { toValue: 1, speed: 24, bounciness: 8, useNativeDriver: true })]),
      ]),
      Animated.delay(1500),
      Animated.timing(progress, { toValue: 0, duration: reducedMotion ? 100 : 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [checkProgress, notice, progress, reducedMotion]);
  if (!notice) return null;
  return <Animated.View pointerEvents="none" accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.notice, { top: insets.top + 10, opacity: progress, transform: [{ translateY: reducedMotion ? 0 : progress.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }, { scale: reducedMotion ? 1 : progress.interpolate({ inputRange: [0, 1], outputRange: [.98, 1] }) }] }]}>
    <Animated.View style={[styles.icon, { opacity: checkProgress, transform: [{ scale: reducedMotion ? 1 : checkProgress.interpolate({ inputRange: [0, .72, 1], outputRange: [.35, 1.12, 1] }) }, { rotate: reducedMotion ? "0deg" : checkProgress.interpolate({ inputRange: [0, 1], outputRange: ["-18deg", "0deg"] }) }] }]}><Check size={14} color="white" strokeWidth={2.8} /></Animated.View><Text numberOfLines={1} style={styles.text}>{notice.message}</Text>
  </Animated.View>;
}

const styles = StyleSheet.create({ notice: { position: "absolute", zIndex: 1000, alignSelf: "center", maxWidth: "72%", minHeight: 38, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#a9c8b3", borderRadius: 20, backgroundColor: "#fffdf8", shadowColor: "#0d1711", shadowOpacity: .14, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 10 }, icon: { width: 23, height: 23, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#3f8b61" }, text: { flexShrink: 1, color: "#17211b", fontSize: 11, fontWeight: "800" } });
