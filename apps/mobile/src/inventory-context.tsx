import { type InventoryContainer, type InventoryItem, type MaintenanceReminder, type Receipt, type Room, type RoomPhoto, type Warranty } from "@stuffhub/domain";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { loadInventory, replaceMedia, sendCommand, uploadMedia } from "./backend-api";
import { ChangeConfirmation, type ChangeNotice } from "./components/change-confirmation";

interface InventoryContextValue {
  rooms: Room[];
  receipts: Receipt[];
  warranties: Warranty[];
  maintenanceReminders: MaintenanceReminder[];
  containers: InventoryContainer[];
  refreshInventory: () => Promise<void>;
  replacePhoto: (entityType: "room" | "item" | "receipt", entityId: string, index: number, uri: string) => Promise<void>;
  addRoom: (name: string) => Room;
  updateRoom: (roomId: string, name: string) => void;
  addPhoto: (roomId: string, uri: string) => Promise<void>;
  addItem: (roomId: string, input: NewItemInput) => InventoryItem;
  addReceipt: (itemIds: string[], input: NewReceiptInput) => Promise<Receipt>;
  attachReceiptToItem: (receiptId: string, itemId: string) => void;
  addWarranty: (input: NewWarrantyInput) => Warranty;
  updateWarranty: (warrantyId: string, input: NewWarrantyInput) => void;
  addMaintenanceReminder: (input: NewMaintenanceInput) => MaintenanceReminder;
  saveContainer: (input: Omit<InventoryContainer, "id">, containerId?: string) => InventoryContainer;
  deleteContainer: (containerId: string) => void;
  setContainerLabel: (containerId: string, label: InventoryContainer["label"] | null) => void;
  updateItem: (itemId: string, input: NewItemInput) => void;
  moveItem: (itemId: string, roomId: string) => void;
  updateReceipt: (receiptId: string, input: NewReceiptInput) => Promise<void>;
  deleteItem: (itemId: string) => void;
  deleteReceipt: (receiptId: string) => void;
  deleteRoom: (roomId: string) => void;
  findRoom: (roomId: string) => Room | undefined;
  findItem: (itemId: string) => InventoryItem | undefined;
  findReceipt: (receiptId: string) => Receipt | undefined;
  findPhoto: (photoId: string) => RoomPhoto | undefined;
  receiptsForItem: (itemId: string) => Receipt[];
}

export interface NewItemInput {
  name: string;
  category: string;
  description: string;
  estimatedReplacementValueCents: number;
  purchaseYear: number | null;
  serialNumber: string | null;
  modelNumber?: string | null;
  ownerName?: string | null;
  photoUris?: string[];
}

export interface NewReceiptInput {
  merchant: string;
  purchaseDate: string | null;
  totalCents: number;
  imageUri: string | null;
  photoUris?: string[];
  description?: string;
  itemIds?: string[];
}

export type NewWarrantyInput = Omit<Warranty, "id">;
export type NewMaintenanceInput = Omit<MaintenanceReminder, "id">;

function createId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    const digit = character === "x" ? value : (value & 0x3) | 0x8;
    return digit.toString(16);
  });
}

