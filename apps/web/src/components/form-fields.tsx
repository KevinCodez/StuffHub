"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

function maskDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDate(value: string) {
  const [month, day, year] = value.split("/").map(Number);
  const date = month && day && year && year >= 1900 ? new Date(year, month - 1, day) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatDate(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
}

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function DateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(() => parseDate(value));
  const [visible, setVisible] = useState(() => parseDate(value));
  const today = new Date();
  const leading = new Date(visible.getFullYear(), visible.getMonth(), 1).getDay();
  const dayCount = new Date(visible.getFullYear(), visible.getMonth() + 1, 0).getDate();
  const days: Array<number | null> = [...Array<null>(leading).fill(null), ...Array.from({ length: dayCount }, (_, index) => index + 1)];
  return <div className="field-control date-control"><input inputMode="numeric" value={value} onChange={(event) => onChange(maskDate(event.target.value))} placeholder="MM/DD/YYYY" maxLength={10} /><button type="button" className="field-icon" aria-label="Open calendar" onClick={() => { const date = parseDate(value); setSelected(date); setVisible(date); setOpen(true); }}><CalendarDays size={20} /></button>{open ? <div className="calendar-popover"><div className="calendar-top"><button type="button" aria-label="Previous month" onClick={() => setVisible(new Date(visible.getFullYear(), visible.getMonth() - 1, 1))}><ChevronLeft size={19} /></button><strong>{months[visible.getMonth()]} {visible.getFullYear()}</strong><button type="button" aria-label="Next month" disabled={visible.getFullYear() === today.getFullYear() && visible.getMonth() >= today.getMonth()} onClick={() => setVisible(new Date(visible.getFullYear(), visible.getMonth() + 1, 1))}><ChevronRight size={19} /></button></div><div className="weekdays">{"SMTWTFS".split("").map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="calendar-days">{days.map((day, index) => day ? (() => { const date = new Date(visible.getFullYear(), visible.getMonth(), day); const disabled = date > today; const active = date.toDateString() === selected.toDateString(); return <button type="button" key={day} disabled={disabled} className={active ? "selected" : ""} onClick={() => setSelected(date)}>{day}</button>; })() : <span key={`blank-${index}`} />)}</div><div className="calendar-actions"><button type="button" className="button ghost" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="button primary" onClick={() => { onChange(formatDate(selected)); setOpen(false); }}>Use date</button></div></div> : null}</div>;
}

export function CurrencyField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const normalize = () => { const number = Number(value.replace(/[^0-9.]/g, "")); if (Number.isFinite(number)) onChange(number.toFixed(2)); };
  return <div className="field-control currency-control"><span>$</span><input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value.replace(/[^0-9.]/g, ""))} onBlur={normalize} placeholder="0.00" /></div>;
}
