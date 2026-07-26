import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useInventory } from "../inventory-context";

export default function CaptureScreen() {
  const cameraRef = useRef<CameraView>(null);
  const { roomId = "", roomName = "Room" } = useLocalSearchParams<{ roomId?: string; roomName?: string }>();
  const { addPhoto } = useInventory();
  const [permission, requestPermission] = useCameraPermissions();
  const [photoCount, setPhotoCount] = useState(0);
  const [capturing, setCapturing] = useState(false);

  if (!permission) return <View style={styles.permission} />;
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permission}>
        <Text style={styles.permissionTitle}>Photograph your room</Text>
        <Text style={styles.permissionCopy}>StuffHub needs camera access to document your belongings. Photos stay under your control.</Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}><Text style={styles.permissionButtonText}>Allow camera access</Text></Pressable>
        <Pressable onPress={() => router.back()}><Text style={styles.cancel}>Not now</Text></Pressable>
      </SafeAreaView>
    );
  }

  async function capturePhoto() {
    if (capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 1 });
      if (photo && roomId) await addPhoto(roomId, photo.uri);
      if (photo) setPhotoCount((count) => count + 1);
    } catch (error) {
      Alert.alert("Could not save photo", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setCapturing(false);
    }
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      <SafeAreaView style={styles.overlay}>
        <View style={styles.topRow}><Pressable onPress={() => router.back()}><Text style={styles.close}>×</Text></Pressable><View><Text style={styles.roomLabel}>{roomName.toUpperCase()}</Text><Text style={styles.instruction}>Capture every wall</Text></View><View style={styles.counter}><Text style={styles.counterText}>{photoCount}</Text></View></View>
        <View style={styles.guide}><View style={styles.cornerTopLeft} /><View style={styles.cornerTopRight} /><View style={styles.cornerBottomLeft} /><View style={styles.cornerBottomRight} /></View>
        <View style={styles.bottomArea}>
          <Text style={styles.hint}>{capturing ? "Saving full-quality photo…" : "Move slowly and overlap each photo a little."}</Text>
          <View style={styles.controls}><View style={styles.controlSpacer} /><Pressable disabled={capturing} style={[styles.shutterOuter, capturing && styles.shutterBusy]} onPress={capturePhoto}>{capturing ? <ActivityIndicator color="white" /> : <View style={styles.shutterInner} />}</Pressable><Pressable disabled={capturing} style={[styles.done, capturing && styles.doneDisabled]} onPress={() => router.back()}><Text style={styles.doneText}>Done</Text></Pressable></View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  overlay: { flex: 1, justifyContent: "space-between", backgroundColor: "rgba(0,0,0,.12)" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8 },
  close: { width: 42, color: "white", fontSize: 36, fontWeight: "200" },
  roomLabel: { color: "rgba(255,255,255,.75)", textAlign: "center", fontWeight: "800", fontSize: 9, letterSpacing: 1.5 },
  instruction: { color: "white", fontFamily: "Georgia", fontSize: 19, marginTop: 4 },
  counter: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,.48)", alignItems: "center", justifyContent: "center" },
  counterText: { color: "white", fontWeight: "800" },
  guide: { alignSelf: "center", width: "82%", height: "49%" },
  cornerTopLeft: { position: "absolute", top: 0, left: 0, width: 34, height: 34, borderTopWidth: 2, borderLeftWidth: 2, borderColor: "white" },
  cornerTopRight: { position: "absolute", top: 0, right: 0, width: 34, height: 34, borderTopWidth: 2, borderRightWidth: 2, borderColor: "white" },
  cornerBottomLeft: { position: "absolute", bottom: 0, left: 0, width: 34, height: 34, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: "white" },
  cornerBottomRight: { position: "absolute", bottom: 0, right: 0, width: 34, height: 34, borderBottomWidth: 2, borderRightWidth: 2, borderColor: "white" },
  bottomArea: { padding: 22, paddingBottom: 30, backgroundColor: "rgba(0,0,0,.48)" },
  hint: { color: "white", textAlign: "center", fontSize: 12, marginBottom: 20 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  controlSpacer: { width: 54 },
  shutterOuter: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: "white", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: "white" },
  shutterBusy: { backgroundColor: "rgba(35,77,59,.58)" },
  done: { width: 54, height: 40, alignItems: "center", justifyContent: "center" },
  doneText: { color: "white", fontWeight: "800" },
  doneDisabled: { opacity: .4 },
  permission: { flex: 1, padding: 30, alignItems: "center", justifyContent: "center", backgroundColor: "#f4f1e9" },
  permissionTitle: { color: "#17211b", fontFamily: "Georgia", fontSize: 34, marginBottom: 14 },
  permissionCopy: { color: "#657069", textAlign: "center", fontSize: 15, lineHeight: 23, marginBottom: 25 },
  permissionButton: { width: "78%", maxWidth: 310, minWidth: 220, height: 52, borderRadius: 12, backgroundColor: "#234d3b", alignItems: "center", justifyContent: "center" },
  permissionButtonText: { color: "white", fontWeight: "800" },
  cancel: { color: "#657069", marginTop: 22, fontWeight: "700" },
});
