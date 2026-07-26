import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Camera, Images, X } from "lucide-react-native";
import { useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useInventory } from "../inventory-context";
import { TappablePhoto } from "../components/tappable-photo";
import { CurrencyField, DateField } from "../components/form-fields";

const categories = ["Electronics", "Furniture", "Appliances", "Jewelry", "Collectibles", "Tools", "Clothing", "Other"];

function currencyToCents(value: string) {
  const number = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

export default function AddItemScreen() {
  const { roomId = "", itemId = "" } = useLocalSearchParams<{ roomId?: string; itemId?: string }>();
  const { addItem, updateItem, moveItem, deleteItem, findItem, findRoom, rooms, containers, receipts, addRoom, addReceipt, addWarranty, attachReceiptToItem } = useInventory();
  const existingItem = findItem(itemId);
  const [selectedRoomId, setSelectedRoomId] = useState(existingItem?.roomId ?? roomId ?? rooms[0]?.id ?? "");
  const room = findRoom(selectedRoomId);
  const [name, setName] = useState(existingItem?.name ?? "");
  const [ownerName, setOwnerName] = useState(existingItem?.ownerName ?? "");
  const ownerNames = Array.from(new Set([...rooms.flatMap((entry) => entry.items).map((item) => item.ownerName), ...containers.map((container) => container.ownerName)].filter((owner): owner is string => Boolean(owner)))).sort();
  const [category, setCategory] = useState(existingItem?.category ?? "Other");
  const [value, setValue] = useState(existingItem ? (existingItem.estimatedReplacementValueCents / 100).toString() : "");
  const [purchaseYear, setPurchaseYear] = useState(existingItem?.purchaseYear?.toString() ?? "");
  const [serialNumber, setSerialNumber] = useState(existingItem?.serialNumber ?? "");
  const [description, setDescription] = useState(existingItem?.description ?? "");
  const initialPhotoUris = existingItem?.photoUris ?? [];
  const [photoUris, setPhotoUris] = useState<string[]>(initialPhotoUris);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [showWarranty, setShowWarranty] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [warrantyComplete, setWarrantyComplete] = useState(false);
  const [receiptComplete, setReceiptComplete] = useState(false);
  const [warrantyProvider, setWarrantyProvider] = useState(""); const [warrantyPolicy, setWarrantyPolicy] = useState(""); const [warrantyDate, setWarrantyDate] = useState(""); const [warrantyDuration, setWarrantyDuration] = useState(""); const [warrantyDescription, setWarrantyDescription] = useState(""); const [warrantyContact, setWarrantyContact] = useState("");
  const [receiptMerchant, setReceiptMerchant] = useState(""); const [receiptDate, setReceiptDate] = useState(""); const [receiptTotal, setReceiptTotal] = useState(""); const [receiptDescription, setReceiptDescription] = useState(""); const [existingReceiptIds, setExistingReceiptIds] = useState<string[]>([]);

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert("Camera access needed", "Allow camera access in Settings to photograph an item.");
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1, allowsEditing: false });
    if (!result.canceled && result.assets[0]?.uri) setPhotoUris((current) => [...current, result.assets[0].uri]);
  }

  async function choosePhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Photo access needed", "Allow photo-library access in Settings to add item photos.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, allowsMultipleSelection: true });
    if (!result.canceled) setPhotoUris((current) => Array.from(new Set([...current, ...result.assets.map((asset) => asset.uri)])));
  }

  function save() {
    if (!room || !name.trim()) return;
    const year = Number(purchaseYear);
    const input = {
      name,
      ownerName: ownerName?.trim() || null,
      category,
      description,
      estimatedReplacementValueCents: currencyToCents(value),
      purchaseYear: Number.isInteger(year) && year >= 1900 ? year : null,
      serialNumber: serialNumber.trim() || null,
      photoUris,
    };
    let savedItemId: string;
    if (existingItem) {
      updateItem(existingItem.id, input);
      moveItem(existingItem.id, selectedRoomId);
      savedItemId = existingItem.id;
      router.back();
    } else {
      const item = addItem(room.id, input);
      savedItemId = item.id;
      router.replace({ pathname: "/item/[id]", params: { id: item.id } });
    }
    existingReceiptIds.forEach((receiptId) => attachReceiptToItem(receiptId, savedItemId));
    if (receiptComplete && !existingReceiptIds.length && receiptMerchant.trim()) void addReceipt([savedItemId], { merchant: receiptMerchant, purchaseDate: receiptDate || null, totalCents: currencyToCents(receiptTotal), imageUri: null, description: receiptDescription, photoUris: [] }).catch(console.error);
    if (warrantyComplete && warrantyProvider.trim()) addWarranty({ provider: warrantyProvider.trim(), policyNumber: warrantyPolicy, purchaseDate: warrantyDate || null, durationMonths: Number(warrantyDuration) || 0, description: warrantyDescription, claimContact: warrantyContact, itemIds: [savedItemId], receiptId: null, documentUris: [] });
  }

  function createRoom() {
    if (!newRoomName.trim()) return;
    const createdRoom = addRoom(newRoomName);
    setSelectedRoomId(createdRoom.id);
    setNewRoomName("");
    setShowNewRoom(false);
  }

  function confirmDelete() {
    if (!existingItem || !room) return;
    Alert.alert("Delete this item?", "Its linked receipts will also be deleted. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { deleteItem(existingItem.id); router.replace({ pathname: "/room/[id]", params: { id: room.id } }); } },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}><Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable><Text style={styles.headerTitle}>{existingItem ? "Edit item" : "Add item"}</Text><View style={styles.spacer} /></View>
      <Text style={styles.eyebrow}>{room?.name.toUpperCase() ?? "SELECT A ROOM"}</Text><Text style={styles.title}>{existingItem ? "Update this item." : "Document an item."}</Text><Text style={styles.copy}>{existingItem ? "Keep the description and valuation current as better evidence becomes available." : "Add what you know now. Receipts and supporting details can be attached afterward."}</Text>
      <Text style={styles.label}>ROOM *</Text><View style={styles.categories}>{rooms.map((option) => <Pressable key={option.id} style={[styles.category, selectedRoomId === option.id && styles.categorySelected]} onPress={() => setSelectedRoomId(option.id)}><Text style={[styles.categoryText, selectedRoomId === option.id && styles.categoryTextSelected]}>{option.name}</Text></Pressable>)}<Pressable style={styles.category} onPress={() => setShowNewRoom((open) => !open)}><Text style={styles.categoryText}>{showNewRoom ? "Cancel" : "Add Room +"}</Text></Pressable></View>
      {showNewRoom ? <View style={styles.inlineRoom}><TextInput style={[styles.input, styles.inlineRoomInput]} value={newRoomName} onChangeText={setNewRoomName} placeholder="Room name" placeholderTextColor="#9a9f9b" returnKeyType="done" onSubmitEditing={createRoom} /><Pressable disabled={!newRoomName.trim()} style={[styles.inlineRoomButton, !newRoomName.trim() && styles.disabled]} onPress={createRoom}><Text style={styles.inlineRoomButtonText}>Add Room</Text></Pressable></View> : null}
      <Text style={styles.label}>ITEM NAME *</Text><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="For example, MacBook Pro" placeholderTextColor="#9a9f9b" autoFocus />
      <Text style={styles.label}>ITEM PHOTOS</Text><View style={photoStyles.actions}><Pressable style={photoStyles.action} onPress={takePhoto}><Camera size={18} color="#234d3b" /><Text style={photoStyles.actionText}>Take photo</Text></Pressable><Pressable style={photoStyles.action} onPress={choosePhotos}><Images size={18} color="#234d3b" /><Text style={photoStyles.actionText}>Choose photos</Text></Pressable></View>
      {photoUris.length ? <View style={photoStyles.grid}>{photoUris.map((uri, index) => <View key={uri} style={photoStyles.preview}><TappablePhoto uri={uri} title={`${name || "Item"}, view ${index + 1}`} style={photoStyles.image} resizeMode="contain" /><Pressable style={photoStyles.remove} onPress={() => setPhotoUris((current) => current.filter((entry) => entry !== uri))} hitSlop={7} accessibilityLabel="Remove photo"><X size={14} color="white" /></Pressable></View>)}</View> : <Text style={photoStyles.empty}>Add clear views for identification and insurance records.</Text>}
      <Text style={styles.label}>OWNER</Text><TextInput style={styles.input} value={ownerName ?? ""} onChangeText={setOwnerName} placeholder="Optional — type a person's name" placeholderTextColor="#9a9f9b" />
      {ownerNames.length ? <View style={styles.categories}>{ownerNames.map((owner) => <Pressable key={owner} style={[styles.category, ownerName === owner && styles.categorySelected]} onPress={() => setOwnerName(owner)}><Text style={[styles.categoryText, ownerName === owner && styles.categoryTextSelected]}>{owner}</Text></Pressable>)}</View> : null}
      <Text style={styles.label}>CATEGORY</Text><View style={styles.categories}>{categories.map((option) => <Pressable key={option} style={[styles.category, category === option && styles.categorySelected]} onPress={() => setCategory(option)}><Text style={[styles.categoryText, category === option && styles.categoryTextSelected]}>{option}</Text></Pressable>)}</View>
      <View style={styles.row}><View style={styles.half}><Text style={styles.label}>REPLACEMENT VALUE</Text><View style={styles.fieldMargin}><CurrencyField value={value} onChangeText={setValue} /></View></View><View style={styles.half}><Text style={styles.label}>PURCHASE YEAR</Text><TextInput style={styles.input} value={purchaseYear} onChangeText={setPurchaseYear} placeholder="2024" placeholderTextColor="#9a9f9b" keyboardType="number-pad" maxLength={4} /></View></View>
      <Text style={styles.label}>SERIAL NUMBER</Text><TextInput style={styles.input} value={serialNumber} onChangeText={setSerialNumber} placeholder="Optional" placeholderTextColor="#9a9f9b" autoCapitalize="characters" />
      <Text style={styles.label}>DESCRIPTION</Text><TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Brand, model, color, condition, or distinguishing details" placeholderTextColor="#9a9f9b" multiline textAlignVertical="top" />
      <View style={styles.attachmentStack}>{receiptComplete ? <View style={styles.successCard}><View><Text style={styles.successTitle}>✓ Receipt added</Text><Text style={styles.successCopy}>{existingReceiptIds.length ? "Existing receipt selected" : receiptMerchant}</Text></View><Pressable onPress={() => { setReceiptComplete(false); setShowReceipt(true); }}><Text style={styles.successEdit}>Edit</Text></Pressable></View> : <Pressable style={styles.attachmentButton} onPress={() => setShowReceipt((open) => !open)}><Text style={styles.attachmentButtonText}>{showReceipt ? "Hide receipt" : "＋ Add receipt"}</Text></Pressable>}{warrantyComplete ? <View style={styles.successCard}><View><Text style={styles.successTitle}>✓ Warranty added</Text><Text style={styles.successCopy}>{warrantyProvider}</Text></View><Pressable onPress={() => { setWarrantyComplete(false); setShowWarranty(true); }}><Text style={styles.successEdit}>Edit</Text></Pressable></View> : <Pressable style={styles.attachmentButton} onPress={() => setShowWarranty((open) => !open)}><Text style={styles.attachmentButtonText}>{showWarranty ? "Hide warranty" : "＋ Add warranty"}</Text></Pressable>}</View>
      {showReceipt && !receiptComplete ? <View style={styles.inlineCard}><Text style={styles.inlineTitle}>Receipt details</Text><Text style={styles.label}>MERCHANT *</Text><TextInput style={styles.input} value={receiptMerchant} onChangeText={setReceiptMerchant} placeholder="Store or seller" placeholderTextColor="#9a9f9b" /><View style={styles.row}><View style={styles.half}><Text style={styles.label}>PURCHASE DATE</Text><DateField value={receiptDate} onChangeText={setReceiptDate} /></View><View style={styles.half}><Text style={styles.label}>TOTAL</Text><CurrencyField value={receiptTotal} onChangeText={setReceiptTotal} /></View></View><Text style={styles.label}>ORDER / PAYMENT DETAILS</Text><TextInput style={[styles.input, styles.textArea]} value={receiptDescription} onChangeText={setReceiptDescription} multiline textAlignVertical="top" /><Pressable disabled={!receiptMerchant.trim()} style={[styles.inlineSave, !receiptMerchant.trim() && styles.disabled]} onPress={() => { setExistingReceiptIds([]); setReceiptComplete(true); setShowReceipt(false); }}><Text style={styles.inlineSaveText}>Save Receipt</Text></Pressable><Text style={styles.orLabel}>OR ATTACH AN EXISTING RECEIPT</Text><View style={styles.categories}>{receipts.map((receipt) => <Pressable key={receipt.id} style={styles.category} onPress={() => { setExistingReceiptIds([receipt.id]); setReceiptComplete(true); setShowReceipt(false); }}><Text style={styles.categoryText}>{receipt.merchant}</Text></Pressable>)}</View></View> : null}
      {showWarranty && !warrantyComplete ? <View style={styles.inlineCard}><Text style={styles.inlineTitle}>Warranty details</Text><Text style={styles.label}>PROVIDER *</Text><TextInput style={styles.input} value={warrantyProvider} onChangeText={setWarrantyProvider} placeholder="Manufacturer or protection-plan provider" placeholderTextColor="#9a9f9b" /><Text style={styles.label}>POLICY / CONTRACT NUMBER</Text><TextInput style={styles.input} value={warrantyPolicy} onChangeText={setWarrantyPolicy} /><View style={styles.row}><View style={styles.half}><Text style={styles.label}>PURCHASE DATE</Text><DateField value={warrantyDate} onChangeText={setWarrantyDate} /></View><View style={styles.half}><Text style={styles.label}>DURATION (MONTHS)</Text><TextInput style={styles.input} value={warrantyDuration} onChangeText={(text) => setWarrantyDuration(text.replace(/\D/g, ""))} keyboardType="number-pad" /></View></View><Text style={styles.label}>CLAIM CONTACT</Text><TextInput style={styles.input} value={warrantyContact} onChangeText={setWarrantyContact} /><Text style={styles.label}>DESCRIPTION / CLAIM NOTES</Text><TextInput style={[styles.input, styles.textArea]} value={warrantyDescription} onChangeText={setWarrantyDescription} multiline textAlignVertical="top" /><Pressable disabled={!warrantyProvider.trim()} style={[styles.inlineSave, !warrantyProvider.trim() && styles.disabled]} onPress={() => { setWarrantyComplete(true); setShowWarranty(false); }}><Text style={styles.inlineSaveText}>Save Warranty</Text></Pressable></View> : null}
      <Pressable disabled={!room || !name.trim()} style={[styles.save, (!room || !name.trim()) && styles.disabled]} onPress={save}><Text style={styles.saveText}>{existingItem ? "Save changes" : "Save item"}</Text></Pressable>
      {existingItem ? <Pressable style={styles.deleteButton} onPress={confirmDelete}><Text style={styles.deleteText}>Delete item</Text></Pressable> : null}
    </ScrollView></KeyboardAvoidingView></SafeAreaView>
  );
}

