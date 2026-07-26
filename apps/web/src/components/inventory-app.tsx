"use client";

import { formatCurrency, type HomeInventory, type InventoryContainer, type InventoryItem, type MaintenanceReminder, type Receipt, type Room, type RoomPhoto, type Warranty } from "@stuffhub/domain";
import { useRef, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft, Box, CalendarClock, Camera, Check, ChevronRight, Home as HomeIcon, Pencil, Plus, Printer, QrCode, ReceiptText, Search, Sparkles, TrendingUp, UserRound, X, type LucideIcon } from "lucide-react";
import { CurrencyField, DateField } from "./form-fields";
import { RecordForm } from "./record-forms";
import { ItemEditor } from "./item-editor";
import { ContainerForm } from "./container-form";
import { SearchPage } from "./search-page";
import { printContainerLabel } from "../lib/print-container-label";
import { QrScanner } from "./qr-scanner";

type Screen = { name: "home" } | { name: "search" } | { name: "scan" } | { name: "collection"; kind: "rooms" | "containers" | "appliances" | "warranties" | "maintenance" | "receipts" } | { name: "record-form"; kind: "appliance" | "warranty" | "maintenance"; recordId?: string } | { name: "container"; id: string; roomId?: string } | { name: "container-form"; containerId?: string; roomId?: string } | { name: "add-room" } | { name: "room"; id: string } | { name: "item"; id: string } | { name: "item-form"; roomId?: string; itemId?: string } | { name: "receipt-form"; itemId?: string; receiptId?: string; returnTo: "collection" | "item" } | { name: "photo"; id: string; roomId: string };
type ItemInput = Pick<InventoryItem, "name" | "category" | "description" | "estimatedReplacementValueCents" | "purchaseYear" | "serialNumber" | "ownerName" | "photoUris">;
type ReceiptInput = Pick<Receipt, "merchant" | "purchaseDate" | "totalCents" | "imageUri"> & { description?: string; photoUris?: string[]; itemIds?: string[] };

function id() {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === "function") return webCrypto.randomUUID();

  const bytes = new Uint8Array(16);
  if (typeof webCrypto?.getRandomValues === "function") webCrypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
