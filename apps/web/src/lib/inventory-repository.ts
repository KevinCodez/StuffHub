import type { Database } from "@stuffhub/domain/database";
import type { HomeInventory, InventoryContainer, InventoryItem, MaintenanceReminder, Receipt, Room, Warranty } from "@stuffhub/domain";
import QRCode from "qrcode";
import { ApiError } from "./api-auth";
import { reachableMediaUrl } from "./media-url";
import type { createSupabaseServerClient } from "./supabase-server";

type Client = ReturnType<typeof createSupabaseServerClient>;

function fail(error: { message: string } | null) {
  if (error) throw new ApiError(400, error.message);
}

async function signedMediaUrls(client: Client, assets: Database["public"]["Tables"]["media_assets"]["Row"][], requestUrl: URL, useMediaProxy: boolean) {
  const entries = await Promise.all(assets.map(async (asset) => {
    if (useMediaProxy) return [asset.id, `/api/media?id=${encodeURIComponent(asset.id)}`] as const;
    const { data, error } = await client.storage.from(asset.bucket_id).createSignedUrl(asset.object_path, 3600);
    return [asset.id, error ? null : reachableMediaUrl(data.signedUrl, requestUrl)] as const;
  }));
  return new Map(entries);
}

export async function loadInventory(client: Client, requestedHomeId: string | null | undefined, requestUrl: URL, useMediaProxy = false): Promise<HomeInventory | null> {
  const homesResult = await client.from("homes").select("id,name,updated_at").order("updated_at", { ascending: false });
  fail(homesResult.error);
  const home = requestedHomeId ? homesResult.data?.find((entry) => entry.id === requestedHomeId) : homesResult.data?.[0];
  if (!home) return null;
  const homeId = home.id;

  const [roomsResult, itemsResult, containersResult, containerItemsResult, receiptsResult, receiptItemsResult,
    warrantiesResult, warrantyItemsResult, remindersResult, reminderItemsResult, assetsResult,
    roomMediaResult, itemMediaResult, receiptPagesResult, warrantyMediaResult] = await Promise.all([
    client.from("rooms").select("*").eq("home_id", homeId).order("created_at"),
    client.from("items").select("*").eq("home_id", homeId).order("created_at"),
    client.from("containers").select("*").eq("home_id", homeId).order("created_at"),
    client.from("container_items").select("*").eq("home_id", homeId),
    client.from("receipts").select("*").eq("home_id", homeId).order("created_at"),
    client.from("receipt_items").select("*").eq("home_id", homeId),
    client.from("warranties").select("*").eq("home_id", homeId).order("created_at"),
    client.from("warranty_items").select("*").eq("home_id", homeId),
    client.from("maintenance_reminders").select("*").eq("home_id", homeId).order("created_at"),
    client.from("maintenance_items").select("*").eq("home_id", homeId),
    client.from("media_assets").select("*").eq("home_id", homeId),
    client.from("room_media").select("*").eq("home_id", homeId).order("sort_order"),
    client.from("item_media").select("*").eq("home_id", homeId).order("sort_order"),
    client.from("receipt_pages").select("*").eq("home_id", homeId).order("page_number"),
    client.from("warranty_media").select("*").eq("home_id", homeId),
  ]);
  for (const result of [roomsResult, itemsResult, containersResult, containerItemsResult, receiptsResult,
    receiptItemsResult, warrantiesResult, warrantyItemsResult, remindersResult, reminderItemsResult,
    assetsResult, roomMediaResult, itemMediaResult, receiptPagesResult, warrantyMediaResult]) fail(result.error);

  const urls = await signedMediaUrls(client, assetsResult.data ?? [], requestUrl, useMediaProxy);
  const items: InventoryItem[] = (itemsResult.data ?? []).map((item) => ({
    id: item.id, roomId: item.room_id, name: item.name, category: item.category,
    description: item.description, estimatedReplacementValueCents: Number(item.estimated_replacement_value_cents),
    purchaseYear: item.purchase_year, serialNumber: item.serial_number, modelNumber: item.model_number, ownerName: item.owner_name,
    confidence: Number(item.confidence),
    photoUris: (itemMediaResult.data ?? []).filter((link) => link.item_id === item.id).map((link) => urls.get(link.media_id)).filter((url): url is string => Boolean(url)),
  }));
  const rooms: Room[] = (roomsResult.data ?? []).map((room) => {
    const photos = (roomMediaResult.data ?? []).filter((link) => link.room_id === room.id).flatMap((link) => {
      const asset = assetsResult.data?.find((entry) => entry.id === link.media_id);
      const uri = urls.get(link.media_id);
      return asset && uri ? [{ id: asset.id, uri, capturedAt: asset.captured_at ?? asset.created_at }] : [];
    });
    return { id: room.id, name: room.name, scanStatus: room.scan_status, photos, photoCount: photos.length, items: items.filter((item) => item.roomId === room.id) };
  });
  const receipts: Receipt[] = (receiptsResult.data ?? []).map((receipt) => {
    const photoUris = (receiptPagesResult.data ?? []).filter((page) => page.receipt_id === receipt.id)
      .map((page) => urls.get(page.processed_media_id ?? page.original_media_id)).filter((url): url is string => Boolean(url));
    return { id: receipt.id, merchant: receipt.merchant, purchaseDate: receipt.purchase_date,
      totalCents: Number(receipt.total_cents), description: receipt.description, createdAt: receipt.created_at,
      itemIds: (receiptItemsResult.data ?? []).filter((link) => link.receipt_id === receipt.id).map((link) => link.item_id),
      imageUri: photoUris[0] ?? null, photoUris };
  });
  const warranties: Warranty[] = (warrantiesResult.data ?? []).map((warranty) => ({
    id: warranty.id, provider: warranty.provider, policyNumber: warranty.policy_number,
    purchaseDate: warranty.purchase_date, durationMonths: warranty.duration_months,
    description: warranty.description, claimContact: warranty.claim_contact, receiptId: warranty.receipt_id,
    itemIds: (warrantyItemsResult.data ?? []).filter((link) => link.warranty_id === warranty.id).map((link) => link.item_id),
    documentUris: (warrantyMediaResult.data ?? []).filter((link) => link.warranty_id === warranty.id).map((link) => urls.get(link.media_id)).filter((url): url is string => Boolean(url)),
  }));
  const maintenanceReminders: MaintenanceReminder[] = (remindersResult.data ?? []).map((reminder) => ({
    id: reminder.id, title: reminder.title, description: reminder.description, startDate: reminder.start_date,
    frequency: reminder.frequency, itemIds: (reminderItemsResult.data ?? []).filter((link) => link.reminder_id === reminder.id).map((link) => link.item_id),
  }));
  const containers: InventoryContainer[] = await Promise.all((containersResult.data ?? []).map(async (container) => ({
    id: container.id, roomId: container.room_id, name: container.name, description: container.description, ownerName: container.owner_name,
    itemIds: (containerItemsResult.data ?? []).filter((link) => link.container_id === container.id).map((link) => link.item_id),
    ...(container.label_payload && container.label_created_at ? { label: { payload: container.label_payload, qrCodeDataUri: await QRCode.toDataURL(container.label_payload, { width: 720, margin: 2, errorCorrectionLevel: "H" }), createdAt: container.label_created_at } } : {}),
  })));
  return { id: home.id, name: home.name, updatedAt: home.updated_at, rooms, receipts, warranties, maintenanceReminders, containers };
}

