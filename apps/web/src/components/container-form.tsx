"use client";

import type { InventoryContainer, InventoryItem, Room } from "@stuffhub/domain";
import { ArrowLeft, Camera, Check } from "lucide-react";
import { useMemo, useState } from "react";

type Props = { rooms: Room[]; items: InventoryItem[]; container?: InventoryContainer; defaultRoomId?: string; ownerNames: string[]; onBack: () => void; onAddRoom: (name: string) => string; onQuickAddItem: (roomId: string, name: string, photoUris: string[]) => string; onSave: (input: Omit<InventoryContainer, "id">) => void; onDelete?: () => void };

export function ContainerForm({ rooms, items, container, defaultRoomId, ownerNames, onBack, onAddRoom, onQuickAddItem, onSave, onDelete }: Props) {
  const [name, setName] = useState(container?.name ?? "");
  const [description, setDescription] = useState(container?.description ?? "");
  const [ownerName, setOwnerName] = useState(container?.ownerName ?? "");
  const [roomId, setRoomId] = useState(container?.roomId ?? defaultRoomId ?? rooms[0]?.id ?? "");
  const [itemIds, setItemIds] = useState<string[]>(container?.itemIds ?? []);
  const [newRoom, setNewRoom] = useState(""); const [search, setSearch] = useState("");
  const [showNewRoom, setShowNewRoom] = useState(false); const [showQuickItem, setShowQuickItem] = useState(false);
  const [quickItemName, setQuickItemName] = useState(""); const [quickItemPhotos, setQuickItemPhotos] = useState<string[]>([]);
  const filtered = useMemo(() => items.filter((item) => !search.trim() || `${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase())), [items, search]);
  const addRoom = () => { if (!newRoom.trim()) return; setRoomId(onAddRoom(newRoom.trim())); setNewRoom(""); setShowNewRoom(false); };
  const addQuickItem = () => { if (!quickItemName.trim() || !roomId) return; const itemId = onQuickAddItem(roomId, quickItemName.trim(), quickItemPhotos); setItemIds((current) => [...current, itemId]); setQuickItemName(""); setQuickItemPhotos([]); setShowQuickItem(false); };
  const toggle = (itemId: string) => setItemIds((current) => current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]);

  return <section className="app-page">
    <button className="back-button icon-label" onClick={onBack}><ArrowLeft size={17} /> Back</button><p className="eyebrow">Organize items</p><h1 className="page-title">{container ? "Update this container." : "Create a container."}</h1>
    <div className="form-grid">
      <Field label="Container name *" wide><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Storage bin, hall closet, tool chest…" /></Field>
      <Field label="Owner" wide><input list="container-owner-options" value={ownerName ?? ""} onChange={(event) => setOwnerName(event.target.value)} placeholder="Optional — type or choose a person" /><datalist id="container-owner-options">{ownerNames.map((owner) => <option key={owner} value={owner} />)}</datalist></Field>
      <Field label="Room *" wide><div className="choice-list compact">{rooms.map((room) => <button type="button" key={room.id} className={`choice ${roomId === room.id ? "selected" : ""}`} onClick={() => setRoomId(room.id)}>{room.name}</button>)}<button type="button" className="choice" onClick={() => setShowNewRoom(true)}>Add room +</button></div></Field>
      {showNewRoom ? <Field label="New room" wide><div className="inline-room"><input value={newRoom} onChange={(event) => setNewRoom(event.target.value)} placeholder="Room name" /><button type="button" className="button ghost" disabled={!newRoom.trim()} onClick={addRoom}>Add room</button></div></Field> : null}
      <Field label="Description" wide><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
    </div>
    <div className="container-items-heading"><div><h2>Items</h2><p>{itemIds.length} selected</p></div><button type="button" className="button ghost" onClick={() => setShowQuickItem((open) => !open)}>{showQuickItem ? "Cancel" : "Add item +"}</button></div>
    {showQuickItem ? <div className="quick-item-form"><label className="quick-photo">{quickItemPhotos[0] ? <img src={quickItemPhotos[0]} alt="Item preview" /> : <Camera size={21} />}<input hidden type="file" accept="image/*" onChange={(event) => setQuickItemPhotos(Array.from(event.target.files ?? []).map((file) => URL.createObjectURL(file)))} /></label><input value={quickItemName} onChange={(event) => setQuickItemName(event.target.value)} placeholder="Item name" /><button type="button" className="button primary quick-submit" disabled={!quickItemName.trim()} onClick={addQuickItem}>Add</button></div> : null}
    <input className="container-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search items" />
    <div className="container-item-list">{filtered.map((item) => { const selected = itemIds.includes(item.id); return <button type="button" className={`container-item ${selected ? "selected" : ""}`} key={item.id} onClick={() => toggle(item.id)}><span>{selected ? <Check size={17} /> : null}</span><div><strong>{item.name}</strong><small>{item.category} · {rooms.find((room) => room.id === item.roomId)?.name}</small></div></button>; })}</div>
    <div className="form-actions"><button className="button primary" disabled={!name.trim() || !roomId} onClick={() => onSave({ name: name.trim(), description, ownerName: ownerName?.trim() || null, roomId, itemIds })}>Save container</button>{container && onDelete ? <button className="button danger" onClick={onDelete}>Delete container</button> : null}</div>
  </section>;
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`form-field ${wide ? "wide" : ""}`}><span>{label}</span>{children}</label>; }
