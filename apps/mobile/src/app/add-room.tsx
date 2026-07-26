import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useInventory } from "../inventory-context";

const commonRooms = ["Living room", "Kitchen", "Bedroom", "Bathroom", "Dining room", "Garage", "Office", "Basement"];

export default function AddRoomScreen() {
  const { addRoom } = useInventory();
  const [name, setName] = useState("");

  function saveRoom() {
    if (!name.trim()) return;
    const room = addRoom(name);
    router.replace({ pathname: "/room/[id]", params: { id: room.id } });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}><Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable><Text style={styles.headerTitle}>Add a room</Text><View style={styles.headerSpacer} /></View>
          <Text style={styles.eyebrow}>BUILD YOUR INVENTORY</Text>
          <Text style={styles.title}>Which room are you documenting?</Text>
          <Text style={styles.copy}>Choose a common room or enter a name that fits your home.</Text>
          <View style={styles.options}>
            {commonRooms.map((roomName) => (
              <Pressable key={roomName} style={[styles.option, name === roomName && styles.optionSelected]} onPress={() => setName(roomName)}>
                <Text style={[styles.optionText, name === roomName && styles.optionTextSelected]}>{roomName}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>CUSTOM ROOM NAME</Text>
          <TextInput value={name} onChangeText={setName} placeholder="For example, music room" placeholderTextColor="#9a9f9b" style={styles.input} returnKeyType="done" onSubmitEditing={saveRoom} />
          <Pressable disabled={!name.trim()} style={[styles.saveButton, !name.trim() && styles.saveButtonDisabled]} onPress={saveRoom}><Text style={styles.saveButtonText}>Add room</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: "#f4f1e9" }, content: { padding: 24, paddingBottom: 50 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 46 }, back: { color: "#17211b", fontSize: 42, lineHeight: 42 }, headerTitle: { color: "#17211b", fontWeight: "800", fontSize: 14 }, headerSpacer: { width: 24 },
  eyebrow: { color: "#234d3b", fontWeight: "800", fontSize: 10, letterSpacing: 1.6, marginBottom: 10 }, title: { color: "#17211b", fontFamily: "Georgia", fontSize: 38, lineHeight: 42, letterSpacing: -1, marginBottom: 14 }, copy: { color: "#657069", fontSize: 15, lineHeight: 22, marginBottom: 26 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 30 }, option: { paddingHorizontal: 15, paddingVertical: 12, borderRadius: 22, borderWidth: 1, borderColor: "#d2d0c8", backgroundColor: "#fffdf8" }, optionSelected: { borderColor: "#234d3b", backgroundColor: "#dce9df" }, optionText: { color: "#4f5953", fontSize: 13, fontWeight: "700" }, optionTextSelected: { color: "#234d3b" },
  label: { color: "#657069", fontSize: 10, fontWeight: "800", letterSpacing: 1.3, marginBottom: 9 }, input: { height: 54, borderWidth: 1, borderColor: "#d2d0c8", borderRadius: 12, backgroundColor: "#fffdf8", paddingHorizontal: 16, color: "#17211b", fontSize: 16, marginBottom: 18 },
  saveButton: { height: 52, borderRadius: 12, backgroundColor: "#234d3b", alignItems: "center", justifyContent: "center" }, saveButtonDisabled: { opacity: 0.35 }, saveButtonText: { color: "white", fontWeight: "800", fontSize: 15 },
});
