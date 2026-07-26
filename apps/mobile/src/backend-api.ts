import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import type { HomeInventory } from "@stuffhub/domain";

function developmentApiUrl() {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  if (!hostUri) return "http://127.0.0.1:3000";
  const hostname = hostUri.replace(/^https?:\/\//, "").split(":")[0];
  return `http://${hostname}:3000`;
}

const API_URL = (process.env.EXPO_PUBLIC_STUFFHUB_API_URL || developmentApiUrl()).replace(/\/$/, "");
const ACCESS_KEY = "stuffhub.accessToken";
const REFRESH_KEY = "stuffhub.refreshToken";

async function tokens() {
  return { accessToken: await SecureStore.getItemAsync(ACCESS_KEY), refreshToken: await SecureStore.getItemAsync(REFRESH_KEY) };
}

async function saveTokens(accessToken: string, refreshToken: string) {
  await Promise.all([SecureStore.setItemAsync(ACCESS_KEY, accessToken), SecureStore.setItemAsync(REFRESH_KEY, refreshToken)]);
}

async function apiFetch(path: string, init?: RequestInit) {
  try {
    return await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new Error(`Cannot reach the StuffHub server at ${API_URL}. Make sure the web server is running and the phone is on the same network.`);
  }
}

async function request(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const { accessToken, refreshToken } = await tokens();
  const response = await apiFetch(path, { ...init, headers: { ...(init.body && !(init.body instanceof FormData) ? { "content-type": "application/json" } : {}), ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}), ...init.headers } });
  if (response.status !== 401 || !retry || !refreshToken) return response;
  const refreshed = await apiFetch("/api/auth/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mobile: true, refreshToken }) });
  if (!refreshed.ok) { await signOut(); return response; }
  const next = await refreshed.json() as { accessToken: string; refreshToken: string };
  await saveTokens(next.accessToken, next.refreshToken);
  return request(path, init, false);
}

export async function hasSession() { return Boolean((await tokens()).refreshToken); }

export async function authenticate(mode: "sign-in" | "sign-up", input: { email: string; password: string; displayName?: string; homeName?: string }) {
  const response = await apiFetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...input, mobile: true }) });
  const body = await response.json() as { accessToken?: string; refreshToken?: string; error?: string; confirmationRequired?: boolean };
  if (!response.ok || !body.accessToken || !body.refreshToken) throw new Error(body.error ?? (body.confirmationRequired ? "Confirm your email, then sign in." : "Authentication failed"));
  await saveTokens(body.accessToken, body.refreshToken);
}

export async function requestPasswordReset(email: string) {
  const response = await apiFetch("/api/auth/forgot-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
  const body = await response.json() as { error?: string; message?: string };
  if (!response.ok) throw new Error(body.error ?? "Could not send reset email");
  return body.message ?? "Check your email for a reset link.";
}

export async function resolveContainerLabel(payload: string) {
  const response = await request(`/api/labels/resolve?payload=${encodeURIComponent(payload)}`);
  const body = await response.json() as { containerId?: string; error?: string };
  if (!response.ok || !body.containerId) throw new Error(body.error ?? "Label not found");
  return body.containerId;
}

export async function signOut() {
  const { accessToken } = await tokens();
  if (accessToken) await apiFetch("/api/auth/sign-out", { method: "POST", headers: { authorization: `Bearer ${accessToken}` } }).catch(() => undefined);
  await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
}

export async function loadInventory(): Promise<HomeInventory | null> {
  const response = await request("/api/inventory");
  const body = await response.json() as { inventory?: HomeInventory; error?: string };
  if (!response.ok) throw new Error(body.error ?? "Could not load inventory");
  return body.inventory ? normalizeInventoryMediaUrls(body.inventory) : null;
}

function normalizeMediaUrl(uri: string) {
  try {
    const mediaUrl = new URL(uri);
    if (mediaUrl.hostname !== "127.0.0.1" && mediaUrl.hostname !== "localhost") return uri;
    const apiUrl = new URL(API_URL);
    if (apiUrl.hostname === "127.0.0.1" || apiUrl.hostname === "localhost") return uri;
    mediaUrl.hostname = apiUrl.hostname;
    return mediaUrl.toString();
  } catch {
    return uri;
  }
}

function normalizeInventoryMediaUrls(inventory: HomeInventory): HomeInventory {
  return {
    ...inventory,
    rooms: inventory.rooms.map((room) => ({
      ...room,
      photos: room.photos.map((photo) => ({ ...photo, uri: normalizeMediaUrl(photo.uri) })),
      items: room.items.map((item) => ({ ...item, photoUris: item.photoUris?.map(normalizeMediaUrl) })),
    })),
    receipts: inventory.receipts.map((receipt) => {
      const photoUris = receipt.photoUris?.map(normalizeMediaUrl);
      return { ...receipt, imageUri: receipt.imageUri ? normalizeMediaUrl(receipt.imageUri) : null, photoUris };
    }),
    warranties: inventory.warranties.map((warranty) => ({ ...warranty, documentUris: warranty.documentUris?.map(normalizeMediaUrl) })),
  };
}

export async function sendCommand(homeId: string, command: Record<string, unknown>) {
  const response = await request("/api/inventory/commands", { method: "POST", body: JSON.stringify({ homeId, command }) });
  const body = await response.json() as { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Change could not be saved");
}

export async function uploadMedia(homeId: string, entityType: "room" | "item" | "receipt", entityId: string, uri: string) {
  const form = new FormData(); form.append("homeId", homeId); form.append("entityType", entityType); form.append("entityId", entityId);
  form.append("file", { uri, name: `${Date.now()}.jpg`, type: "image/jpeg" } as unknown as Blob);
  const response = await request("/api/media", { method: "POST", body: form });
  const body = await response.json() as { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Upload failed");
}

export async function replaceMedia(homeId: string, entityType: "room" | "item" | "receipt", entityId: string, index: number, uri: string) {
  const form = new FormData(); form.append("homeId", homeId); form.append("entityType", entityType); form.append("entityId", entityId); form.append("replaceIndex", String(index));
  form.append("file", { uri, name: `${Date.now()}-crop.jpg`, type: "image/jpeg" } as unknown as Blob);
  const response = await request("/api/media", { method: "POST", body: form });
  const body = await response.json() as { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Crop could not be saved");
}
