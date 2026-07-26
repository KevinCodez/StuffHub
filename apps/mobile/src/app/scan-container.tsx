import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Box, Check, Flashlight, FlashlightOff, RotateCcw, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { resolveContainerLabel } from "../backend-api";
import { useInventory } from "../inventory-context";
import { TappablePhoto } from "../components/tappable-photo";

type ScanState = "idle" | "lookup" | "success" | "invalid" | "unknown" | "error";
const FRAME_SIZE = 272;

export default function ScanContainerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>("idle");
  const [torch, setTorch] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);
  const guard = useRef(false);
  const insets = useSafeAreaInsets();
  const { containers, rooms, findItem } = useInventory();

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => subscription.remove();
  }, []);

  const reset = () => { guard.current = false; setResultId(null); setState("idle"); };
  const scan = async ({ data }: BarcodeScanningResult) => {
    if (guard.current || state !== "idle") return;
    guard.current = true;
    if (!/^stuffhub:\/\/container\/[0-9a-f-]+$/i.test(data)) { setState("invalid"); return; }
    setState("lookup");
    const local = containers.find((entry) => entry.label?.payload === data);
    try {
      const containerId = local?.id ?? await resolveContainerLabel(data);
      setResultId(containerId);
      setState("success");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setState(/not found/i.test(message) ? "unknown" : "error");
    }
  };

  if (!permission) return <SafeAreaView style={styles.permissionPage}><Text style={styles.permissionCopy}>Preparing camera…</Text></SafeAreaView>;
  if (!permission.granted) return <PermissionState canAskAgain={permission.canAskAgain} onRequest={() => void requestPermission()} onClose={() => router.back()} />;

  const container = resultId ? containers.find((entry) => entry.id === resultId) : undefined;
  const room = container ? rooms.find((entry) => entry.id === container.roomId) : undefined;
  const previewPhoto = container?.itemIds.map(findItem).find((item) => item?.photoUris?.[0])?.photoUris?.[0];
  const busy = state === "lookup" || state === "success";

  return <View style={styles.cameraPage}>
    <CameraView style={StyleSheet.absoluteFill} enableTorch={torch} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={guard.current ? undefined : (result) => void scan(result)} />
    <CameraMask softened={state === "success"} />
    <View style={[styles.centerStage, { top: "50%", marginTop: -FRAME_SIZE / 2 }]} pointerEvents="none">
      <ScannerFrame state={state} reducedMotion={reducedMotion} />
      <Text style={styles.guidance}>{state === "lookup" ? "Checking this label…" : state === "success" ? "Container found" : "Align the QR code within the frame."}</Text>
    </View>
    <SafeAreaView style={styles.overlay} pointerEvents="box-none">
      <ScannerHeader topInset={insets.top} torch={torch} onToggleTorch={() => setTorch((value) => !value)} onClose={() => router.back()} />
      {state === "invalid" || state === "unknown" || state === "error" ? <FailureCard state={state} onRetry={reset} onClose={() => router.back()} /> : null}
      {state === "success" ? <ResultSheet reducedMotion={reducedMotion} name={container?.name ?? "Container found"} location={room?.name ?? "Your home"} photoUri={previewPhoto} onOpen={() => resultId && router.push({ pathname: "/container/[id]", params: { id: resultId } })} onScanAgain={reset} /> : null}
      {busy && state !== "success" ? <View style={styles.lookupPill}><Text style={styles.lookupText}>Looking up container</Text><AnimatedDots /></View> : null}
    </SafeAreaView>
  </View>;
}

function ScannerHeader({ topInset, torch, onToggleTorch, onClose }: { topInset: number; torch: boolean; onToggleTorch: () => void; onClose: () => void }) {
  return <View style={[styles.header, { top: topInset + 10 }]}><Pressable style={styles.roundControl} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close scanner"><X size={22} color="white" /></Pressable><View><Text style={styles.eyebrow}>STUFFHUB</Text><Text style={styles.heading}>Scan container</Text></View><Pressable style={[styles.roundControl, torch && styles.roundControlActive]} onPress={onToggleTorch} accessibilityRole="button" accessibilityLabel={torch ? "Turn flashlight off" : "Turn flashlight on"}>{torch ? <FlashlightOff size={21} color="#17211b" /> : <Flashlight size={21} color="white" />}</Pressable></View>;
}

