import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, Crop, Download, X } from "lucide-react-native";
import { router } from "expo-router";
import { File, Paths } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as MediaLibrary from "expo-media-library";
import { useInventory } from "../inventory-context";
import { ImageSkeleton, LoadingImage } from "./loading-image";

type Target = { entityType: "room" | "item" | "receipt"; entityId: string; index: number };
type Box = { left: number; top: number; right: number; bottom: number };
type Edge = "left" | "right" | "top" | "bottom" | "tl" | "tr" | "bl" | "br";
const initialBox: Box = { left: .08, top: .08, right: .92, bottom: .92 };
const minimum = .08;

async function localImageUri(uri: string) {
  if (uri.startsWith("file:") || uri.startsWith("content:") || uri.startsWith("ph:")) return uri;
  const extension = new URL(uri).pathname.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
  const destination = new File(Paths.cache, `stuffhub-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`);
  return (await File.downloadFileAsync(uri, destination)).uri;
}

export function PhotoViewer({ uri, title = "Photo", target }: { uri: string; title?: string; target?: Target }) {
  const { replacePhoto } = useInventory();
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const [stage, setStage] = useState({ width: 1, height: 1 });
  const [cropMode, setCropMode] = useState(false);
  const [box, setBox] = useState<Box>(initialBox);
  const [workingAction, setWorkingAction] = useState<"crop" | "download" | null>(null);
  const [displayUri, setDisplayUri] = useState<string | null>(uri.startsWith("http") ? null : uri);
  const sourceFile = useRef<string | null>(uri.startsWith("http") ? null : uri);
  const boxRef = useRef(box); boxRef.current = box;
  useEffect(() => {
    let active = true;
    if (!uri) { setDisplayUri(null); sourceFile.current = null; return () => { active = false; }; }
    setDisplayUri(uri.startsWith("http") ? null : uri);
    sourceFile.current = uri.startsWith("http") ? null : uri;
    void localImageUri(uri).then((localUri) => {
      if (!active) return;
      sourceFile.current = localUri;
      setDisplayUri(localUri);
    }).catch((error) => { if (active) Alert.alert("Could not load photo", error instanceof Error ? error.message : "Please try again."); });
    return () => { active = false; };
  }, [uri]);
  useEffect(() => { if (displayUri) Image.getSize(displayUri, (width, height) => setDimensions({ width, height })); }, [displayUri]);
  const imageFrame = useMemo(() => {
    const scale = Math.min(stage.width / dimensions.width, stage.height / dimensions.height);
    const width = dimensions.width * scale; const height = dimensions.height * scale;
    return { width, height, left: (stage.width - width) / 2, top: (stage.height - height) / 2 };
  }, [dimensions, stage]);

  function responder(edge: Edge) {
    let start = initialBox;
    return PanResponder.create({ onStartShouldSetPanResponder: () => true, onPanResponderGrant: () => { start = boxRef.current; }, onPanResponderMove: (_event, gesture) => {
      const dx = gesture.dx / imageFrame.width; const dy = gesture.dy / imageFrame.height; const next = { ...start };
      if (edge.includes("l") || edge === "left") next.left = Math.max(0, Math.min(start.right - minimum, start.left + dx));
      if (edge.includes("r") || edge === "right") next.right = Math.min(1, Math.max(start.left + minimum, start.right + dx));
      if (edge.includes("t") || edge === "top") next.top = Math.max(0, Math.min(start.bottom - minimum, start.top + dy));
      if (edge.includes("b") || edge === "bottom") next.bottom = Math.min(1, Math.max(start.top + minimum, start.bottom + dy));
      setBox(next);
    }});
  }
  const responders = useMemo(() => ({ left: responder("left"), right: responder("right"), top: responder("top"), bottom: responder("bottom"), tl: responder("tl"), tr: responder("tr"), bl: responder("bl"), br: responder("br") }), [imageFrame.width, imageFrame.height]);

  async function croppedImage() {
    const localUri = sourceFile.current ?? await localImageUri(uri);
    return ImageManipulator.manipulateAsync(localUri, [{ crop: { originX: Math.round(dimensions.width * box.left), originY: Math.round(dimensions.height * box.top), width: Math.max(1, Math.round(dimensions.width * (box.right - box.left))), height: Math.max(1, Math.round(dimensions.height * (box.bottom - box.top))) } }], { compress: 1, format: ImageManipulator.SaveFormat.JPEG });
  }
  async function applyCrop() {
    if (!target) return Alert.alert("Crop unavailable", "This photo must be saved to an item or room before it can be cropped.");
    setWorkingAction("crop");
    try { const result = await croppedImage(); await replacePhoto(target.entityType, target.entityId, target.index, result.uri); setCropMode(false); router.back(); }
    catch (error) { Alert.alert("Could not crop photo", error instanceof Error ? error.message : "Please try again."); }
    finally { setWorkingAction(null); }
  }
  async function download() {
    setWorkingAction("download");
    try { const permission = await MediaLibrary.requestPermissionsAsync(); if (!permission.granted) throw new Error("Photo-library permission is required."); const localUri = sourceFile.current ?? await localImageUri(uri); await MediaLibrary.createAssetAsync(localUri); Alert.alert("Saved", "The image was saved to your photo library."); }
    catch (error) { Alert.alert("Could not save image", error instanceof Error ? error.message : "Please try again."); }
    finally { setWorkingAction(null); }
  }
  const cropRect = { left: imageFrame.left + box.left * imageFrame.width, top: imageFrame.top + box.top * imageFrame.height, width: (box.right - box.left) * imageFrame.width, height: (box.bottom - box.top) * imageFrame.height };
  const layout = (event: LayoutChangeEvent) => setStage(event.nativeEvent.layout);

  return <View style={styles.screen}><SafeAreaView style={styles.safe}>
    <View style={styles.header}><Pressable disabled={Boolean(workingAction)} style={styles.icon} onPress={() => cropMode ? setCropMode(false) : router.back()}>{cropMode ? <X color="white" size={22} /> : <Text style={styles.closeText}>×</Text>}</Pressable><Text style={styles.title} numberOfLines={1}>{cropMode ? "Adjust crop" : title}</Text><View style={styles.actions}>{cropMode ? <Pressable disabled={Boolean(workingAction)} style={styles.icon} onPress={() => void applyCrop()}>{workingAction === "crop" ? <ActivityIndicator color="white" /> : <Check color="white" size={21} />}</Pressable> : <><Pressable disabled={Boolean(workingAction)} style={styles.icon} onPress={() => { setBox(initialBox); setCropMode(true); }}><Crop color="white" size={20} /></Pressable><Pressable disabled={Boolean(workingAction)} style={styles.icon} onPress={() => void download()}>{workingAction === "download" ? <ActivityIndicator color="white" /> : <Download color="white" size={20} />}</Pressable></>}</View></View>
    <View style={styles.stage} onLayout={layout}>{displayUri ? <LoadingImage uri={displayUri} style={[styles.image, imageFrame]} resizeMode="contain" resizeMethod="scale" fadeDuration={0} dark /> : uri ? <View style={styles.viewerSkeleton}><ImageSkeleton dark /></View> : <Text style={styles.missing}>Photo not found.</Text>}
      {cropMode && displayUri ? <><View pointerEvents="none" style={[styles.shade, { left: imageFrame.left, top: imageFrame.top, width: imageFrame.width, height: cropRect.top - imageFrame.top }]} /><View pointerEvents="none" style={[styles.shade, { left: imageFrame.left, top: cropRect.top + cropRect.height, width: imageFrame.width, height: imageFrame.top + imageFrame.height - cropRect.top - cropRect.height }]} /><View pointerEvents="none" style={[styles.shade, { left: imageFrame.left, top: cropRect.top, width: cropRect.left - imageFrame.left, height: cropRect.height }]} /><View pointerEvents="none" style={[styles.shade, { left: cropRect.left + cropRect.width, top: cropRect.top, width: imageFrame.left + imageFrame.width - cropRect.left - cropRect.width, height: cropRect.height }]} />
        <View pointerEvents="none" style={[styles.cropBorder, cropRect]} />
        <View {...responders.left.panHandlers} style={[styles.edgeV, { left: cropRect.left - 16, top: cropRect.top + 20, height: cropRect.height - 40 }]} /><View {...responders.right.panHandlers} style={[styles.edgeV, { left: cropRect.left + cropRect.width - 16, top: cropRect.top + 20, height: cropRect.height - 40 }]} /><View {...responders.top.panHandlers} style={[styles.edgeH, { left: cropRect.left + 20, top: cropRect.top - 16, width: cropRect.width - 40 }]} /><View {...responders.bottom.panHandlers} style={[styles.edgeH, { left: cropRect.left + 20, top: cropRect.top + cropRect.height - 16, width: cropRect.width - 40 }]} />
        {(["tl","tr","bl","br"] as const).map((corner) => <View key={corner} {...responders[corner].panHandlers} style={[styles.handle, { left: corner.includes("l") ? cropRect.left - 18 : cropRect.left + cropRect.width - 18, top: corner.includes("t") ? cropRect.top - 18 : cropRect.top + cropRect.height - 18 }]} />)}</> : null}
    </View>{cropMode ? <Text style={styles.hint}>Drag any edge or corner, then tap ✓.</Text> : null}
    {workingAction ? <View style={styles.operationOverlay}><View style={styles.operationCard}><ActivityIndicator size="small" color="#234d3b" /><Text style={styles.operationTitle}>{workingAction === "crop" ? "Applying crop…" : "Saving image…"}</Text><Text style={styles.operationNote}>Working with the full-resolution photo.</Text></View></View> : null}
  </SafeAreaView></View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#09100c" }, safe: { flex: 1 }, header: { height: 62, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, actions: { flexDirection: "row", gap: 8 }, icon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "rgba(255,255,255,.12)" }, closeText: { color: "white", fontSize: 30, lineHeight: 32 }, title: { flex: 1, marginHorizontal: 12, color: "white", textAlign: "center", fontSize: 14, fontWeight: "800" }, stage: { flex: 1, position: "relative", alignItems: "center", justifyContent: "center", overflow: "hidden" }, image: { position: "absolute", borderRadius: 18 }, viewerSkeleton: { width: "88%", aspectRatio: 4 / 3, overflow: "hidden", borderRadius: 18, backgroundColor: "#26302b" }, missing: { color: "white" }, shade: { position: "absolute", backgroundColor: "rgba(0,0,0,.58)" }, cropBorder: { position: "absolute", borderWidth: 2, borderColor: "white" }, edgeV: { position: "absolute", width: 32 }, edgeH: { position: "absolute", height: 32 }, handle: { position: "absolute", width: 36, height: 36, borderWidth: 4, borderColor: "white", borderRadius: 18, backgroundColor: "rgba(35,77,59,.35)" }, hint: { paddingVertical: 12, color: "white", textAlign: "center", fontSize: 12 }, operationOverlay: { position: "absolute", zIndex: 20, top: 62, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(9,16,12,.46)" }, operationCard: { minWidth: 210, paddingHorizontal: 24, paddingVertical: 19, alignItems: "center", borderRadius: 18, backgroundColor: "#f4f1e9", shadowColor: "#000", shadowOpacity: .24, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }, operationTitle: { marginTop: 10, color: "#17211b", fontFamily: "Georgia", fontSize: 17 }, operationNote: { marginTop: 5, color: "#657069", fontSize: 10 } });