function dayGreeting() { const hour = new Date().getHours(); return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"; }

export function InventoryApp({ initialInventory, onCommand, onUploadMedia }: { initialInventory: HomeInventory; onCommand: (command: Record<string, unknown>) => Promise<void>; onUploadMedia: (entityType: "room" | "item" | "receipt", entityId: string, file: File, replaceIndex?: number) => Promise<void> }) {
  const [rooms, setRooms] = useState<Room[]>(() => initialInventory.rooms.map((room) => ({ ...room, items: [...room.items], photos: [...room.photos] })));
  const [receipts, setReceipts] = useState<Receipt[]>(() => [...initialInventory.receipts]);
  const [warranties, setWarranties] = useState<Warranty[]>(() => [...initialInventory.warranties]);
  const [maintenanceReminders, setMaintenanceReminders] = useState<MaintenanceReminder[]>(() => [...initialInventory.maintenanceReminders]);
  const [containers, setContainers] = useState<InventoryContainer[]>(() => [...initialInventory.containers]);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const allItems = rooms.flatMap((room) => room.items);
  const total = allItems.reduce((sum, item) => sum + item.estimatedReplacementValueCents, 0);
  const findRoom = (roomId: string) => rooms.find((room) => room.id === roomId);
  const findItem = (itemId: string) => allItems.find((item) => item.id === itemId);

  function addRoom(name: string) {
    const room: Room = { id: id(), name, photoCount: 0, photos: [], scanStatus: "not_started", items: [] };
    setRooms((current) => [...current, room]);
    void onCommand({ type: "room.create", id: room.id, name: room.name });
    setScreen({ name: "room", id: room.id });
  }

  function deleteRoom(roomId: string) {
    const room = findRoom(roomId);
    if (!room || !confirm(`Delete ${room.name}, its items, photos, and linked receipts?`)) return;
    const itemIds = new Set(room.items.map((item) => item.id));
    room.photos.forEach((photo) => URL.revokeObjectURL(photo.uri));
    setRooms((current) => current.filter((entry) => entry.id !== roomId));
    void onCommand({ type: "room.delete", id: roomId });
    setReceipts((current) => current.filter((receipt) => !receipt.itemIds.some((itemId) => itemIds.has(itemId))));
    setScreen({ name: "home" });
  }

  function editRoomName(roomId: string) {
    const room = findRoom(roomId);
    if (!room) return;
    const name = prompt("Room name", room.name)?.trim();
    if (!name) return;
    setRooms((current) => current.map((entry) => entry.id === roomId ? { ...entry, name } : entry));
    void onCommand({ type: "room.update", id: roomId, name });
  }

  function saveItem(roomId: string, input: ItemInput, itemId?: string, photoFiles: File[] = []) {
    let persistence: Promise<void>;
    if (itemId) { const existingItem = findItem(itemId); const removedPhotoIndexes = (existingItem?.photoUris ?? []).map((uri, index) => ({ uri, index })).filter(({ uri }) => !(input.photoUris ?? []).includes(uri)).map(({ index }) => index).sort((a, b) => b - a); persistence = removedPhotoIndexes.reduce((chain, photoIndex) => chain.then(() => onCommand({ type: "item.photo.delete", id: itemId, photoIndex })), Promise.resolve()).then(() => onCommand({ type: "item.update", id: itemId, roomId, input })); setRooms((current) => {
      const existing = current.flatMap((room) => room.items).find((item) => item.id === itemId);
      if (!existing) return current;
      const updated = { ...existing, ...input, roomId };
      return current.map((room) => room.id === roomId ? { ...room, items: [...room.items.filter((item) => item.id !== itemId), updated] } : { ...room, items: room.items.filter((item) => item.id !== itemId) });
    }); }
    else {
      const item: InventoryItem = { id: id(), roomId, ...input, confidence: 1 };
      setRooms((current) => current.map((room) => room.id === roomId ? { ...room, items: [...room.items, item] } : room));
      persistence = onCommand({ type: "item.create", id: item.id, roomId, input });
      itemId = item.id;
    }
    const savedItemId = itemId;
    void persistence.then(() => Promise.all(photoFiles.map((file) => onUploadMedia("item", savedItemId, file)))).catch(console.error);
    setScreen({ name: "item", id: itemId });
    return itemId;
  }

  function deleteItem(itemId: string) {
    if (!confirm("Delete this item and its linked receipts?")) return;
    const item = findItem(itemId);
    setRooms((current) => current.map((room) => ({ ...room, items: room.items.filter((entry) => entry.id !== itemId) })));
    void onCommand({ type: "item.delete", id: itemId });
    setReceipts((current) => current.filter((receipt) => !receipt.itemIds.includes(itemId)));
    setScreen(item ? { name: "room", id: item.roomId } : { name: "home" });
  }

  async function saveReceipt(itemId: string | undefined, input: ReceiptInput, receiptId?: string, photoFiles: File[] = []) {
    const newId = receiptId ?? id();
    const existing = receiptId ? receipts.find((receipt) => receipt.id === receiptId) : undefined;
    const itemIds = input.itemIds ?? (itemId ? [itemId] : []);
    if (receiptId) setReceipts((current) => current.map((receipt) => receipt.id === receiptId ? { ...receipt, ...input, itemIds } : receipt));
    else setReceipts((current) => [...current, { id: newId, itemIds, createdAt: new Date().toISOString(), ...input }]);
    await onCommand({ type: "receipt.save", ...(receiptId ? { id: receiptId } : {}), newId, input: { merchant: input.merchant, purchaseDate: input.purchaseDate, totalCents: input.totalCents, description: input.description ?? "", itemIds } });
    await Promise.all(photoFiles.map((file, index) => onUploadMedia("receipt", newId, file, existing?.photoUris?.length && index === 0 ? 0 : undefined)));
  }

  function deleteReceipt(receiptId: string) {
    const receipt = receipts.find((entry) => entry.id === receiptId);
    if (!receipt || !confirm("Delete this receipt?")) return;
    setReceipts((current) => current.filter((entry) => entry.id !== receiptId));
    void onCommand({ type: "receipt.delete", id: receiptId });
  }

  function uploadRoomPhotos(roomId: string, files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    const photos: RoomPhoto[] = selected.map((file) => ({ id: id(), uri: URL.createObjectURL(file), capturedAt: new Date().toISOString() }));
    setRooms((current) => current.map((room) => room.id === roomId ? { ...room, photos: [...room.photos, ...photos], photoCount: room.photoCount + photos.length, scanStatus: "ready" } : room));
    void Promise.all(selected.map((file) => onUploadMedia("room", roomId, file))).catch(console.error);
  }

  function saveContainerRecord(input: Omit<InventoryContainer, "id">, container?: InventoryContainer) {
    const saved = { id: container?.id ?? id(), ...input, ...(container?.label ? { label: container.label } : {}) };
    setContainers((current) => [...current.filter((entry) => entry.id !== saved.id).map((entry) => ({ ...entry, itemIds: entry.itemIds.filter((itemId) => !saved.itemIds.includes(itemId)) })), saved]);
    void onCommand({ type: "container.save", ...(container ? { id: container.id } : {}), newId: saved.id, input: { roomId: saved.roomId, name: saved.name, description: saved.description, ownerName: saved.ownerName ?? null, itemIds: saved.itemIds } });
  }

  function saveWarrantyRecord(input: Omit<Warranty, "id">, warranty?: Warranty) {
    const saved = { id: warranty?.id ?? id(), ...input };
    setWarranties((current) => warranty ? current.map((entry) => entry.id === warranty.id ? saved : entry) : [...current, saved]);
    void onCommand({ type: "warranty.save", ...(warranty ? { id: warranty.id } : {}), newId: saved.id, input: { provider: saved.provider, policyNumber: saved.policyNumber, purchaseDate: saved.purchaseDate, durationMonths: saved.durationMonths, description: saved.description, claimContact: saved.claimContact, itemIds: saved.itemIds, receiptId: saved.receiptId } });
  }

  function saveMaintenanceRecord(input: Omit<MaintenanceReminder, "id">) {
    const saved = { id: id(), ...input }; setMaintenanceReminders((current) => [...current, saved]);
    void onCommand({ type: "maintenance.create", id: saved.id, input });
  }

  const content = (() => {
    if (screen.name === "home") return <Home rooms={rooms} containers={containers} itemCount={allItems.length} receiptCount={receipts.length} maintenanceCount={maintenanceReminders.length} total={total} onOpen={(kind) => setScreen({ name: "collection", kind })} onAddItem={() => setScreen({ name: "item-form" })} onItem={(itemId) => setScreen({ name: "item", id: itemId })} />;
    if (screen.name === "search") return <SearchPage rooms={rooms} containers={containers} warranties={warranties} receipts={receipts} onItem={(id) => setScreen({ name: "item", id })} onContainer={(id) => setScreen({ name: "container", id })} onWarranty={(recordId) => setScreen({ name: "record-form", kind: "warranty", recordId })} onReceipt={(receiptId) => setScreen({ name: "receipt-form", receiptId, returnTo: "collection" })} />;
    if (screen.name === "scan") return <QrScanner containers={containers} rooms={rooms} onClose={() => setScreen({ name: "home" })} onOpen={(id) => setScreen({ name: "container", id })} />;
    if (screen.name === "collection") return <CollectionView kind={screen.kind} rooms={rooms} containers={containers} receipts={receipts} warranties={warranties} maintenanceReminders={maintenanceReminders} onBack={() => setScreen({ name: "home" })} onRoom={(id) => setScreen({ name: "room", id })} onItem={(id) => setScreen({ name: "item", id })} onReceipt={(receiptId, itemId) => setScreen({ name: "receipt-form", ...(itemId ? { itemId } : {}), receiptId, returnTo: "collection" })} onContainer={(containerId) => setScreen({ name: "container", id: containerId })} onAddContainer={() => setScreen({ name: "container-form" })} onAddRoom={() => setScreen({ name: "add-room" })} onWarranty={(recordId) => setScreen({ name: "record-form", kind: "warranty", recordId })} onAddRecord={(kind) => setScreen({ name: "record-form", kind })} onAddReceipt={() => setScreen({ name: "receipt-form", returnTo: "collection" })} />;
    if (screen.name === "container-form") { const container = screen.containerId ? containers.find((entry) => entry.id === screen.containerId) : undefined; const ownerNames = Array.from(new Set([...allItems.map((item) => item.ownerName), ...containers.map((entry) => entry.ownerName)].filter((owner): owner is string => Boolean(owner)))).sort(); return <ContainerForm rooms={rooms} items={allItems} ownerNames={ownerNames} {...(screen.roomId ? { defaultRoomId: screen.roomId } : {})} {...(container ? { container } : {})} onBack={() => setScreen(screen.roomId ? { name: "room", id: screen.roomId } : { name: "collection", kind: "containers" })} onAddRoom={(name) => { const room: Room = { id: id(), name, photoCount: 0, photos: [], scanStatus: "not_started", items: [] }; setRooms((current) => [...current, room]); void onCommand({ type: "room.create", id: room.id, name: room.name }); return room.id; }} onQuickAddItem={(targetRoomId, name, photoUris) => { const item: InventoryItem = { id: id(), roomId: targetRoomId, name, category: "Other", description: "", estimatedReplacementValueCents: 0, purchaseYear: null, serialNumber: null, confidence: 1, photoUris }; setRooms((current) => current.map((room) => room.id === targetRoomId ? { ...room, items: [...room.items, item] } : room)); void onCommand({ type: "item.create", id: item.id, roomId: targetRoomId, input: item }); return item.id; }} onSave={(input) => { saveContainerRecord(input, container); setScreen(screen.roomId ? { name: "room", id: screen.roomId } : { name: "collection", kind: "containers" }); }} {...(container ? { onDelete: () => { if (window.confirm(`Delete ${container.name}? Items inside it will remain in their room.`)) { setContainers((current) => current.filter((entry) => entry.id !== container.id)); void onCommand({ type: "container.delete", id: container.id }); setScreen(screen.roomId ? { name: "room", id: screen.roomId } : { name: "collection", kind: "containers" }); } } } : {})} />; }
    if (screen.name === "record-form") { const warranty = screen.kind === "warranty" && screen.recordId ? warranties.find((entry) => entry.id === screen.recordId) : undefined; return <RecordForm kind={screen.kind} rooms={rooms} receipts={receipts} {...(warranty ? { warranty } : {})} onBack={() => setScreen({ name: "collection", kind: screen.kind === "appliance" ? "appliances" : screen.kind === "warranty" ? "warranties" : "maintenance" })} onSaveAppliance={(roomId, item) => { saveItem(roomId, item); setScreen({ name: "collection", kind: "appliances" }); }} onSaveWarranty={(input) => { saveWarrantyRecord(input, warranty); setScreen({ name: "collection", kind: "warranties" }); }} onSaveMaintenance={(reminder) => { saveMaintenanceRecord(reminder); setScreen({ name: "collection", kind: "maintenance" }); }} />; }
    if (screen.name === "add-room") return <AddRoom onBack={() => setScreen({ name: "home" })} onSave={addRoom} />;
    if (screen.name === "room") { const room = findRoom(screen.id); return room ? <RoomView room={room} containers={containers.filter((container) => container.roomId === room.id)} onBack={() => setScreen({ name: "home" })} onItem={(itemId) => setScreen({ name: "item", id: itemId })} onAddItem={() => setScreen({ name: "item-form", roomId: room.id })} onContainer={(containerId) => setScreen({ name: "container", id: containerId, roomId: room.id })} onAddContainer={() => setScreen({ name: "container-form", roomId: room.id })} onUpload={(files) => uploadRoomPhotos(room.id, files)} onPhoto={(photoId) => setScreen({ name: "photo", id: photoId, roomId: room.id })} onEditName={() => editRoomName(room.id)} onDelete={() => deleteRoom(room.id)} /> : null; }
    if (screen.name === "container") { const container = containers.find((entry) => entry.id === screen.id); const room = container ? findRoom(container.roomId) : undefined; return container ? <ContainerView container={container} {...(room ? { room } : {})} items={container.itemIds.map(findItem).filter((item): item is InventoryItem => Boolean(item))} onBack={() => setScreen(screen.roomId ? { name: "room", id: screen.roomId } : { name: "collection", kind: "containers" })} onItem={(itemId) => setScreen({ name: "item", id: itemId })} onEdit={() => setScreen({ name: "container-form", containerId: container.id, ...(screen.roomId ? { roomId: screen.roomId } : {}) })} onCreateLabel={async () => { const payload = `stuffhub://container/${container.id}`; const qrCodeDataUri = await QRCode.toDataURL(payload, { width: 720, margin: 2, errorCorrectionLevel: "H" }); const createdAt = new Date().toISOString(); setContainers((current) => current.map((entry) => entry.id === container.id ? { ...entry, label: { payload, qrCodeDataUri, createdAt } } : entry)); await onCommand({ type: "container.label.set", id: container.id, payload, createdAt }); }} /> : null; }
    if (screen.name === "item") { const item = findItem(screen.id); if (!item) return null; const room = findRoom(item.roomId); return <ItemView item={item} {...(room ? { room } : {})} receipts={receipts.filter((receipt) => receipt.itemIds.includes(item.id))} onBack={() => setScreen({ name: "room", id: item.roomId })} onEdit={() => setScreen({ name: "item-form", roomId: item.roomId, itemId: item.id })} onAddPhoto={(file) => { const uri = URL.createObjectURL(file); setRooms((current) => current.map((entry) => ({ ...entry, items: entry.items.map((record) => record.id === item.id ? { ...record, photoUris: [...(record.photoUris ?? []), uri] } : record) }))); void onUploadMedia("item", item.id, file).catch(console.error); }} onAddReceipt={() => setScreen({ name: "receipt-form", itemId: item.id, returnTo: "item" })} onReceipt={(receiptId) => setScreen({ name: "receipt-form", itemId: item.id, receiptId, returnTo: "item" })} />; }
    if (screen.name === "item-form") { const room = screen.roomId ? findRoom(screen.roomId) : undefined; const item = screen.itemId ? findItem(screen.itemId) : undefined; return <ItemEditor rooms={rooms} receipts={receipts} {...(room ? { room } : {})} {...(item ? { item } : {})} onBack={() => setScreen(screen.itemId ? { name: "item", id: screen.itemId } : screen.roomId ? { name: "room", id: screen.roomId } : { name: "home" })} onAddRoom={(name) => { const createdRoom: Room = { id: id(), name, photoCount: 0, photos: [], scanStatus: "not_started", items: [] }; setRooms((current) => [...current, createdRoom]); void onCommand({ type: "room.create", id: createdRoom.id, name: createdRoom.name }); return createdRoom.id; }} onSave={(input, destinationRoomId, attachments) => { const savedId = saveItem(destinationRoomId, input, screen.itemId, attachments.itemPhotoFiles); if (!savedId) return; if (attachments.existingReceiptIds.length) { setReceipts((current) => current.map((receipt) => attachments.existingReceiptIds.includes(receipt.id) && !receipt.itemIds.includes(savedId) ? { ...receipt, itemIds: [...receipt.itemIds, savedId] } : receipt)); attachments.existingReceiptIds.forEach((receiptId) => void onCommand({ type: "receipt.attach", receiptId, itemId: savedId })); } if (attachments.receipt?.merchant) void saveReceipt(savedId, attachments.receipt, undefined, attachments.receiptPhotoFiles).catch(console.error); if (attachments.warranty?.provider) saveWarrantyRecord({ itemIds: [savedId], receiptId: null, documentUris: [], ...attachments.warranty }); }} {...(screen.itemId ? { onDelete: () => deleteItem(screen.itemId!) } : {})} />; }
    if (screen.name === "receipt-form") { const item = screen.itemId ? findItem(screen.itemId) : undefined; const receipt = screen.receiptId ? receipts.find((entry) => entry.id === screen.receiptId) : undefined; const destination: Screen = screen.returnTo === "item" && item ? { name: "item", id: item.id } : { name: "collection", kind: "receipts" }; return <ReceiptForm {...(item ? { item } : {})} items={allItems} {...(receipt ? { receipt, onDelete: () => { deleteReceipt(receipt.id); setScreen(destination); } } : {})} onBack={() => setScreen(destination)} onSave={async (input, files) => { await saveReceipt(item?.id, input, receipt?.id, files); setScreen(destination); }} />; }
    if (screen.name === "photo") { const photo = rooms.flatMap((room) => room.photos).find((entry) => entry.id === screen.id); return photo ? <PhotoView photo={photo} onBack={() => setScreen({ name: "room", id: screen.roomId })} /> : null; }
    return null;
  })();

  const openHome = () => setScreen({ name: "home" });
  const openSearch = () => setScreen({ name: "search" });
  const openScan = () => setScreen({ name: "scan" });
  const openProfile = () => setScreen({ name: "collection", kind: "receipts" });
  return <main><Header active={screen.name === "search" ? "search" : "home"} onHome={openHome} onSearch={openSearch} onScan={openScan} />{content}<MobileToolbar screen={screen} onHome={openHome} onScan={openScan} onAdd={() => setScreen({ name: "item-form" })} onSearch={openSearch} onProfile={openProfile} /></main>;
}

function Header({ active, onHome, onSearch, onScan }: { active: "home" | "search"; onHome: () => void; onSearch: () => void; onScan: () => void }) { return <header className="topbar"><button className="brand brand-button" onClick={onHome}><span className="brand-mark">S</span><span>StuffHub</span></button><nav><button className={`nav-button ${active === "home" ? "active" : ""}`} onClick={onHome}>Home</button><button className={`nav-button nav-search ${active === "search" ? "active" : ""}`} onClick={onSearch}><Search size={16} /> Search</button><span className="avatar">KH</span></nav><button className="mobile-header-scan" onClick={onScan} aria-label="Scan container QR code"><QrCode size={21} /></button></header>; }

function MobileToolbar({ screen, onHome, onScan, onAdd, onSearch, onProfile }: { screen: Screen; onHome: () => void; onScan: () => void; onAdd: () => void; onSearch: () => void; onProfile: () => void }) {
  const scanActive = screen.name === "scan";
  const profileActive = screen.name === "collection" && screen.kind === "receipts";
  return <nav className="mobile-toolbar" aria-label="Primary navigation">
    <button className={screen.name === "home" ? "active" : ""} onClick={onHome}><HomeIcon size={22} /><span>Home</span></button>
    <button className={scanActive ? "active" : ""} onClick={onScan}><QrCode size={22} /><span>Scan</span></button>
    <button className="mobile-toolbar-add" onClick={onAdd} aria-label="Add item"><Plus size={29} /></button>
    <button className={screen.name === "search" ? "active" : ""} onClick={onSearch}><Search size={23} /><span>Search</span></button>
    <button className={profileActive ? "active" : ""} onClick={onProfile}><UserRound size={23} /><span>Profile</span></button>
  </nav>;
}

function Home({ rooms, containers, itemCount, receiptCount, maintenanceCount, total, onOpen, onAddItem, onItem }: { rooms: Room[]; containers: InventoryContainer[]; itemCount: number; receiptCount: number; maintenanceCount: number; total: number; onOpen: (kind: "rooms" | "containers" | "warranties" | "maintenance" | "receipts") => void; onAddItem: () => void; onItem: (id: string) => void }) {
  const allItems = rooms.flatMap((room) => room.items);
  const photographed = allItems.filter((item) => item.photoUris?.length);
  const recent = [...allItems].reverse().slice(0, 4);
  const greeting = dayGreeting();
  const activeDays = Math.min(7, itemCount);
  const weekDays = ["M", "T", "W", "T", "F", "S", "S"];
  return <div className="dashboard-shell">
    <section className="dashboard-welcome"><div className="welcome-copy"><p className="eyebrow">Welcome home</p><h1 suppressHydrationWarning>Good {greeting}.</h1><p>Here’s your home, organized and protected.</p><button className="manage-home" onClick={() => onOpen("rooms")}><HomeIcon size={16} /> Manage home</button></div><div className="hero-photo" aria-hidden="true"><img src="/images/hero.png" alt="" /></div></section>
    <section className="snapshot-card"><p className="card-kicker">Your home snapshot</p><div className="snapshot-grid"><Snapshot icon={Check} value={itemCount} label="Items" note="documented" /><Snapshot icon={Box} value={containers.length} label="Containers" note="tracked" /><Snapshot icon={ReceiptText} value={receiptCount} label="Receipts" note="saved" /><Snapshot icon={CalendarClock} value={maintenanceCount} label="Maintenance" note="scheduled" /></div></section>
    <button className="capture-banner" onClick={onAddItem}><span className="capture-icon"><Camera size={27} /></span><span><strong>Add an item</strong><small>Document what matters. Build your home record.</small></span><b>Get started <ChevronRight size={17} /></b><Sparkles className="capture-sparkle" size={22} /></button>
    <section className="insight-grid"><article className="value-card"><div><p className="card-kicker">Estimated replacement value</p><strong>{formatCurrency(total)}</strong><span><TrendingUp size={13} /> Your documented total</span><small>{rooms.length} rooms · {itemCount} documented items</small></div><svg className="value-chart" viewBox="0 0 220 70" preserveAspectRatio="none" aria-hidden="true"><path d="M0 60 C25 58 37 48 57 51 S88 59 106 39 S140 38 157 25 S188 21 220 4" /><path className="fill" d="M0 60 C25 58 37 48 57 51 S88 59 106 39 S140 38 157 25 S188 21 220 4 L220 70 L0 70Z" /></svg></article><article className="streak-card"><p className="card-kicker">This week</p><div className="streak-summary"><img src="/images/badge1.png" alt="Weekly documentation badge" /><div><span>You documented</span><strong>{itemCount} {itemCount === 1 ? "item" : "items"}</strong><small>{itemCount ? "Keep it up!" : "Let’s get started!"}</small></div></div><div className="week-progress">{weekDays.map((day, index) => <div className={index < activeDays ? "complete" : ""} key={`${day}-${index}`}><span>{index < activeDays ? <Check size={12} /> : null}</span><b>{day}</b></div>)}</div></article></section>
    <section className="recent-section"><div className="section-heading"><div><p className="eyebrow">Recently documented</p><h2>Your latest records</h2></div><button className="text-button" onClick={() => onOpen("rooms")}>View all</button></div>{recent.length ? <div className="recent-grid">{recent.map((item) => <button className="recent-card" key={item.id} onClick={() => onItem(item.id)}>{item.photoUris?.[0] ? <img src={item.photoUris[0]} alt="" /> : <div className="recent-placeholder"><Box size={28} /></div>}<strong>{item.name}</strong><small>{rooms.find((room) => room.id === item.roomId)?.name ?? item.category}</small></button>)}</div> : <div className="recent-empty"><Camera size={22} /><span><strong>Your first records will appear here</strong><small>{photographed.length ? "Keep documenting your home." : "Photograph a room to get started."}</small></span></div>}</section>
    <section className="explore-section"><div className="section-heading"><div><p className="eyebrow">Explore your home</p><h2>Everything in its place</h2></div></div><div className="home-tiles"><HomeTile title="Rooms" detail={`${rooms.length} spaces documented`} image="room.png" progress={Math.min(100, rooms.length * 20)} onClick={() => onOpen("rooms")} /><HomeTile title="Containers" detail={`${containers.length} containers`} image="tote.png" onClick={() => onOpen("containers")} /><HomeTile title="Protection" detail="Warranties & coverage" image="protection_badge.png" onClick={() => onOpen("warranties")} /><HomeTile title="History" detail="Maintenance timeline" image="calendar.png" onClick={() => onOpen("maintenance")} /><HomeTile title="Receipts" detail="Proof of purchase" image="receipt.png" onClick={() => onOpen("receipts")} /></div></section>
  </div>;
}

function Snapshot({ icon: Icon, value, label, note }: { icon: LucideIcon; value: number | string; label: string; note: string }) { return <div className="snapshot-stat"><span><Icon size={17} /></span><strong>{value}</strong><b>{label}</b><small>{note}</small></div>; }

function HomeTile({ title, detail, image, progress, onClick }: { title: string; detail: string; image: string; progress?: number; onClick: () => void }) { const assetClass = `asset-${image.replace(/\..+$/, "").replace(/_/g, "-")}`; return <button className={`home-tile image-tile ${assetClass}`} onClick={onClick}><img src={`/images/${image}`} alt="" /><div className="tile-copy"><strong>{title}</strong><small>{detail}</small>{progress !== undefined ? <span className="tile-progress"><b style={{ width: `${progress}%` }} /></span> : null}</div><i aria-hidden="true"><ChevronRight size={20} /></i></button>; }

function CollectionView({ kind, rooms, containers, receipts, warranties, maintenanceReminders, onBack, onRoom, onItem, onReceipt, onContainer, onAddContainer, onAddRoom, onWarranty, onAddRecord, onAddReceipt }: { kind: "rooms" | "containers" | "appliances" | "warranties" | "maintenance" | "receipts"; rooms: Room[]; containers: InventoryContainer[]; receipts: Receipt[]; warranties: Warranty[]; maintenanceReminders: MaintenanceReminder[]; onBack: () => void; onRoom: (id: string) => void; onItem: (id: string) => void; onReceipt: (receiptId: string, itemId?: string) => void; onContainer: (id: string) => void; onAddContainer: () => void; onAddRoom: () => void; onWarranty: (id: string) => void; onAddRecord: (kind: "appliance" | "warranty" | "maintenance") => void; onAddReceipt: () => void }) {
  const titles = { rooms: "Rooms", containers: "Containers", appliances: "Appliances", warranties: "Warranties", maintenance: "Maintenance", receipts: "Receipts" };
  const appliances = rooms.flatMap((room) => room.items).filter((item) => item.category === "Appliances");
  const addAction = kind === "appliances" ? () => onAddRecord("appliance") : kind === "warranties" ? () => onAddRecord("warranty") : kind === "maintenance" ? () => onAddRecord("maintenance") : kind === "receipts" ? onAddReceipt : null;
  return <PageShell title={titles[kind]} eyebrow="My home" onBack={onBack}>{kind === "containers" ? <><div className="page-actions"><button className="button primary" onClick={onAddContainer}>＋ Add container</button></div>{containers.length ? <div className="list">{containers.map((container) => <button className="list-row" key={container.id} onClick={() => onContainer(container.id)}><div><strong>{container.name}</strong><span>{rooms.find((room) => room.id === container.roomId)?.name ?? "Unknown room"} · {container.itemIds.length} items</span></div><i>›</i></button>)}</div> : <Empty title="No containers yet" copy="Add bins, boxes, cabinets, closets, or other item containers." />}</> : null}{kind === "rooms" ? <><div className="page-actions"><button className="button primary" onClick={onAddRoom}>＋ Add room</button></div><div className="list">{rooms.map((room) => <button className="list-row" key={room.id} onClick={() => onRoom(room.id)}><div><strong>{room.name}</strong><span>{room.items.length} items · {room.photos.length} uploaded photos</span></div><b>{formatCurrency(room.items.reduce((sum, item) => sum + item.estimatedReplacementValueCents, 0))}</b><i>›</i></button>)}</div></> : kind !== "containers" ? <div className="page-actions"><button className="button primary" onClick={addAction ?? undefined}>＋ Add {kind === "appliances" ? "appliance" : kind === "maintenance" ? "reminder" : kind === "warranties" ? "warranty" : kind.slice(0, -1)}</button></div> : null}{kind === "appliances" ? appliances.length ? <div className="list">{appliances.map((item) => <button className="list-row" key={item.id} onClick={() => onItem(item.id)}><div><strong>{item.name}</strong><span>{item.modelNumber ? `Model ${item.modelNumber} · ` : ""}{rooms.find((room) => room.id === item.roomId)?.name}</span></div><b>{formatCurrency(item.estimatedReplacementValueCents)}</b><i>›</i></button>)}</div> : <Empty title="No appliances yet" copy="Add large appliances with model, serial, photos, and supporting records." /> : null}{kind === "receipts" ? receipts.length ? <div className="list">{receipts.map((receipt) => { const item = rooms.flatMap((room) => room.items).find((entry) => receipt.itemIds.includes(entry.id)); return <button className="list-row receipt-row" key={receipt.id} onClick={() => onReceipt(receipt.id, item?.id)}>{receipt.imageUri ? <img src={receipt.imageUri} alt="" /> : <span className="receipt-placeholder">▤</span>}<div><strong>{receipt.merchant}</strong><span>{receipt.itemIds.length} attached items · {receipt.purchaseDate ?? "No date"}</span></div><b>{formatCurrency(receipt.totalCents)}</b><i>›</i></button>; })}</div> : <Empty title="No receipts yet" copy="Create a receipt and attach items and photos." /> : null}{kind === "warranties" ? warranties.length ? <div className="list">{warranties.map((warranty) => <button className="list-row" key={warranty.id} onClick={() => onWarranty(warranty.id)}><div><strong>{warranty.provider}</strong><span>{warranty.durationMonths} months · {warranty.itemIds.length} attached items</span></div><i>›</i></button>)}</div> : <Empty title="No warranties yet" copy="Add warranty terms and claim documentation." /> : null}{kind === "maintenance" ? maintenanceReminders.length ? <div className="list">{maintenanceReminders.map((reminder) => <div className="list-row" key={reminder.id}><div><strong>{reminder.title}</strong><span>{reminder.frequency.replace("_", " ")} · starts {reminder.startDate || "when scheduled"}</span></div></div>)}</div> : <Empty title="No maintenance reminders yet" copy="Schedule recurring maintenance for an appliance or item." /> : null}</PageShell>;
}

function PageShell({ title, eyebrow, onBack, children }: { title: string; eyebrow: string; onBack: () => void; children: React.ReactNode }) { return <section className="app-page"><button className="back-button icon-label" onClick={onBack}><ArrowLeft size={17} /> Back</button><p className="eyebrow">{eyebrow}</p><h1 className="page-title">{title}</h1>{children}</section>; }

function AddRoom({ onBack, onSave }: { onBack: () => void; onSave: (name: string) => void }) { const options = ["Living room", "Kitchen", "Bedroom", "Bathroom", "Dining room", "Garage", "Office", "Basement"]; const [name, setName] = useState(""); return <PageShell title="Which room are you documenting?" eyebrow="Build your inventory" onBack={onBack}><p className="page-copy">Choose a common room or enter a custom name.</p><div className="choice-list">{options.map((option) => <button key={option} className={`choice ${name === option ? "selected" : ""}`} onClick={() => setName(option)}>{option}</button>)}</div><FormField label="Custom room name"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="For example, music room" /></FormField><button className="button primary wide" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Add room</button></PageShell>; }

function RoomView({ room, containers, onBack, onItem, onAddItem, onContainer, onAddContainer, onUpload, onPhoto, onEditName, onDelete }: { room: Room; containers: InventoryContainer[]; onBack: () => void; onItem: (id: string) => void; onAddItem: () => void; onContainer: (id: string) => void; onAddContainer: () => void; onUpload: (files: FileList | null) => void; onPhoto: (id: string) => void; onEditName: () => void; onDelete: () => void }) { const input = useRef<HTMLInputElement>(null); return <PageShell title={room.name} eyebrow="My home" onBack={onBack}><div className="page-actions"><button className="button primary" onClick={() => input.current?.click()}>Upload room photos</button><input ref={input} hidden multiple type="file" accept="image/*" onChange={(event) => onUpload(event.target.files)} /><button className="button ghost" onClick={onAddItem}>＋ Add item</button><button className="button ghost" onClick={onEditName}>Edit room name</button><button className="button danger" onClick={onDelete}>Delete room</button></div><div className="mini-summary"><div><span>Items</span><strong>{room.items.length}</strong></div><div><span>Replacement value</span><strong>{formatCurrency(room.items.reduce((sum, item) => sum + item.estimatedReplacementValueCents, 0))}</strong></div><div><span>Photos</span><strong>{room.photoCount}</strong></div></div><SectionTitle title="Room photos" action="Upload photos" onAction={() => input.current?.click()} />{room.photos.length ? <div className="photo-grid">{room.photos.map((photo) => <button key={photo.id} onClick={() => onPhoto(photo.id)}><img src={photo.uri} alt={`Room evidence captured ${photo.capturedAt}`} /></button>)}</div> : <Empty title="No uploaded photos" copy="Upload room photos from this computer to make them viewable here." />}<SectionTitle title="Containers" action="＋ Add container" onAction={onAddContainer} />{containers.length ? <div className="list">{containers.map((container) => <button className="list-row" key={container.id} onClick={() => onContainer(container.id)}><div><strong>{container.name}</strong><span>{container.itemIds.length} {container.itemIds.length === 1 ? "item" : "items"}{container.description ? ` · ${container.description}` : ""}</span></div><i>›</i></button>)}</div> : <Empty title="No containers yet" copy="Containers assigned to this room will appear here." />}<SectionTitle title="Documented items" action="＋ Add item" onAction={onAddItem} />{room.items.length ? <div className="list">{room.items.map((item) => <button className="list-row" key={item.id} onClick={() => onItem(item.id)}>{item.photoUris?.[0] ? <img className="item-row-photo" src={item.photoUris[0]} alt="" /> : null}<div><strong>{item.name}</strong><span>{item.category}</span></div><b>{formatCurrency(item.estimatedReplacementValueCents)}</b><i>›</i></button>)}</div> : <Empty title="No items yet" copy="Add an item manually to begin this room’s inventory." action="Add your first item" onAction={onAddItem} />}</PageShell>; }

function ContainerView({ container, room, items, onBack, onItem, onEdit, onCreateLabel }: { container: InventoryContainer; room?: Room; items: InventoryItem[]; onBack: () => void; onItem: (id: string) => void; onEdit: () => void; onCreateLabel: () => Promise<void> }) {
  const labelId = container.id.slice(0, 8).toUpperCase();
  const [showLabel, setShowLabel] = useState(false);
  const openLabel = async () => { if (!container.label) await onCreateLabel(); setShowLabel(true); };
  return <PageShell title={container.name} eyebrow={room?.name ?? "Container"} onBack={onBack}>
    <button className="container-label-trigger" onClick={() => void openLabel()} aria-label="View printable container label"><QrCode size={19} /><span>Label</span></button>
    <div className="page-actions"><button className="button primary icon-label" onClick={onEdit}><Pencil size={16} /> Edit container</button></div>
    <div className="container-overview"><div className="container-overview-meta"><Detail label="Room" value={room?.name ?? "Unknown room"} /><Detail label="Owner" value={container.ownerName || "Household"} /><Detail label="Items" value={`${items.length}`} /></div><div className="container-overview-description"><span>Description</span><p>{container.description || "No description added."}</p></div></div>
    {showLabel ? <div className="label-modal" role="dialog" aria-modal="true" aria-label="Container label"><button className="label-modal-close" onClick={() => setShowLabel(false)} aria-label="Close label"><X size={22} /></button>{container.label ? <div className="container-label-card">
      <div className="label-print">
        <header className="print-label-header"><div className="print-brand-mark">S</div><div><strong>STUFFHUB</strong><span>HOME INVENTORY</span></div><p>CONTAINER LABEL</p></header>
        <div className="print-label-rule" />
        <main className="print-label-main">
          <section className="print-qr-panel"><img src={container.label.qrCodeDataUri} alt={`QR code for ${container.name}`} /><strong>SCAN TO OPEN</strong><span>Point the StuffHub scanner at this code</span></section>
          <section className="print-label-details"><p className="print-label-kicker">CONTAINER</p><h1>{container.name}</h1><p className="print-label-description">{container.description || "Organized household storage"}</p><dl><div><dt>LOCATION</dt><dd>{room?.name ?? "Unassigned"}</dd></div>{container.ownerName ? <div><dt>OWNER</dt><dd>{container.ownerName}</dd></div> : null}<div><dt>LABEL ID</dt><dd>{labelId}</dd></div></dl></section>
        </main>
        <footer className="print-label-footer"><span>PRIVATE HOME INVENTORY</span><p>Keep this label attached to its assigned container.</p><strong>{labelId}</strong></footer>
      </div>
      <div className="label-actions"><button className="button primary icon-label" onClick={() => void printContainerLabel({ name: container.name, description: container.description || "Organized household storage", location: room?.name ?? "Unassigned", owner: container.ownerName ?? null, labelId, qrCodeDataUri: container.label!.qrCodeDataUri })}><Printer size={16} /> Print label</button></div>
    </div> : <div className="empty"><strong>Preparing label…</strong></div>}</div> : null}
    <SectionTitle title="Contained items" />{items.length ? <div className="list">{items.map((item) => <button className="list-row" key={item.id} onClick={() => onItem(item.id)}><div><strong>{item.name}</strong><span>{item.category}</span></div><b>{formatCurrency(item.estimatedReplacementValueCents)}</b><i>›</i></button>)}</div> : <Empty title="No contained items" copy="Edit this container to attach items." />}
  </PageShell>;
}

function ItemView({ item, room, receipts, onBack, onEdit, onAddPhoto, onAddReceipt, onReceipt }: { item: InventoryItem; room?: Room; receipts: Receipt[]; onBack: () => void; onEdit: () => void; onAddPhoto: (file: File) => void; onAddReceipt: () => void; onReceipt: (id: string) => void }) { const photoInput = useRef<HTMLInputElement>(null); return <PageShell title={item.name} eyebrow={room?.name ?? "Item"} onBack={onBack}><div className="page-actions"><button className="button ghost" onClick={onEdit}>Edit item</button></div><div className="value-panel"><span>Estimated replacement value</span><strong>{formatCurrency(item.estimatedReplacementValueCents)}</strong><small>User-provided estimate</small></div>{item.photoUris?.length ? <><h2 className="subheading">Photos</h2><div className="item-photo-gallery">{item.photoUris.map((uri, index) => <img key={uri} src={uri} alt={`${item.name}, view ${index + 1}`} />)}</div></> : <><button className="add-photo-empty" onClick={() => photoInput.current?.click()}>＋ Upload a photo to this item</button><input ref={photoInput} hidden type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) onAddPhoto(file); event.target.value = ""; }} /></>}<h2 className="subheading">Details</h2><div className="detail-panel">{item.ownerName ? <Detail label="Owner" value={item.ownerName} /> : null}<Detail label="Category" value={item.category} /><Detail label="Purchase year" value={item.purchaseYear?.toString() ?? "Not recorded"} /><Detail label="Serial number" value={item.serialNumber ?? "Not recorded"} /><p>{item.description || "No additional description."}</p></div><SectionTitle title="Receipts" action="＋ Add receipt" onAction={onAddReceipt} />{receipts.length ? <div className="list">{receipts.map((receipt) => <button className="list-row receipt-row" key={receipt.id} onClick={() => onReceipt(receipt.id)}>{receipt.imageUri ? <img src={receipt.imageUri} alt="Receipt" /> : <span className="receipt-placeholder">▤</span>}<div><strong>{receipt.merchant}</strong><span>{receipt.purchaseDate || "Date not recorded"}</span></div><b>{formatCurrency(receipt.totalCents)}</b><i>›</i></button>)}</div> : <Empty title="Add proof of purchase" copy="Attach a receipt image and purchase details." action="Add receipt" onAction={onAddReceipt} />}</PageShell>; }

