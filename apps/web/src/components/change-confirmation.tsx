"use client";

import { Check } from "lucide-react";

export interface ChangeNotice { id: number; message: string }

export function ChangeConfirmation({ notice }: { notice: ChangeNotice | null }) {
  if (!notice) return null;
  return <div key={notice.id} className="change-confirmation" role="status" aria-live="polite"><span><Check size={16} strokeWidth={2.8} /></span><strong>{notice.message}</strong></div>;
}
