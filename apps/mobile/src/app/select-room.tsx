import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useInventory } from "../inventory-context";

export default function SelectRoomScreen() {
  const { rooms } = useInventory();
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}><Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable><Text style={styles.headerTitle}>Choose a room</Text><View style={styles.spacer} /></View>
        <Text style={styles.title}>Where are you taking photos?</Text>
        <Text style={styles.copy}>Photos will be grouped with the selected room.</Text>
        {rooms.map((room) => <Pressable key={room.id} style={styles.room} onPress={() => router.push({ pathname: "/capture", params: { roomId: room.id, roomName: room.name } })}><View style={styles.initial}><Text style={styles.initialText}>{room.name[0]}</Text></View><View style={styles.details}><Text style={styles.name}>{room.name}</Text><Text style={styles.meta}>{room.photoCount ? `${room.photoCount} photos` : "No photos yet"}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}
        <Pressable style={styles.add} onPress={() => router.push("/add-room")}><Text style={styles.addText}>＋ Add a different room</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safeArea: { flex: 1, backgroundColor: "#f4f1e9" }, content: { padding: 24, paddingBottom: 44 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 50 }, back: { fontSize: 42, lineHeight: 42, color: "#17211b" }, headerTitle: { fontWeight: "800", fontSize: 14, color: "#17211b" }, spacer: { width: 24 }, title: { color: "#17211b", fontFamily: "Georgia", fontSize: 38, lineHeight: 42, marginBottom: 12 }, copy: { color: "#657069", fontSize: 15, marginBottom: 28 }, room: { flexDirection: "row", alignItems: "center", minHeight: 82, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#dedbd1", borderRadius: 14, backgroundColor: "#fffdf8" }, initial: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#dce9df", marginRight: 14 }, initialText: { color: "#234d3b", fontFamily: "Georgia", fontSize: 20 }, details: { flex: 1 }, name: { color: "#17211b", fontFamily: "Georgia", fontSize: 18, marginBottom: 4 }, meta: { color: "#657069", fontSize: 11 }, chevron: { color: "#879089", fontSize: 26 }, add: { height: 52, marginTop: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#234d3b", borderRadius: 12 }, addText: { color: "#234d3b", fontWeight: "800" } });
