import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle } from "react-native";

function maskDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDate(value: string) {
  const [month, day, year] = value.split("/").map(Number);
  if (!month || !day || !year || year < 1900) return new Date();
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatDate(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
}

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const weekdays = ["S", "M", "T", "W", "T", "F", "S"];

function calendarCells(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const leadingBlanks = new Date(year, monthIndex, 1).getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  return [...Array.from<null>({ length: leadingBlanks }).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

export function DateField({ value, onChangeText, inputStyle }: { value: string; onChangeText: (value: string) => void; inputStyle?: StyleProp<TextStyle> }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(() => parseDate(value));
  const [visibleMonth, setVisibleMonth] = useState(() => parseDate(value));
  const today = new Date();
  const nextMonthDisabled = visibleMonth.getFullYear() === today.getFullYear() && visibleMonth.getMonth() >= today.getMonth();
  const cells = calendarCells(visibleMonth);
  return (
    <>
      <View style={styles.fieldShell}>
        <TextInput style={[styles.textInput, inputStyle]} value={value} onChangeText={(next) => onChangeText(maskDate(next))} placeholder="MM/DD/YYYY" placeholderTextColor="#9a9f9b" keyboardType="number-pad" maxLength={10} />
        <Pressable style={styles.iconButton} onPress={() => { const selected = parseDate(value); setDraftDate(selected); setVisibleMonth(selected); setPickerOpen(true); }} hitSlop={8}><Text style={styles.calendarIcon}>▦</Text></Pressable>
      </View>
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.pickerCard}>
          <Text style={styles.pickerTitle}>Choose purchase date</Text>
          <View style={styles.monthHeader}><Pressable style={styles.monthButton} onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}><Text style={styles.monthArrow}>‹</Text></Pressable><Text style={styles.monthTitle}>{monthNames[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}</Text><Pressable disabled={nextMonthDisabled} style={[styles.monthButton, nextMonthDisabled && styles.monthButtonDisabled]} onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}><Text style={styles.monthArrow}>›</Text></Pressable></View>
          <View style={styles.weekRow}>{weekdays.map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}</View>
          <View style={styles.calendarGrid}>{cells.map((day, index) => {
            if (!day) return <View key={`blank-${index}`} style={styles.dayCell} />;
            const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
            const disabled = date.getTime() > new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
            const selected = sameDay(date, draftDate);
            return <Pressable key={day} disabled={disabled} style={styles.dayCell} onPress={() => setDraftDate(date)}><View style={[styles.dayCircle, selected && styles.dayCircleSelected]}><Text style={[styles.dayText, disabled && styles.dayTextDisabled, selected && styles.dayTextSelected]}>{day}</Text></View></Pressable>;
          })}</View>
          <View style={styles.pickerActions}><Pressable style={styles.cancelButton} onPress={() => setPickerOpen(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable style={styles.doneButton} onPress={() => { onChangeText(formatDate(draftDate)); setPickerOpen(false); }}><Text style={styles.doneText}>Use date</Text></Pressable></View>
        </View></View>
      </Modal>
    </>
  );
}

function normalizedMoney(value: string) {
  const number = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) ? number.toFixed(2) : "0.00";
}

export function CurrencyField({ value, onChangeText, inputStyle }: { value: string; onChangeText: (value: string) => void; inputStyle?: StyleProp<TextStyle> }) {
  return <View style={styles.fieldShell}><Text style={styles.dollar}>$</Text><TextInput style={[styles.textInput, styles.currencyInput, inputStyle]} value={value} onChangeText={(next) => onChangeText(next.replace(/[^0-9.]/g, ""))} onBlur={() => value && onChangeText(normalizedMoney(value))} onSubmitEditing={() => onChangeText(normalizedMoney(value))} placeholder="0.00" placeholderTextColor="#9a9f9b" keyboardType="decimal-pad" /></View>;
}

const styles = StyleSheet.create({ fieldShell: { height: 52, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#d2d0c8", borderRadius: 11, backgroundColor: "#fffdf8", overflow: "hidden" }, textInput: { flex: 1, height: "100%", paddingHorizontal: 15, color: "#17211b", fontSize: 15 }, iconButton: { width: 48, height: "100%", alignItems: "center", justifyContent: "center" }, calendarIcon: { color: "#234d3b", fontSize: 21 }, dollar: { paddingLeft: 15, color: "#17211b", fontSize: 15, fontWeight: "700" }, currencyInput: { paddingLeft: 5 }, modalBackdrop: { flex: 1, justifyContent: "flex-end", padding: 18, backgroundColor: "rgba(0,0,0,.38)" }, pickerCard: { padding: 20, borderRadius: 18, backgroundColor: "#fffdf8" }, pickerTitle: { color: "#17211b", fontFamily: "Georgia", fontSize: 22, textAlign: "center", marginBottom: 16 }, monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }, monthButton: { width: 42, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#eeebe3" }, monthButtonDisabled: { opacity: 0.3 }, monthArrow: { color: "#234d3b", fontSize: 29, lineHeight: 30 }, monthTitle: { color: "#17211b", fontFamily: "Georgia", fontSize: 18 }, weekRow: { flexDirection: "row", marginBottom: 4 }, weekday: { width: "14.2857%", color: "#7a827d", textAlign: "center", fontSize: 9, fontWeight: "800" }, calendarGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 14 }, dayCell: { width: "14.2857%", aspectRatio: 1, alignItems: "center", justifyContent: "center" }, dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }, dayCircleSelected: { backgroundColor: "#234d3b" }, dayText: { color: "#17211b", fontSize: 13, fontWeight: "700" }, dayTextDisabled: { color: "#c1c3c0" }, dayTextSelected: { color: "white" }, pickerActions: { flexDirection: "row", gap: 10, marginTop: 2 }, cancelButton: { flex: 1, height: 46, borderWidth: 1, borderColor: "#234d3b", borderRadius: 10, alignItems: "center", justifyContent: "center" }, cancelText: { color: "#234d3b", fontWeight: "800" }, doneButton: { flex: 1, height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#234d3b" }, doneText: { color: "white", fontWeight: "800" } });