export async function runInventoryCommand(client: Client, homeId: string, command: InventoryCommand) {
  switch (command.type) {
    case "room.create": return returning(client.from("rooms").insert({ id: command.id, home_id: homeId, name: command.name.trim() }).select("id").single());
    case "room.update": return returning(client.from("rooms").update({ name: command.name.trim() }).eq("home_id", homeId).eq("id", command.id).select("id").single());
    case "room.delete": return returning(client.from("rooms").delete().eq("home_id", homeId).eq("id", command.id).select("id").single());
    case "item.create": return returning(client.from("items").insert({ id: command.id, ...itemRecord(homeId, command.roomId, command.input) }).select("id").single());
    case "item.update": return returning(client.from("items").update(itemRecord(homeId, command.roomId, command.input)).eq("home_id", homeId).eq("id", command.id).select("id").single());
    case "item.photo.delete": {
      const links = await client.from("item_media").select("media_id,sort_order").eq("home_id", homeId).eq("item_id", command.id).order("sort_order");
      fail(links.error);
      const link = links.data?.[command.photoIndex];
      if (!link) throw new ApiError(404, "Photo not found");
      const asset = await client.from("media_assets").select("id,bucket_id,object_path").eq("home_id", homeId).eq("id", link.media_id).single();
      fail(asset.error);
      fail((await client.from("media_assets").delete().eq("home_id", homeId).eq("id", link.media_id)).error);
      if (asset.data) await client.storage.from(asset.data.bucket_id).remove([asset.data.object_path]);
      return { id: link.media_id };
    }
    case "item.delete": return returning(client.from("items").delete().eq("home_id", homeId).eq("id", command.id).select("id").single());
    case "receipt.delete": return returning(client.from("receipts").delete().eq("home_id", homeId).eq("id", command.id).select("id").single());
    case "container.delete": return returning(client.from("containers").delete().eq("home_id", homeId).eq("id", command.id).select("id").single());
    case "container.label.set": return returning(client.from("containers").update({ label_payload: command.payload, label_created_at: command.createdAt }).eq("home_id", homeId).eq("id", command.id).select("id").single());
    case "container.label.delete": return returning(client.from("containers").update({ label_payload: null, label_created_at: new Date().toISOString() }).eq("home_id", homeId).eq("id", command.id).select("id").single());
    case "receipt.save": {
      const record = { home_id: homeId, merchant: command.input.merchant.trim(), purchase_date: command.input.purchaseDate,
        total_cents: command.input.totalCents, description: command.input.description ?? "" };
      const saved = command.id
        ? await returning(client.from("receipts").update(record).eq("home_id", homeId).eq("id", command.id).select("id").single())
        : await returning(client.from("receipts").insert({ id: command.newId, ...record }).select("id").single());
      fail((await client.from("receipt_items").delete().eq("home_id", homeId).eq("receipt_id", saved.id)).error);
      if (command.input.itemIds.length) fail((await client.from("receipt_items").insert(command.input.itemIds.map((itemId) => ({ home_id: homeId, receipt_id: saved.id, item_id: itemId })))).error);
      return saved;
    }
    case "container.save": {
      const record = { home_id: homeId, room_id: command.input.roomId, name: command.input.name.trim(), description: command.input.description, owner_name: command.input.ownerName?.trim() || null };
      const saved = command.id
        ? await returning(client.from("containers").update(record).eq("home_id", homeId).eq("id", command.id).select("id").single())
        : await returning(client.from("containers").insert({ id: command.newId, ...record, label_payload: `stuffhub://container/${command.newId}`, label_created_at: new Date().toISOString() }).select("id").single());
      fail((await client.from("container_items").delete().eq("home_id", homeId).eq("container_id", saved.id)).error);
      if (command.input.itemIds.length) fail((await client.from("container_items").insert(command.input.itemIds.map((itemId) => ({ home_id: homeId, container_id: saved.id, item_id: itemId })))).error);
      return saved;
    }
    case "warranty.save": {
      const record = { home_id: homeId, provider: command.input.provider.trim(), policy_number: command.input.policyNumber,
        purchase_date: command.input.purchaseDate, duration_months: command.input.durationMonths, description: command.input.description,
        claim_contact: command.input.claimContact, receipt_id: command.input.receiptId };
      const saved = command.id
        ? await returning(client.from("warranties").update(record).eq("home_id", homeId).eq("id", command.id).select("id").single())
        : await returning(client.from("warranties").insert({ id: command.newId, ...record }).select("id").single());
      fail((await client.from("warranty_items").delete().eq("home_id", homeId).eq("warranty_id", saved.id)).error);
      if (command.input.itemIds.length) fail((await client.from("warranty_items").insert(command.input.itemIds.map((itemId) => ({ home_id: homeId, warranty_id: saved.id, item_id: itemId })))).error);
      return saved;
    }
    case "maintenance.create": {
      const saved = await returning(client.from("maintenance_reminders").insert({ id: command.id, home_id: homeId,
        title: command.input.title.trim(), description: command.input.description, start_date: command.input.startDate, frequency: command.input.frequency }).select("id").single());
      if (command.input.itemIds.length) fail((await client.from("maintenance_items").insert(command.input.itemIds.map((itemId) => ({ home_id: homeId, reminder_id: saved.id, item_id: itemId })))).error);
      return saved;
    }
    case "receipt.attach": {
      const result = await client.from("receipt_items").upsert({ home_id: homeId, receipt_id: command.receiptId, item_id: command.itemId }).select("receipt_id").single();
      fail(result.error); return { id: command.receiptId };
    }
    default: throw new ApiError(400, "Unsupported command");
  }
}