function confirmationFor(command: Record<string, unknown>) {
  const type = String(command.type ?? "");
  const messages: Record<string, string> = { "room.create": "Room created", "room.update": "Room updated", "room.delete": "Room removed", "item.create": "Item created", "item.update": "Item updated", "item.delete": "Item removed", "receipt.delete": "Receipt removed", "container.delete": "Container removed", "maintenance.create": "Maintenance reminder created" };
  if (type === "container.save") return command.id ? "Container updated" : "Container created";
  if (type === "receipt.save") return command.id ? "Receipt updated" : "Receipt created";
  if (type === "warranty.save") return command.id ? "Warranty updated" : "Warranty created";
  return messages[type] ?? null;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [homeId, setHomeId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [maintenanceReminders, setMaintenanceReminders] = useState<MaintenanceReminder[]>([]);
  const [containers, setContainers] = useState<InventoryContainer[]>([]);
  const [notice, setNotice] = useState<ChangeNotice | null>(null);
  const noticeId = useRef(0); const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showConfirmation = useCallback((message: string) => { if (noticeTimer.current) clearTimeout(noticeTimer.current); setNotice({ id: ++noticeId.current, message }); noticeTimer.current = setTimeout(() => setNotice(null), 2100); }, []);

  const refreshInventory = useCallback(async () => { const inventory = await loadInventory(); if (!inventory) return; setHomeId(inventory.id); setRooms(inventory.rooms); setReceipts(inventory.receipts); setWarranties(inventory.warranties); setMaintenanceReminders(inventory.maintenanceReminders); setContainers(inventory.containers); }, []);
  useEffect(() => { refreshInventory().catch(console.error); }, [refreshInventory]);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);
  const persist = async (command: Record<string, unknown>) => { if (!homeId) return; await sendCommand(homeId, command); const message = confirmationFor(command); if (message) showConfirmation(message); };

  const value = useMemo<InventoryContextValue>(() => ({
    rooms,
    receipts,
    warranties,
    maintenanceReminders,
    containers,
    refreshInventory,
    async replacePhoto(entityType, entityId, index, uri) {
      if (!homeId) throw new Error("Home is not loaded");
      await replaceMedia(homeId, entityType, entityId, index, uri);
      await refreshInventory();
    },
    addRoom(name) {
      const room: Room = {
        id: createId(),
        name: name.trim(),
        photoCount: 0,
        photos: [],
        scanStatus: "not_started",
        items: [],
      };
      setRooms((current) => [...current, room]);
      persist({ type: "room.create", id: room.id, name: room.name });
      return room;
    },
    updateRoom(roomId, name) {
      const trimmedName = name.trim();
      if (!trimmedName) return;
      setRooms((current) => current.map((room) => room.id === roomId ? { ...room, name: trimmedName } : room));
      persist({ type: "room.update", id: roomId, name: trimmedName });
    },
    async addPhoto(roomId, uri) {
      const photo: RoomPhoto = { id: createId(), uri, capturedAt: new Date().toISOString() };
      setRooms((current) => current.map((room) => room.id === roomId
        ? { ...room, photos: [...room.photos, photo], photoCount: room.photoCount + 1, scanStatus: "ready" }
        : room));
      if (homeId) {
        await uploadMedia(homeId, "room", roomId, uri);
        showConfirmation("Photo added");
      }
    },
    addItem(roomId, input) {
      const item: InventoryItem = {
        id: createId(),
        roomId,
        name: input.name.trim(),
        category: input.category,
        description: input.description.trim(),
        estimatedReplacementValueCents: input.estimatedReplacementValueCents,
        purchaseYear: input.purchaseYear,
        serialNumber: input.serialNumber,
        modelNumber: input.modelNumber ?? null,
        ownerName: input.ownerName ?? null,
        photoUris: input.photoUris ?? [],
        confidence: 1,
      };
      setRooms((current) => current.map((room) => room.id === roomId
        ? { ...room, items: [...room.items, item] }
        : room));
      void persist({ type: "item.create", id: item.id, roomId, input }).then(() => homeId ? Promise.all((input.photoUris ?? []).map((uri) => uploadMedia(homeId, "item", item.id, uri))) : undefined).catch(console.error);
      return item;
    },
    async addReceipt(itemIds, input) {
      const receipt: Receipt = {
        id: createId(),
        merchant: input.merchant.trim(),
        purchaseDate: input.purchaseDate,
        totalCents: input.totalCents,
        imageUri: input.imageUri,
        itemIds,
        createdAt: new Date().toISOString(),
        photoUris: input.photoUris ?? (input.imageUri ? [input.imageUri] : []),
        description: input.description ?? "",
      };
      setReceipts((current) => [...current, receipt]);
      await persist({ type: "receipt.save", newId: receipt.id, input: { merchant: receipt.merchant, purchaseDate: receipt.purchaseDate, totalCents: receipt.totalCents, description: receipt.description, itemIds } });
      if (homeId) await Promise.all((receipt.photoUris ?? []).map((uri) => uploadMedia(homeId, "receipt", receipt.id, uri)));
      if (homeId) await refreshInventory();
      return receipt;
    },
    attachReceiptToItem(receiptId, itemId) {
      setReceipts((current) => current.map((receipt) => receipt.id === receiptId && !receipt.itemIds.includes(itemId) ? { ...receipt, itemIds: [...receipt.itemIds, itemId] } : receipt));
      persist({ type: "receipt.attach", receiptId, itemId });
    },
    addWarranty(input) {
      const warranty: Warranty = { id: createId(), ...input };
      setWarranties((current) => [...current, warranty]);
      persist({ type: "warranty.save", newId: warranty.id, input });
      return warranty;
    },
    updateWarranty(warrantyId, input) {
      setWarranties((current) => current.map((warranty) => warranty.id === warrantyId ? { id: warranty.id, ...input } : warranty));
      persist({ type: "warranty.save", id: warrantyId, newId: warrantyId, input });
    },
    addMaintenanceReminder(input) {
      const reminder: MaintenanceReminder = { id: createId(), ...input };
      setMaintenanceReminders((current) => [...current, reminder]);
      persist({ type: "maintenance.create", id: reminder.id, input });
      return reminder;
    },
    saveContainer(input, containerId) {
      const existing = containers.find((entry) => entry.id === containerId);
      const newId = containerId ?? createId();
      const container: InventoryContainer = { id: newId, ...input, ...(existing?.label ? { label: existing.label } : {}) };
      setContainers((current) => [...current.filter((entry) => entry.id !== container.id).map((entry) => ({ ...entry, itemIds: entry.itemIds.filter((itemId) => !input.itemIds.includes(itemId)) })), container]);
      persist({ type: "container.save", ...(containerId ? { id: containerId } : {}), newId: container.id, input: { roomId: input.roomId, name: input.name, description: input.description, ownerName: input.ownerName ?? null, itemIds: input.itemIds } });
      return container;
    },
    deleteContainer(containerId) {
      setContainers((current) => current.filter((container) => container.id !== containerId));
      persist({ type: "container.delete", id: containerId });
    },
    setContainerLabel(containerId, label) {
      setContainers((current) => current.map((container) => container.id === containerId ? { ...container, ...(label ? { label } : {}) } : container).map((container) => container.id === containerId && !label ? (({ label: _label, ...rest }) => rest)(container) : container));
      if (label) persist({ type: "container.label.set", id: containerId, payload: label.payload, createdAt: label.createdAt });
      else persist({ type: "container.label.delete", id: containerId });
    },
    updateItem(itemId, input) {
      const currentItem = rooms.flatMap((room) => room.items).find((item) => item.id === itemId);
      const newPhotoUris = (input.photoUris ?? []).filter((uri) => !currentItem?.photoUris?.includes(uri));
      const removedPhotoIndexes = (currentItem?.photoUris ?? []).map((uri, index) => ({ uri, index })).filter(({ uri }) => !(input.photoUris ?? []).includes(uri)).map(({ index }) => index).sort((a, b) => b - a);
      setRooms((current) => current.map((room) => ({
        ...room,
        items: room.items.map((item) => item.id === itemId ? {
          ...item,
          name: input.name.trim(),
          category: input.category,
          description: input.description.trim(),
          estimatedReplacementValueCents: input.estimatedReplacementValueCents,
          purchaseYear: input.purchaseYear,
          serialNumber: input.serialNumber,
          modelNumber: input.modelNumber ?? item.modelNumber ?? null,
          ownerName: input.ownerName ?? null,
          photoUris: input.photoUris ?? item.photoUris ?? [],
        } : item),
      }))); 
      if (currentItem) void removedPhotoIndexes.reduce((chain, photoIndex) => chain.then(() => persist({ type: "item.photo.delete", id: itemId, photoIndex })), Promise.resolve()).then(() => persist({ type: "item.update", id: itemId, roomId: currentItem.roomId, input })).then(() => homeId ? Promise.all(newPhotoUris.map((uri) => uploadMedia(homeId, "item", itemId, uri))) : undefined).catch(console.error);
    },
    moveItem(itemId, roomId) {
      const currentItem = rooms.flatMap((room) => room.items).find((entry) => entry.id === itemId);
      if (!currentItem || currentItem.roomId === roomId) return;
      setRooms((current) => {
        const item = current.flatMap((room) => room.items).find((entry) => entry.id === itemId);
        if (!item || item.roomId === roomId || !current.some((room) => room.id === roomId)) return current;
        const movedItem = { ...item, roomId };
        return current.map((room) => room.id === roomId
          ? { ...room, items: [...room.items, movedItem] }
          : { ...room, items: room.items.filter((entry) => entry.id !== itemId) });
      });
      if (currentItem) persist({ type: "item.update", id: itemId, roomId, input: { name: currentItem.name, category: currentItem.category, description: currentItem.description, estimatedReplacementValueCents: currentItem.estimatedReplacementValueCents, purchaseYear: currentItem.purchaseYear, serialNumber: currentItem.serialNumber, modelNumber: currentItem.modelNumber, ownerName: currentItem.ownerName ?? null } });
    },
    async updateReceipt(receiptId, input) {
      const existing = receipts.find((receipt) => receipt.id === receiptId);
      const newPhotoUris = (input.photoUris ?? []).filter((uri) => !existing?.photoUris?.includes(uri));
      setReceipts((current) => current.map((receipt) => receipt.id === receiptId ? {
        ...receipt,
        merchant: input.merchant.trim(),
        purchaseDate: input.purchaseDate,
        totalCents: input.totalCents,
        imageUri: input.imageUri,
        itemIds: input.itemIds ?? receipt.itemIds,
        photoUris: input.photoUris ?? receipt.photoUris,
        description: input.description ?? receipt.description,
      } : receipt));
      await persist({ type: "receipt.save", id: receiptId, newId: receiptId, input: { merchant: input.merchant, purchaseDate: input.purchaseDate, totalCents: input.totalCents, description: input.description ?? existing?.description ?? "", itemIds: input.itemIds ?? existing?.itemIds ?? [] } });
      if (homeId) await Promise.all(newPhotoUris.map((uri) => uploadMedia(homeId, "receipt", receiptId, uri)));
      if (homeId) await refreshInventory();
    },
    deleteItem(itemId) {
      setRooms((current) => current.map((room) => ({
        ...room,
        items: room.items.filter((item) => item.id !== itemId),
      })));
      setReceipts((current) => current.filter((receipt) => !receipt.itemIds.includes(itemId)));
      setContainers((current) => current.map((container) => ({ ...container, itemIds: container.itemIds.filter((id) => id !== itemId) })));
      persist({ type: "item.delete", id: itemId });
    },
    deleteReceipt(receiptId) {
      setReceipts((current) => current.filter((receipt) => receipt.id !== receiptId));
      persist({ type: "receipt.delete", id: receiptId });
    },
    deleteRoom(roomId) {
      const itemIds = new Set(rooms.find((room) => room.id === roomId)?.items.map((item) => item.id) ?? []);
      setRooms((current) => current.filter((room) => room.id !== roomId));
      setReceipts((current) => current.filter((receipt) => !receipt.itemIds.some((itemId) => itemIds.has(itemId))));
      setContainers((current) => current.filter((container) => container.roomId !== roomId));
      persist({ type: "room.delete", id: roomId });
    },
    findRoom(roomId) {
      return rooms.find((room) => room.id === roomId);
    },
    findItem(itemId) {
      return rooms.flatMap((room) => room.items).find((item) => item.id === itemId);
    },
    findReceipt(receiptId) {
      return receipts.find((receipt) => receipt.id === receiptId);
    },
    findPhoto(photoId) {
      return rooms.flatMap((room) => room.photos).find((photo) => photo.id === photoId);
    },
    receiptsForItem(itemId) {
      return receipts.filter((receipt) => receipt.itemIds.includes(itemId));
    },
  }), [containers, homeId, maintenanceReminders, receipts, refreshInventory, rooms, showConfirmation, warranties]);

  return <InventoryContext.Provider value={value}>{children}<ChangeConfirmation notice={notice} /></InventoryContext.Provider>;
}

export function useInventory() {
  const value = useContext(InventoryContext);
  if (!value) throw new Error("useInventory must be used inside InventoryProvider");
  return value;
}
