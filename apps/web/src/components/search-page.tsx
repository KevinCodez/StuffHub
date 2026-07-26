"use client";

import { formatCurrency, type InventoryContainer, type InventoryItem, type Receipt, type Room, type Warranty } from "@stuffhub/domain";
import { Box, FileCheck2, PackageSearch, ReceiptText, Search, X, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";

type ResultType = "items" | "containers" | "warranties" | "receipts";
type SearchResult = { id: string; type: ResultType; title: string; subtitle: string; searchable: string; valueCents?: number; imageUri: string | undefined; item?: InventoryItem };

export function SearchPage({ rooms, containers, warranties, receipts, onItem, onContainer, onWarranty, onReceipt }: { rooms: Room[]; containers: InventoryContainer[]; warranties: Warranty[]; receipts: Receipt[]; onItem: (id: string) => void; onContainer: (id: string) => void; onWarranty: (id: string) => void; onReceipt: (id: string) => void }) {
  const [query, setQuery] = useState(""); const [type, setType] = useState<ResultType | "all">("all");
  const [category, setCategory] = useState(""); const [owner, setOwner] = useState(""); const [year, setYear] = useState(""); const [minimumValue, setMinimumValue] = useState(""); const [maximumValue, setMaximumValue] = useState("");
  const items = rooms.flatMap((room) => room.items); const findItem = (id: string) => items.find((item) => item.id === id);
  const categories = Array.from(new Set(items.map((item) => item.category))).sort();
  const owners = Array.from(new Set([...items.map((item) => item.ownerName), ...containers.map((container) => container.ownerName)].filter((value): value is string => Boolean(value)))).sort();
  const typeLabels: Record<ResultType | "all", string> = { all: "All records", items: "Items", containers: "Containers", warranties: "Warranties", receipts: "Receipts" };

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase(); const min = minimumValue ? Number(minimumValue) * 100 : null; const max = maximumValue ? Number(maximumValue) * 100 : null;
    const records: SearchResult[] = [
      ...items.map((item) => { const room = rooms.find((entry) => entry.id === item.roomId); const container = containers.find((entry) => entry.itemIds.includes(item.id)); return { id: item.id, type: "items" as const, title: item.name, subtitle: `${item.category} · ${room?.name ?? "Unknown room"}${container ? ` · ${container.name}` : ""}`, item, valueCents: item.estimatedReplacementValueCents, imageUri: item.photoUris?.[0], searchable: [item.name, item.category, item.description, item.purchaseYear, item.serialNumber, item.modelNumber, item.ownerName, room?.name, container?.name, item.estimatedReplacementValueCents / 100].join(" ").toLowerCase() }; }),
      ...containers.map((container) => ({ id: container.id, type: "containers" as const, title: container.name, subtitle: `${rooms.find((room) => room.id === container.roomId)?.name ?? "Unknown room"} · ${container.itemIds.length} items`, imageUri: undefined, searchable: [container.name, container.description, container.ownerName, ...container.itemIds.map((id) => findItem(id)?.name)].join(" ").toLowerCase() })),
      ...warranties.map((warranty) => ({ id: warranty.id, type: "warranties" as const, title: warranty.provider, subtitle: `${warranty.durationMonths} months · ${warranty.policyNumber || "No policy number"}`, imageUri: warranty.documentUris[0], searchable: [warranty.provider, warranty.policyNumber, warranty.purchaseDate, warranty.durationMonths, warranty.description, warranty.claimContact, ...warranty.itemIds.map((id) => findItem(id)?.name)].join(" ").toLowerCase() })),
      ...receipts.map((receipt) => ({ id: receipt.id, type: "receipts" as const, title: receipt.merchant, subtitle: `${receipt.purchaseDate ?? "No date"} · ${formatCurrency(receipt.totalCents)}`, valueCents: receipt.totalCents, imageUri: receipt.imageUri ?? receipt.photoUris?.[0] ?? undefined, searchable: [receipt.merchant, receipt.purchaseDate, receipt.description, receipt.totalCents / 100, ...receipt.itemIds.map((id) => findItem(id)?.name)].join(" ").toLowerCase() })),
    ];
    return records.filter((result) => (type === "all" || result.type === type) && (!normalized || result.searchable.includes(normalized)) && (!category || result.item?.category === category) && (!owner || result.item?.ownerName === owner) && (!year || result.item?.purchaseYear?.toString() === year) && (min === null || (result.valueCents !== undefined && result.valueCents >= min)) && (max === null || (result.valueCents !== undefined && result.valueCents <= max)));
  }, [query, type, category, owner, year, minimumValue, maximumValue, items, rooms, containers, warranties, receipts]);

  const hasFilters = Boolean(query || type !== "all" || category || owner || year || minimumValue || maximumValue);
  const clear = () => { setQuery(""); setType("all"); setCategory(""); setOwner(""); setYear(""); setMinimumValue(""); setMaximumValue(""); };
  const open = (result: SearchResult) => result.type === "items" ? onItem(result.id) : result.type === "containers" ? onContainer(result.id) : result.type === "warranties" ? onWarranty(result.id) : onReceipt(result.id);

  return <div className="search-page">
    <section className="search-hero"><div><p className="eyebrow">Find anything</p><h1>Search your home.</h1><p>Find items and supporting records by any detail you remember.</p></div><div className="search-field"><Search size={22} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, description, serial number, merchant, policy…" />{query ? <button aria-label="Clear search" onClick={() => setQuery("")}><X size={18} /></button> : null}</div></section>
    <section className="search-filter-panel"><div className="filter-heading"><div><strong>Refine results</strong><small>Combine filters to narrow your inventory</small></div>{hasFilters ? <button onClick={clear}>Clear all</button> : null}</div>
      <div className="search-filter-group"><label>Record type</label><div className="search-chips">{(Object.keys(typeLabels) as Array<ResultType | "all">).map((entry) => <button key={entry} className={type === entry ? "selected" : ""} onClick={() => setType(entry)}>{typeLabels[entry]}</button>)}</div></div>
      <div className="search-filter-grid"><label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((entry) => <option key={entry}>{entry}</option>)}</select></label><label><span>Owner</span><select value={owner} onChange={(event) => setOwner(event.target.value)}><option value="">All owners</option>{owners.map((entry) => <option key={entry}>{entry}</option>)}</select></label><label><span>Purchase year</span><input inputMode="numeric" maxLength={4} value={year} onChange={(event) => setYear(event.target.value.replace(/\D/g, ""))} placeholder="Any year" /></label><label><span>Minimum value</span><input inputMode="decimal" value={minimumValue} onChange={(event) => setMinimumValue(event.target.value)} placeholder="$0" /></label><label><span>Maximum value</span><input inputMode="decimal" value={maximumValue} onChange={(event) => setMaximumValue(event.target.value)} placeholder="Any value" /></label></div>
    </section>
    <section className="search-results"><div className="search-results-heading"><div><p className="eyebrow">Search results</p><h2>{results.length} {results.length === 1 ? "record" : "records"}</h2></div><small>{hasFilters ? "Filtered inventory" : "Everything in your home"}</small></div>
      <div className="search-result-list">{results.map((result) => <button key={`${result.type}-${result.id}`} className="search-result" onClick={() => open(result)}>{result.imageUri ? <img className="search-result-image" src={result.imageUri} alt="" /> : <ResultIcon type={result.type} />}<span><strong>{result.title}</strong><small>{result.subtitle}</small></span>{result.valueCents !== undefined && result.type === "items" ? <b>{formatCurrency(result.valueCents)}</b> : null}<i>›</i></button>)}</div>
      {!results.length ? <div className="search-empty"><PackageSearch size={42} /><h3>No matching records</h3><p>Try a broader search or remove one of your filters.</p><button className="button ghost" onClick={clear}>Reset search</button></div> : null}
    </section>
  </div>;
}

function ResultIcon({ type }: { type: ResultType }) { const Icon: LucideIcon = type === "items" ? Box : type === "containers" ? PackageSearch : type === "warranties" ? FileCheck2 : ReceiptText; return <em><Icon size={21} /></em>; }