async function returning(query: PromiseLike<{ data: { id: string } | null; error: { message: string } | null }>) {
  const result = await query;
  fail(result.error);
  if (!result.data) throw new ApiError(404, "Record not found");
  return result.data;
}

function itemRecord(homeId: string, roomId: string, input: ItemInput) {
  return { home_id: homeId, room_id: roomId, name: input.name.trim(), category: input.category,
    description: input.description, estimated_replacement_value_cents: input.estimatedReplacementValueCents,
    purchase_year: input.purchaseYear, serial_number: input.serialNumber, model_number: input.modelNumber ?? null, owner_name: input.ownerName?.trim() || null,
    confidence: 1 };
}

export interface ItemInput { name: string; category: string; description: string; estimatedReplacementValueCents: number; purchaseYear: number | null; serialNumber: string | null; modelNumber?: string | null; ownerName?: string | null }
export type InventoryCommand =
  | { type: "room.create"; id: string; name: string }
  | { type: "room.update"; id: string; name: string }
  | { type: "room.delete"; id: string }
  | { type: "item.create"; id: string; roomId: string; input: ItemInput }
  | { type: "item.update"; id: string; roomId: string; input: ItemInput }
  | { type: "item.photo.delete"; id: string; photoIndex: number }
  | { type: "item.delete"; id: string }
  | { type: "receipt.delete"; id: string }
  | { type: "container.delete"; id: string }
  | { type: "container.label.set"; id: string; payload: string; createdAt: string }
  | { type: "container.label.delete"; id: string }
  | { type: "receipt.save"; id?: string; newId: string; input: { merchant: string; purchaseDate: string | null; totalCents: number; description?: string; itemIds: string[] } }
  | { type: "receipt.attach"; receiptId: string; itemId: string }
  | { type: "container.save"; id?: string; newId: string; input: { roomId: string; name: string; description: string; ownerName?: string | null; itemIds: string[] } }
  | { type: "warranty.save"; id?: string; newId: string; input: Omit<Warranty, "id" | "documentUris"> }
  | { type: "maintenance.create"; id: string; input: Omit<MaintenanceReminder, "id"> };