function ItemForm({ rooms, room, item, onBack, onSave, onDelete }: { rooms: Room[]; room?: Room; item?: InventoryItem; onBack: () => void; onSave: (input: ItemInput, roomId: string) => void; onDelete?: () => void }) { const [name, setName] = useState(item?.name ?? ""); const [category, setCategory] = useState(item?.category ?? "Other"); const [value, setValue] = useState(item ? (item.estimatedReplacementValueCents / 100).toFixed(2) : ""); const [year, setYear] = useState(item?.purchaseYear?.toString() ?? ""); const [serial, setSerial] = useState(item?.serialNumber ?? ""); const [description, setDescription] = useState(item?.description ?? ""); const [selectedRoomId, setSelectedRoomId] = useState(item?.roomId ?? room?.id ?? ""); const categories = ["Electronics", "Furniture", "Appliances", "Jewelry", "Collectibles", "Tools", "Clothing", "Other"]; return <PageShell title={item ? "Update this item." : "Document an item."} eyebrow={room?.name ?? "Room"} onBack={onBack}><div className="form-grid"><FormField label="Item name *" wide><input value={name} onChange={(event) => setName(event.target.value)} /></FormField><FormField label="Category" wide><div className="choice-list compact">{categories.map((option) => <button key={option} className={`choice ${category === option ? "selected" : ""}`} onClick={() => setCategory(option)}>{option}</button>)}</div></FormField><FormField label="Replacement value"><CurrencyField value={value} onChange={setValue} /></FormField><FormField label="Purchase year"><input inputMode="numeric" maxLength={4} value={year} onChange={(event) => setYear(event.target.value.replace(/\D/g, ""))} /></FormField><FormField label="Serial number" wide><input value={serial} onChange={(event) => setSerial(event.target.value)} /></FormField><FormField label="Description" wide><textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></FormField>{item ? <FormField label="Room" wide><div className="choice-list compact">{rooms.map((option) => <button key={option.id} className={`choice ${selectedRoomId === option.id ? "selected" : ""}`} onClick={() => setSelectedRoomId(option.id)}>{option.name}</button>)}</div></FormField> : null}</div><div className="form-actions"><button className="button primary" disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), category, description, estimatedReplacementValueCents: Math.round(Number(value || 0) * 100), purchaseYear: Number(year) >= 1900 ? Number(year) : null, serialNumber: serial.trim() || null }, selectedRoomId)}>Save {item ? "changes" : "item"}</button>{onDelete ? <button className="button danger" onClick={onDelete}>Delete item</button> : null}</div></PageShell>; }