function CameraMask({ softened }: { softened: boolean }) {
  const { width, height } = useWindowDimensions();
  const shade = softened ? "rgba(9,14,11,.78)" : "rgba(9,14,11,.58)";
  const x = (width - FRAME_SIZE) / 2; const y = (height - FRAME_SIZE) / 2; const right = x + FRAME_SIZE; const bottom = y + FRAME_SIZE; const radius = 24;
  const maskPath = `M0 0H${width}V${height}H0Z M${x + radius} ${y}H${right - radius}Q${right} ${y} ${right} ${y + radius}V${bottom - radius}Q${right} ${bottom} ${right - radius} ${bottom}H${x + radius}Q${x} ${bottom} ${x} ${bottom - radius}V${y + radius}Q${x} ${y} ${x + radius} ${y}Z`;
  return <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none"><Path d={maskPath} fill={shade} fillRule="evenodd" /></Svg>;
}

function ScannerFrame({ state, reducedMotion }: { state: ScanState; reducedMotion: boolean }) {
  const breath = useRef(new Animated.Value(0)).current;
  const line = useRef(new Animated.Value(0)).current;
  const lock = useRef(new Animated.Value(0)).current;
  const success = state === "success";
  useEffect(() => {
    if (reducedMotion || state !== "idle") { breath.stopAnimation(); line.stopAnimation(); return; }
    const breathing = Animated.loop(Animated.sequence([Animated.timing(breath, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }), Animated.timing(breath, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true })]));
    const scanning = Animated.loop(Animated.sequence([Animated.timing(line, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }), Animated.delay(650), Animated.timing(line, { toValue: 0, duration: 0, useNativeDriver: true })]));
    breathing.start(); scanning.start(); return () => { breathing.stop(); scanning.stop(); };
  }, [breath, line, reducedMotion, state]);
  useEffect(() => { Animated.spring(lock, { toValue: success ? 1 : 0, speed: 24, bounciness: 3, useNativeDriver: true }).start(); }, [lock, success]);
  const scale = success ? lock.interpolate({ inputRange: [0, 1], outputRange: [1, .92] }) : reducedMotion ? 1 : breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] });
  const color = success ? "#78c694" : "rgba(255,255,255,.96)";
  return <Animated.View style={[styles.frame, { transform: [{ scale }] }]} accessible accessibilityLabel={success ? "QR code recognized" : "QR scanning area"}>
    {(["tl", "tr", "bl", "br"] as const).map((corner) => <View key={corner} style={[styles.corner, styles[corner], { borderColor: color }]} />)}
    {!success && state === "idle" ? <Animated.View style={[styles.scanLine, { opacity: reducedMotion ? .35 : .5, transform: [{ translateY: reducedMotion ? 0 : line.interpolate({ inputRange: [0, 1], outputRange: [-105, 105] }) }] }]} /> : null}
    {success ? <Animated.View style={[styles.successMark, { opacity: lock, transform: [{ scale: lock }] }]}><Check size={42} color="white" strokeWidth={2.6} /></Animated.View> : null}
  </Animated.View>;
}

