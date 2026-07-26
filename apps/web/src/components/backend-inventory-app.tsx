"use client";

import type { HomeInventory } from "@stuffhub/domain";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { InventoryApp } from "./inventory-app";
import { ChangeConfirmation, type ChangeNotice } from "./change-confirmation";

function confirmationFor(command: Record<string, unknown>) {
  const type = String(command.type ?? "");
  const messages: Record<string, string> = { "room.create": "Room created", "room.update": "Room updated", "room.delete": "Room removed", "item.create": "Item created", "item.update": "Item updated", "item.delete": "Item removed", "receipt.delete": "Receipt removed", "container.delete": "Container removed", "maintenance.create": "Maintenance reminder created" };
  if (type === "container.save") return command.id ? "Container updated" : "Container created";
  if (type === "receipt.save") return command.id ? "Receipt updated" : "Receipt created";
  if (type === "warranty.save") return command.id ? "Warranty updated" : "Warranty created";
  return messages[type] ?? null;
}

async function apiFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const response = await fetch(path, { ...init, credentials: "include" });
  if (response.status !== 401 || !retry) return response;
  const refreshed = await fetch("/api/auth/refresh", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: "{}" });
  return refreshed.ok ? apiFetch(path, init, false) : response;
}

export function BackendInventoryApp() {
  const [inventory, setInventory] = useState<HomeInventory | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "forgot-password">("sign-in");
  const [recoverySession, setRecoverySession] = useState<{ accessToken: string; refreshToken: string } | null>(null);
  const [recoveryChecked, setRecoveryChecked] = useState(false);
  const [changeNotice, setChangeNotice] = useState<ChangeNotice | null>(null);
  const noticeId = useRef(0); const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showConfirmation = useCallback((message: string) => { if (noticeTimer.current) clearTimeout(noticeTimer.current); setChangeNotice({ id: ++noticeId.current, message }); noticeTimer.current = setTimeout(() => setChangeNotice(null), 2200); }, []);

  const load = useCallback(async () => {
    const response = await apiFetch("/api/inventory");
    if (response.status === 401) { setInventory(null); return; }
    const body = await response.json() as { inventory?: HomeInventory; error?: string };
    if (!response.ok) throw new Error(body.error ?? "Could not load inventory");
    setInventory(body.inventory ?? null);
  }, []);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token"); const refreshToken = hash.get("refresh_token");
    if (hash.get("type") === "recovery") {
      setInventory(null);
      if (accessToken && refreshToken) setRecoverySession({ accessToken, refreshToken });
      else setError("This recovery link is incomplete or expired. Request a new reset link.");
      setRecoveryChecked(true);
      return;
    }
    setRecoveryChecked(true);
    load().catch((reason: unknown) => { setInventory(null); setError(reason instanceof Error ? reason.message : "Could not load inventory"); });
  }, [load]);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    const form = new FormData(event.currentTarget);
    if (mode === "forgot-password") {
      const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.get("email") }) });
      const body = await response.json() as { error?: string; message?: string };
      if (!response.ok) setError(body.error ?? "Could not send reset email"); else setNotice(body.message ?? "Check your email for a reset link.");
      return;
    }
    const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "include",
      body: JSON.stringify({ email: form.get("email"), password: form.get("password"), displayName: form.get("displayName"), homeName: form.get("homeName") }) });
    const body = await response.json() as { error?: string; confirmationRequired?: boolean };
    if (!response.ok) { setError(body.error ?? "Authentication failed"); return; }
    if (body.confirmationRequired) { setError("Check your email to confirm your account, then sign in."); setMode("sign-in"); return; }
    await load();
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    const form = new FormData(event.currentTarget); const password = String(form.get("password") ?? ""); const confirmation = String(form.get("confirmation") ?? "");
    if (password !== confirmation) { setError("Passwords do not match"); return; }
    const response = await fetch("/api/auth/update-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...recoverySession, password }) });
    const body = await response.json() as { error?: string; message?: string };
    if (!response.ok) { setError(body.error ?? "Could not update password"); return; }
    window.history.replaceState(null, "", window.location.pathname); setRecoverySession(null); setInventory(null); setMode("sign-in"); setNotice(body.message ?? "Password updated.");
  }

  if (!recoveryChecked) return <main className="auth-shell"><p>Loading StuffHub…</p></main>;
  if (recoverySession) return <main className="auth-shell"><form className="auth-card" onSubmit={updatePassword}>
    <p className="eyebrow">STUFFHUB</p><h1>Choose a new password.</h1>
    <label>NEW PASSWORD<input name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
    <label>CONFIRM PASSWORD<input name="confirmation" type="password" minLength={8} autoComplete="new-password" required /></label>
    {error ? <p className="auth-error">{error}</p> : null}<button className="button primary" type="submit">Update password</button>
  </form></main>;

  if (inventory === undefined) return <main className="auth-shell"><p>Loading StuffHub…</p></main>;
  if (!inventory) return <main className="auth-shell"><form className="auth-card" onSubmit={authenticate}>
    <p className="eyebrow">STUFFHUB</p><h1>{mode === "sign-in" ? "Welcome back." : mode === "sign-up" ? "Create your home." : "Reset your password."}</h1>
    {mode === "sign-up" ? <><label>YOUR NAME<input name="displayName" autoComplete="name" /></label><label>HOME NAME<input name="homeName" defaultValue="My Home" /></label></> : null}
    <label>EMAIL<input name="email" type="email" autoComplete="email" required /></label>
    {mode !== "forgot-password" ? <label>PASSWORD<input name="password" type="password" minLength={8} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} required /></label> : null}
    {error ? <p className="auth-error">{error}</p> : null}{notice ? <p className="auth-notice">{notice}</p> : null}<button className="button primary" type="submit">{mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create account" : "Send reset link"}</button>
    {mode === "sign-in" ? <button className="auth-switch" type="button" onClick={() => { setError(""); setNotice(""); setMode("forgot-password"); }}>Forgot password?</button> : null}
    <button className="auth-switch" type="button" onClick={() => { setError(""); setNotice(""); setMode(mode === "sign-in" ? "sign-up" : "sign-in"); }}>{mode === "sign-in" ? "Need an account?" : "Back to sign in"}</button>
  </form></main>;

  return <><InventoryApp initialInventory={inventory} onCommand={async (command) => {
    const response = await apiFetch("/api/inventory/commands", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ homeId: inventory.id, command }) });
    const body = await response.json() as { error?: string };
    if (!response.ok) { setError(body.error ?? "Change could not be saved"); await load(); throw new Error(body.error); }
    const message = confirmationFor(command); if (message) showConfirmation(message);
  }} onUploadMedia={async (entityType, entityId, file, replaceIndex) => {
    const form = new FormData(); form.append("homeId", inventory.id); form.append("entityType", entityType); form.append("entityId", entityId); form.append("file", file); if (replaceIndex !== undefined) form.append("replaceIndex", String(replaceIndex));
    const response = await apiFetch("/api/media", { method: "POST", body: form });
    if (!response.ok) { const body = await response.json() as { error?: string }; throw new Error(body.error ?? "Upload failed"); }
    showConfirmation("Photo added");
  }} /><ChangeConfirmation notice={changeNotice} /></>;
}