const photoStyles = StyleSheet.create({ actions: { flexDirection: "row", gap: 10, marginBottom: 12 }, action: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "#9eaaa2", borderRadius: 11, backgroundColor: "#fffdf8" }, actionText: { color: "#234d3b", fontSize: 11, fontWeight: "800" }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 20 }, preview: { width: 82, height: 82, position: "relative" }, image: { width: "100%", height: "100%", borderRadius: 11 }, remove: { position: "absolute", top: 5, right: 5, width: 27, height: 27, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "rgba(23,33,27,.82)" }, empty: { color: "#7a827d", fontSize: 11, lineHeight: 16, marginBottom: 22 } });

const styles = StyleSheet.create({ flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: "#f4f1e9" }, content: { padding: 24, paddingBottom: 60 }, header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 42 }, back: { color: "#17211b", fontSize: 42, lineHeight: 42 }, headerTitle: { color: "#17211b", fontWeight: "800", fontSize: 14 }, spacer: { width: 24 }, eyebrow: { color: "#234d3b", fontWeight: "800", fontSize: 10, letterSpacing: 1.5, marginBottom: 9 }, title: { color: "#17211b", fontFamily: "Georgia", fontSize: 40, marginBottom: 12 }, copy: { color: "#657069", fontSize: 14, lineHeight: 21, marginBottom: 28 }, label: { color: "#657069", fontSize: 9, fontWeight: "800", letterSpacing: 1.2, marginBottom: 8 }, input: { height: 52, paddingHorizontal: 15, marginBottom: 20, borderWidth: 1, borderColor: "#d2d0c8", borderRadius: 11, backgroundColor: "#fffdf8", color: "#17211b", fontSize: 15 }, inlineRoom: { flexDirection: "row", gap: 10, marginBottom: 20 }, inlineRoomInput: { flex: 1, marginBottom: 0 }, inlineRoomButton: { paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#234d3b" }, inlineRoomButtonText: { color: "white", fontSize: 12, fontWeight: "800" }, fieldMargin: { marginBottom: 20 }, textArea: { height: 105, paddingTop: 14 }, categories: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 23 }, category: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: "#d2d0c8", backgroundColor: "#fffdf8" }, categorySelected: { borderColor: "#234d3b", backgroundColor: "#dce9df" }, categoryText: { color: "#657069", fontSize: 11, fontWeight: "700" }, categoryTextSelected: { color: "#234d3b" }, attachmentActions: { flexDirection: "row", gap: 10, marginBottom: 20 }, attachmentStack: { gap: 10, marginTop: 12, marginBottom: 20 }, attachmentButton: { height: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#234d3b", borderRadius: 10 }, attachmentButtonText: { color: "#234d3b", fontSize: 12, fontWeight: "800" }, inlineCard: { padding: 18, marginBottom: 22, borderWidth: 1, borderColor: "#dedbd1", borderRadius: 14, backgroundColor: "#fffdf8" }, inlineTitle: { color: "#17211b", fontFamily: "Georgia", fontSize: 21, marginBottom: 18 }, inlineSave: { height: 46, marginBottom: 18, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#234d3b" }, inlineSaveText: { color: "white", fontWeight: "800" }, orLabel: { color: "#657069", fontSize: 9, fontWeight: "800", letterSpacing: 1.1, marginBottom: 10 }, successCard: { minHeight: 64, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#7da58b", borderRadius: 12, backgroundColor: "#dce9df" }, successTitle: { color: "#234d3b", fontWeight: "800", fontSize: 13 }, successCopy: { color: "#4d6b5c", fontSize: 10, marginTop: 4 }, successEdit: { color: "#234d3b", fontWeight: "800", fontSize: 12 }, row: { flexDirection: "row", gap: 12 }, half: { flex: 1 }, save: { height: 53, borderRadius: 12, backgroundColor: "#234d3b", alignItems: "center", justifyContent: "center" }, disabled: { opacity: 0.35 }, saveText: { color: "white", fontWeight: "800", fontSize: 15 }, deleteButton: { height: 48, marginTop: 13, alignItems: "center", justifyContent: "center" }, deleteText: { color: "#a23a32", fontWeight: "800", fontSize: 13 } });