function ReceiptForm({ item, items, receipt, onBack, onSave, onDelete }: { item?: InventoryItem; items: InventoryItem[]; receipt?: Receipt; onBack: () => void; onSave: (input: ReceiptInput, files: File[]) => Promise<void>; onDelete?: () => void }) {
  const [merchant, setMerchant] = useState(receipt?.merchant ?? "");
  const [date, setDate] = useState(receipt?.purchaseDate ?? "");
  const [total, setTotal] = useState(receipt ? (receipt.totalCents / 100).toFixed(2) : "");
  const [imageUri, setImageUri] = useState(receipt?.imageUri ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [itemIds, setItemIds] = useState<string[]>(receipt?.itemIds ?? (item ? [item.id] : []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const chooseImage = (file?: File) => { if (!file) return; if (imageUri?.startsWith("blob:")) URL.revokeObjectURL(imageUri); setImageFile(file); setImageUri(URL.createObjectURL(file)); };
  const save = async () => { setSaving(true); setError(""); try { await onSave({ merchant: merchant.trim(), purchaseDate: date || null, totalCents: Math.round(Number(total || 0) * 100), imageUri, photoUris: imageUri ? [imageUri] : [], itemIds }, imageFile ? [imageFile] : []); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save receipt"); setSaving(false); } };
  return <PageShell title={receipt ? "Update this receipt." : "Attach a receipt."} eyebrow="Proof of purchase" onBack={onBack}>
    <p className="page-copy">{item ? <>Linked to <strong>{item.name}</strong>.</> : "Save a receipt now and attach it to one or more items."}</p>
    {imageUri ? <div className="receipt-upload receipt-has-image"><button type="button" className="receipt-preview-button" onClick={() => window.open(imageUri, "_blank", "noopener,noreferrer")}><img src={imageUri} alt="Receipt preview" /><span>Open full-size receipt</span></button></div> : <label className="receipt-upload"><span>▤</span><strong>Upload a receipt image</strong><small>Choose a clear full-resolution photo or scan.</small><input hidden type="file" accept="image/*" onChange={(event) => chooseImage(event.target.files?.[0])} /></label>}
    {imageUri ? <div className="receipt-image-actions"><label className="button ghost">Replace image<input hidden type="file" accept="image/*" onChange={(event) => chooseImage(event.target.files?.[0])} /></label><button type="button" className="text-button remove-image" onClick={() => { if (imageUri.startsWith("blob:")) URL.revokeObjectURL(imageUri); setImageUri(null); setImageFile(null); }}>Remove image</button></div> : null}
    <div className="form-grid"><FormField label="Merchant *" wide><input value={merchant} onChange={(event) => setMerchant(event.target.value)} /></FormField><FormField label="Purchase date"><DateField value={date} onChange={setDate} /></FormField><FormField label="Receipt total"><CurrencyField value={total} onChange={setTotal} /></FormField><FormField label="Attached items" wide><div className="choice-list compact">{items.map((option) => { const selected = itemIds.includes(option.id); return <button type="button" key={option.id} className={`choice ${selected ? "selected" : ""}`} onClick={() => setItemIds((current) => selected ? current.filter((id) => id !== option.id) : [...current, option.id])}>{option.name}</button>; })}</div></FormField></div>
    <p className="form-note">Receipt totals remain separate from the item’s estimated replacement value. Images are stored at full quality for legible fine print.</p>{error ? <p className="form-error">{error}</p> : null}
    <div className="form-actions"><button className="button primary" disabled={!merchant.trim() || saving} onClick={() => void save()}>{saving ? "Saving receipt and image…" : `Save ${receipt ? "changes" : "receipt"}`}</button>{onDelete ? <button className="button danger" disabled={saving} onClick={onDelete}>Delete receipt</button> : null}</div>
  </PageShell>;
}

function PhotoView({ photo, onBack }: { photo: RoomPhoto; onBack: () => void }) { return <div className="photo-view"><button onClick={onBack} aria-label="Close photo"><X size={24} /></button><img src={photo.uri} alt="Full-size room evidence" /></div>; }
function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) { return <div className="section-title"><h2>{title}</h2>{action && onAction ? <button className="text-button" onClick={onAction}>{action}</button> : null}</div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="detail"><span>{label}</span><strong>{value}</strong></div>; }
function FormField({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`form-field ${wide ? "wide" : ""}`}><span>{label}</span>{children}</label>; }
function Empty({ title, copy, action, onAction }: { title: string; copy: string; action?: string; onAction?: () => void }) { return <div className="empty"><strong>{title}</strong><p>{copy}</p>{action && onAction ? <button className="button primary" onClick={onAction}>{action}</button> : null}</div>; }
