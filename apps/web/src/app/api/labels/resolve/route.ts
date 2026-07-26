import type { NextRequest } from "next/server";
import { ApiError, errorResponse, requireUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const payload = request.nextUrl.searchParams.get("payload")?.trim();
    if (!payload) throw new ApiError(400, "Label payload is required");
    const { supabase } = await requireUser(request);
    const { data, error } = await supabase.from("containers").select("id").eq("label_payload", payload).maybeSingle();
    if (error) throw new ApiError(400, error.message);
    if (data) return Response.json({ containerId: data.id });

    // Labels created by the prototype encoded the container UUID but were not
    // persisted. Register one of those labels on its first successful scan.
    const legacyId = payload.match(/^stuffhub:\/\/container\/([0-9a-f-]{36})$/i)?.[1];
    if (!legacyId) throw new ApiError(404, "Label not found");
    const legacy = await supabase.from("containers").select("id,label_created_at").eq("id", legacyId).maybeSingle();
    if (legacy.error || !legacy.data || legacy.data.label_created_at) throw new ApiError(404, "Label not found");
    const createdAt = new Date().toISOString();
    const registered = await supabase.from("containers").update({ label_payload: payload, label_created_at: createdAt }).eq("id", legacyId).select("id").single();
    if (registered.error) throw new ApiError(400, registered.error.message);
    return Response.json({ containerId: registered.data.id });
  } catch (error) { return errorResponse(error); }
}
