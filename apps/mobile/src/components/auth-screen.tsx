import { useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth-context";

export function AuthScreen() {
  const { ready, signIn, signUp, forgotPassword } = useAuth(); const [mode, setMode] = useState<"sign-in" | "sign-up" | "forgot-password">("sign-in");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState(""); const [home, setHome] = useState("My Home");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  if (!ready) return <SafeAreaView style={styles.safe}><ActivityIndicator color="#234d3b" /></SafeAreaView>;
  async function submit() { setBusy(true); setError(""); setNotice(""); try { if (mode === "sign-in") await signIn(email, password); else if (mode === "sign-up") await signUp(email, password, name, home); else setNotice(await forgotPassword(email)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Authentication failed"); } finally { setBusy(false); } }
  return <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}><SafeAreaView style={styles.safe}><View style={styles.card}><Text style={styles.eyebrow}>STUFFHUB</Text><Text style={styles.title}>{mode === "sign-in" ? "Welcome back." : mode === "sign-up" ? "Create your home." : "Reset your password."}</Text>
    {mode === "sign-up" ? <><TextInput style={styles.input} placeholder="Your name" value={name} onChangeText={setName} /><TextInput style={styles.input} placeholder="Home name" value={home} onChangeText={setHome} /></> : null}
    <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
    {mode !== "forgot-password" ? <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}{notice ? <Text style={styles.notice}>{notice}</Text> : null}<Pressable disabled={busy || !email || (mode !== "forgot-password" && password.length < 8)} style={styles.button} onPress={() => void submit()}><Text style={styles.buttonText}>{busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create account" : "Send reset link"}</Text></Pressable>
    {mode === "sign-in" ? <Pressable onPress={() => { setError(""); setNotice(""); setMode("forgot-password"); }}><Text style={styles.switch}>Forgot password?</Text></Pressable> : null}
    <Pressable onPress={() => { setError(""); setNotice(""); setMode(mode === "sign-in" ? "sign-up" : "sign-in"); }}><Text style={styles.switch}>{mode === "sign-in" ? "Need an account?" : "Back to sign in"}</Text></Pressable>
  </View></SafeAreaView></TouchableWithoutFeedback>;
}
const styles = StyleSheet.create({ safe: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#f4f1e9" }, card: { padding: 28, gap: 14, borderRadius: 18, backgroundColor: "#fffdf8" }, eyebrow: { color: "#234d3b", fontSize: 10, fontWeight: "800", letterSpacing: 1.4 }, title: { marginBottom: 14, color: "#17211b", fontFamily: "Georgia", fontSize: 36 }, input: { height: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: "#dedbd1", borderRadius: 10, color: "#17211b" }, button: { height: 48, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#234d3b" }, buttonText: { color: "white", fontWeight: "800" }, switch: { textAlign: "center", color: "#234d3b", fontWeight: "700" }, error: { color: "#a33a32" }, notice: { color: "#234d3b", lineHeight: 19 } });
