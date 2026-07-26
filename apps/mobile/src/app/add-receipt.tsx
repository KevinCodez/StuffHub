import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera, Images, ReceiptText, ShieldCheck, X } from "lucide-react-native";
import { useInventory } from "../inventory-context";
import { CurrencyField, DateField } from "../components/form-fields";
import { TappablePhoto } from "../components/tappable-photo";

function currencyToCents(value: string) {
  const number = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

export default function AddReceiptScreen() {
  const { itemId = "", receiptId = "", returnTo = "", returnId = "" } = useLocalSearchParams<{ itemId?: string; receiptId?: string; returnTo?: "receipts" | "item"; returnId?: string }>();
  const { addReceipt, updateReceipt, deleteReceipt, findItem, findReceipt, rooms } = useInventory();
  const existingReceipt = findReceipt(receiptId);
  const item = findItem(existingReceipt?.itemIds[0] ?? itemId);
  const [merchant, setMerchant] = useState(existingReceipt?.merchant ?? "");
  const [purchaseDate, setPurchaseDate] = useState(existingReceipt?.purchaseDate ?? "");
  const [total, setTotal] = useState(existingReceipt ? (existingReceipt.totalCents / 100).toString() : "");
  const [imageUri, setImageUri] = useState<string | null>(existingReceipt?.imageUri ?? null);
  const [photoUris, setPhotoUris] = useState<string[]>(existingReceipt?.photoUris ?? (existingReceipt?.imageUri ? [existingReceipt.imageUri] : []));
  const [description, setDescription] = useState(existingReceipt?.description ?? "");
  const [itemIds, setItemIds] = useState<string[]>(existingReceipt?.itemIds ?? (itemId ? [itemId] : []));
  const [saving, setSaving] = useState(false);

  function goBack() {
    if (returnTo === "receipts") return router.dismissTo({ pathname: "/collection/[kind]", params: { kind: "receipts" } });
    if (returnTo === "item" && returnId) return router.dismissTo({ pathname: "/item/[id]", params: { id: returnId } });
    if (router.canGoBack()) return router.back();
    router.replace("/");
  }

  async function photographReceipt() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert("Camera access needed", "Allow camera access in Settings to photograph a receipt.");
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1, allowsEditing: false });
    if (!result.canceled && result.assets[0]?.uri) { const uri = result.assets[0].uri; setPhotoUris((current) => Array.from(new Set([...current, uri]))); setImageUri((current) => current ?? uri); }
  }

  async function chooseReceipt() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Photo access needed", "Allow photo-library access in Settings to attach a receipt.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, allowsMultipleSelection: true });
    if (!result.canceled) { const uris = result.assets.map((asset) => asset.uri); setPhotoUris((current) => Array.from(new Set([...current, ...uris]))); setImageUri((current) => current ?? uris[0] ?? null); }
  }

  async function save() {
    if (!merchant.trim()) return;
    const input = {
      merchant,
      purchaseDate: purchaseDate.trim() || null,
      totalCents: currencyToCents(total),
      imageUri,
      photoUris,
      description,
      itemIds,
    };
    setSaving(true);
    try {
      if (existingReceipt) await updateReceipt(existingReceipt.id, input);
      else await addReceipt(itemIds, input);
      goBack();
    } catch (error) {
      Alert.alert("Could not save receipt", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!existingReceipt) return;
    Alert.alert("Delete this receipt?", "The receipt image and purchase details will be removed from this item.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { deleteReceipt(existingReceipt.id); goBack(); } },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}><Pressable onPress={goBack} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable><Text style={styles.headerTitle}>{existingReceipt ? "Edit receipt" : "Add receipt"}</Text><View style={styles.spacer} /></View>
      <Text style={styles.eyebrow}>PROOF OF PURCHASE</Text><Text style={styles.title}>{existingReceipt ? "Update this receipt." : "Attach a receipt."}</Text><Text style={styles.copy}>This receipt is linked to <Text style={styles.itemName}>{item?.name ?? "this item"}</Text>.</Text>
      <View style={styles.uploadCard}><View style={styles.uploadHeading}><View style={styles.uploadIcon}><ReceiptText size={20} color="#234d3b" /></View><View style={styles.uploadHeadingCopy}><Text style={styles.uploadTitle}>Receipt image</Text><Text style={styles.uploadSubtitle}>Fine print stays at full resolution</Text></View>{photoUris.length ? <View style={styles.pageCount}><Text style={styles.pageCountText}>{photoUris.length} {photoUris.length === 1 ? "PAGE" : "PAGES"}</Text></View> : null}</View>
        {imageUri ? <View style={styles.previewWrap}><TappablePhoto uri={imageUri} title={`${merchant || "Receipt"} photo`} style={styles.preview} resizeMode="contain" openViewer {...(existingReceipt ? { target: { entityType: "receipt" as const, entityId: existingReceipt.id, index: Math.max(0, photoUris.indexOf(imageUri)) } } : {})} /><View pointerEvents="none" style={styles.viewHint}><Text style={styles.viewHintText}>Tap to view full size</Text></View><Pressable style={styles.removePhoto} onPress={() => { const remaining = photoUris.filter((uri) => uri !== imageUri); setPhotoUris(remaining); setImageUri(remaining[0] ?? null); }} accessibilityLabel="Remove receipt image"><X size={17} color="white" /></Pressable></View> : <View style={styles.photoPlaceholder}><View style={styles.placeholderIcon}><ReceiptText size={30} color="#234d3b" /></View><Text style={styles.photoTitle}>Add proof of purchase</Text><Text style={styles.photoCopy}>Photograph the entire receipt in good light, or choose an existing scan.</Text></View>}
        {photoUris.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pageStrip}>{photoUris.map((uri, index) => <TappablePhoto key={uri} uri={uri} title={`${merchant || "Receipt"}, page ${index + 1}`} style={styles.pageThumbnail} resizeMode="cover" openViewer {...(existingReceipt ? { target: { entityType: "receipt" as const, entityId: existingReceipt.id, index } } : {})} />)}</ScrollView> : null}
        <View style={styles.photoActions}><Pressable disabled={saving} style={styles.photoPrimary} onPress={() => void photographReceipt()}><Camera size={18} color="white" /><View><Text style={styles.photoPrimaryText}>Take photo</Text><Text style={styles.photoPrimaryNote}>Use the camera</Text></View></Pressable><Pressable disabled={saving} style={styles.photoSecondary} onPress={() => void chooseReceipt()}><Images size={18} color="#234d3b" /><View><Text style={styles.photoSecondaryText}>Choose files</Text><Text style={styles.photoSecondaryNote}>Photos or scans</Text></View></Pressable></View>
        <View style={styles.qualityNote}><ShieldCheck size={15} color="#51705f" /><Text style={styles.qualityNoteText}>Original quality is preserved so totals, dates, and fine print remain legible.</Text></View>
      </View>
      <Text style={styles.label}>MERCHANT *</Text><TextInput style={styles.input} value={merchant} onChangeText={setMerchant} placeholder="Store or seller" placeholderTextColor="#9a9f9b" />
      <View style={styles.row}><View style={styles.half}><Text style={styles.label}>PURCHASE DATE</Text><View style={styles.fieldMargin}><DateField value={purchaseDate} onChangeText={setPurchaseDate} /></View></View><View style={styles.half}><Text style={styles.label}>RECEIPT TOTAL</Text><View style={styles.fieldMargin}><CurrencyField value={total} onChangeText={setTotal} /></View></View></View>
      <Text style={styles.label}>DESCRIPTION / ORDER DETAILS</Text><TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Order number, payment method, return notes, or other useful details" placeholderTextColor="#9a9f9b" multiline textAlignVertical="top" />
      <Text style={styles.label}>ATTACHED ITEMS</Text><View style={styles.itemChoices}>{rooms.flatMap((room) => room.items).map((option) => { const selected = itemIds.includes(option.id); return <Pressable key={option.id} style={[styles.itemChoice, selected && styles.itemChoiceSelected]} onPress={() => setItemIds((current) => selected ? current.filter((id) => id !== option.id) : [...current, option.id])}><Text style={[styles.itemChoiceText, selected && styles.itemChoiceTextSelected]}>{option.name}</Text></Pressable>; })}</View>
      <Text style={styles.note}>Receipt totals may include other items, tax, or delivery. They are stored separately from the item’s estimated replacement value.</Text>
      <Pressable disabled={!merchant.trim() || saving} style={[styles.save, (!merchant.trim() || saving) && styles.disabled]} onPress={() => void save()}>{saving ? <><ActivityIndicator color="white" /><Text style={styles.saveText}>Saving full-quality receipt…</Text></> : <Text style={styles.saveText}>{existingReceipt ? "Save changes" : "Save receipt"}</Text>}</Pressable>
      {existingReceipt ? <Pressable style={styles.deleteButton} onPress={confirmDelete}><Text style={styles.deleteText}>Delete receipt</Text></Pressable> : null}
    </ScrollView></KeyboardAvoidingView></SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: "#f4f1e9" }, content: { padding: 24, paddingBottom: 60 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 42 }, back: { color: "#17211b", fontSize: 42, lineHeight: 42 }, headerTitle: { color: "#17211b", fontWeight: "800", fontSize: 14 }, spacer: { width: 24 },
  eyebrow: { color: "#234d3b", fontWeight: "800", fontSize: 10, letterSpacing: 1.5, marginBottom: 9 }, title: { color: "#17211b", fontFamily: "Georgia", fontSize: 40, marginBottom: 12 }, copy: { color: "#657069", fontSize: 14, lineHeight: 21, marginBottom: 24 }, itemName: { color: "#17211b", fontWeight: "800" },
  uploadCard: { padding: 14, marginBottom: 28, borderWidth: 1, borderColor: "#d8d6cd", borderRadius: 18, backgroundColor: "#fffdf8", shadowColor: "#183b2b", shadowOpacity: .05, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  uploadHeading: { minHeight: 44, marginBottom: 13, flexDirection: "row", alignItems: "center" }, uploadIcon: { width: 40, height: 40, marginRight: 11, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#dce9df" }, uploadHeadingCopy: { flex: 1 }, uploadTitle: { color: "#17211b", fontFamily: "Georgia", fontSize: 18 }, uploadSubtitle: { marginTop: 3, color: "#6b756e", fontSize: 9.5 }, pageCount: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20, backgroundColor: "#eef1e5" }, pageCountText: { color: "#4e6658", fontSize: 8, fontWeight: "800", letterSpacing: .7 },
  photoPlaceholder: { height: 225, padding: 28, alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderColor: "#9eaaa2", borderRadius: 14, backgroundColor: "#f3f0e8" }, placeholderIcon: { width: 62, height: 62, marginBottom: 15, alignItems: "center", justifyContent: "center", borderRadius: 31, backgroundColor: "#dce9df" }, photoTitle: { color: "#17211b", fontFamily: "Georgia", fontSize: 20, marginBottom: 7 }, photoCopy: { maxWidth: 240, color: "#657069", textAlign: "center", fontSize: 11, lineHeight: 17 },
  previewWrap: { height: 310, position: "relative", overflow: "hidden", borderWidth: 1, borderColor: "#e0ded5", borderRadius: 14, backgroundColor: "#ebe8df" }, preview: { width: "100%", height: "100%" }, viewHint: { position: "absolute", left: 12, bottom: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: "rgba(9,16,12,.72)" }, viewHintText: { color: "white", fontSize: 9, fontWeight: "700" }, removePhoto: { position: "absolute", right: 10, top: 10, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(23,33,27,.82)" },
  pageStrip: { gap: 8, paddingTop: 11 }, pageThumbnail: { width: 66, height: 82, borderWidth: 1, borderColor: "#dedbd1", borderRadius: 9, backgroundColor: "#ebe8df" },
  photoActions: { flexDirection: "row", gap: 10, marginTop: 12 }, photoPrimary: { flex: 1, minHeight: 56, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 11, backgroundColor: "#234d3b" }, photoPrimaryText: { color: "white", fontSize: 11.5, fontWeight: "800" }, photoPrimaryNote: { marginTop: 2, color: "#c7d9cd", fontSize: 8.5 }, photoSecondary: { flex: 1, minHeight: 56, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderWidth: 1, borderColor: "#9eaaa2", borderRadius: 11, backgroundColor: "#fffdf8" }, photoSecondaryText: { color: "#234d3b", fontSize: 11.5, fontWeight: "800" }, photoSecondaryNote: { marginTop: 2, color: "#758078", fontSize: 8.5 }, qualityNote: { marginTop: 13, padding: 11, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, backgroundColor: "#eef1e8" }, qualityNoteText: { flex: 1, color: "#51705f", fontSize: 9.5, lineHeight: 14 },
  label: { color: "#657069", fontSize: 9, fontWeight: "800", letterSpacing: 1.2, marginBottom: 8 }, input: { height: 52, paddingHorizontal: 15, marginBottom: 20, borderWidth: 1, borderColor: "#d2d0c8", borderRadius: 11, backgroundColor: "#fffdf8", color: "#17211b", fontSize: 15 }, fieldMargin: { marginBottom: 20 }, textArea: { height: 100, paddingTop: 14 },
  itemChoices: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 }, itemChoice: { paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: "#d2d0c8", borderRadius: 18, backgroundColor: "#fffdf8" }, itemChoiceSelected: { borderColor: "#234d3b", backgroundColor: "#dce9df" }, itemChoiceText: { color: "#657069", fontSize: 11, fontWeight: "700" }, itemChoiceTextSelected: { color: "#234d3b" }, row: { flexDirection: "row", gap: 12 }, half: { flex: 1 }, note: { color: "#657069", fontSize: 10, lineHeight: 16, marginTop: -5, marginBottom: 22 },
  save: { height: 53, flexDirection: "row", gap: 9, borderRadius: 12, backgroundColor: "#234d3b", alignItems: "center", justifyContent: "center" }, disabled: { opacity: 0.35 }, saveText: { color: "white", fontWeight: "800", fontSize: 14 }, deleteButton: { height: 48, marginTop: 13, alignItems: "center", justifyContent: "center" }, deleteText: { color: "#a23a32", fontWeight: "800", fontSize: 13 },
});