function ResultSheet({ reducedMotion, name, location, photoUri, onOpen, onScanAgain }: { reducedMotion: boolean; name: string; location: string; photoUri?: string; onOpen: () => void; onScanAgain: () => void }) {
  const reveal = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_, gesture) => dragY.setValue(gesture.dy),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 56) { Animated.timing(dragY, { toValue: 360, duration: 160, useNativeDriver: true }).start(onScanAgain); return; }
      if (gesture.dy < -56) { Animated.timing(dragY, { toValue: -120, duration: 140, useNativeDriver: true }).start(onOpen); return; }
      Animated.spring(dragY, { toValue: 0, speed: 24, bounciness: 4, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start(),
  })).current;
  useEffect(() => { Animated.timing(reveal, { toValue: 1, duration: reducedMotion ? 120 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, [reducedMotion, reveal]);
  const entranceY = reveal.interpolate({ inputRange: [0, 1], outputRange: [reducedMotion ? 0 : 55, 0] });
  return <Animated.View {...pan.panHandlers} style={[styles.resultSheet, { opacity: reveal, transform: [{ translateY: Animated.add(entranceY, dragY) }] }]}> 
    <View style={styles.resultHandle} accessible accessibilityLabel="Swipe up to open the container or down to scan another label" /><View style={styles.previewRow}>{photoUri ? <TappablePhoto uri={photoUri} title={name} style={styles.previewImage} /> : <View style={styles.previewPlaceholder}><Box size={27} color="#234d3b" /></View>}<View style={styles.previewCopy}><Text style={styles.resultEyebrow}>CONTAINER FOUND</Text><Text style={styles.resultName}>{name}</Text><Text style={styles.resultLocation}>{location}</Text></View></View>
    <Pressable style={styles.primaryButton} onPress={onOpen}><Text style={styles.primaryText}>Open container</Text></Pressable><Pressable style={styles.secondaryButton} onPress={onScanAgain}><RotateCcw size={16} color="#234d3b" /><Text style={styles.secondaryText}>Scan another label</Text></Pressable>
  </Animated.View>;
}

function FailureCard({ state, onRetry, onClose }: { state: "invalid" | "unknown" | "error"; onRetry: () => void; onClose: () => void }) {
  const copy = state === "invalid" ? ["Not a StuffHub label", "Use a QR label created for a StuffHub container."] : state === "unknown" ? ["Container not found", "This label is not active in your home inventory."] : ["Couldn’t check the label", "Check your connection and try scanning again."];
  return <View style={styles.failureCard}><Text style={styles.failureTitle}>{copy[0]}</Text><Text style={styles.failureCopy}>{copy[1]}</Text><View style={styles.failureActions}><Pressable style={styles.retryButton} onPress={onRetry}><RotateCcw size={16} color="white" /><Text style={styles.retryText}>Scan again</Text></Pressable><Pressable onPress={onClose}><Text style={styles.closeLink}>Close</Text></Pressable></View></View>;
}

function AnimatedDots() { return <Text style={styles.dots}>•••</Text>; }

function PermissionState({ canAskAgain, onRequest, onClose }: { canAskAgain: boolean; onRequest: () => void; onClose: () => void }) {
  return <SafeAreaView style={styles.permissionPage}><View style={styles.permissionIcon}><Box size={27} color="#234d3b" /></View><Text style={styles.permissionTitle}>Scan a container label</Text><Text style={styles.permissionCopy}>{canAskAgain ? "Camera access lets StuffHub recognize the private QR labels on your containers." : "Camera access is disabled. Enable it in your device settings to scan labels."}</Text>{canAskAgain ? <Pressable style={styles.permissionButton} onPress={onRequest}><Text style={styles.primaryText}>Allow camera access</Text></Pressable> : null}<Pressable onPress={onClose}><Text style={styles.permissionCancel}>Not now</Text></Pressable></SafeAreaView>;
}

const styles = StyleSheet.create({
  cameraPage: { flex: 1, backgroundColor: "#09100c" }, overlay: { flex: 1 }, header: { position: "absolute", zIndex: 4, top: 12, left: 22, right: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, roundControl: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.25)", borderRadius: 23, backgroundColor: "rgba(9,16,12,.6)" }, roundControlActive: { borderColor: "white", backgroundColor: "white" }, eyebrow: { color: "rgba(255,255,255,.65)", textAlign: "center", fontSize: 8, fontWeight: "800", letterSpacing: 1.6 }, heading: { marginTop: 3, color: "white", fontFamily: "Georgia", fontSize: 19 }, centerStage: { position: "absolute", top: "24%", left: 0, right: 0, alignItems: "center" }, frame: { width: FRAME_SIZE, height: FRAME_SIZE, alignItems: "center", justifyContent: "center" }, corner: { position: "absolute", width: 48, height: 48, borderWidth: 0 }, tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 24 }, tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 24 }, bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 24 }, br: { right: 0, bottom: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 24 }, scanLine: { width: FRAME_SIZE - 38, height: 1, backgroundColor: "rgba(255,255,255,.85)", shadowColor: "white", shadowOpacity: .65, shadowRadius: 5 }, successMark: { width: 76, height: 76, alignItems: "center", justifyContent: "center", borderRadius: 38, backgroundColor: "#3f8b61" }, guidance: { marginTop: 26, paddingHorizontal: 17, paddingVertical: 10, overflow: "hidden", borderRadius: 18, color: "white", backgroundColor: "rgba(9,16,12,.62)", fontSize: 12, fontWeight: "700" }, maskTop: { flex: 1 }, maskMiddle: { height: FRAME_SIZE, flexDirection: "row" }, maskSide: { flex: 1 }, clearWindow: { width: FRAME_SIZE }, maskBottom: { flex: 1 }, lookupPill: { position: "absolute", bottom: 48, alignSelf: "center", paddingHorizontal: 18, height: 42, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 21, backgroundColor: "rgba(9,16,12,.78)" }, lookupText: { color: "white", fontSize: 11, fontWeight: "700" }, dots: { color: "#78c694", letterSpacing: 2 }, resultSheet: { position: "absolute", right: 14, bottom: 14, left: 14, padding: 20, borderRadius: 24, backgroundColor: "#fffdf8", shadowColor: "#000", shadowOpacity: .25, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 12 }, resultHandle: { width: 38, height: 4, alignSelf: "center", marginBottom: 18, borderRadius: 2, backgroundColor: "#d2d0c8" }, previewRow: { flexDirection: "row", alignItems: "center", marginBottom: 18 }, previewImage: { width: 68, height: 68, marginRight: 14, borderRadius: 14 }, previewPlaceholder: { width: 68, height: 68, marginRight: 14, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#dce9df" }, previewCopy: { flex: 1 }, resultEyebrow: { color: "#3f8b61", fontSize: 8, fontWeight: "800", letterSpacing: 1.3 }, resultName: { marginTop: 4, color: "#17211b", fontFamily: "Georgia", fontSize: 24 }, resultLocation: { marginTop: 4, color: "#657069", fontSize: 11 }, primaryButton: { height: 50, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#234d3b" }, primaryText: { color: "white", fontWeight: "800", fontSize: 13 }, secondaryButton: { height: 44, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" }, secondaryText: { color: "#234d3b", fontWeight: "800", fontSize: 12 }, failureCard: { position: "absolute", right: 18, bottom: 24, left: 18, padding: 22, borderRadius: 20, backgroundColor: "#fffdf8" }, failureTitle: { color: "#17211b", fontFamily: "Georgia", fontSize: 23 }, failureCopy: { marginTop: 7, color: "#657069", fontSize: 12, lineHeight: 18 }, failureActions: { marginTop: 17, flexDirection: "row", alignItems: "center", gap: 20 }, retryButton: { height: 45, paddingHorizontal: 17, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 11, backgroundColor: "#234d3b" }, retryText: { color: "white", fontWeight: "800", fontSize: 12 }, closeLink: { color: "#657069", fontWeight: "800", fontSize: 12 }, permissionPage: { flex: 1, padding: 30, alignItems: "center", justifyContent: "center", backgroundColor: "#f4f1e9" }, permissionIcon: { width: 64, height: 64, marginBottom: 22, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#dce9df" }, permissionTitle: { color: "#17211b", fontFamily: "Georgia", fontSize: 34, textAlign: "center" }, permissionCopy: { maxWidth: 320, marginVertical: 16, color: "#657069", fontSize: 14, lineHeight: 21, textAlign: "center" }, permissionButton: { minWidth: 220, height: 50, marginTop: 10, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#234d3b" }, permissionCancel: { marginTop: 22, color: "#234d3b", fontWeight: "800" },
});
