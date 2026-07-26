import { randomUUID } from "node:crypto";
import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, requireUser } from "@/lib/api-auth";
import { reachableMediaUrl } from "@/lib/media-url";
import { processReceiptJob, receiptJobRecord } from "@/lib/receipt-processing";

const targetSchema = z.object({ homeId: z.string().uuid(), entityType: z.enum(["room", "item", "receipt"]), entityId: z.string().uuid(), replaceIndex: z.coerce.number().int().nonnegative().optional() });
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]);

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireUser(request);
    const mediaId = request.nextUrl.searchParams.get("id");
    if (!mediaId) throw new ApiError(400, "A media ID is required");
    const { data: asset, error: assetError } = await supabase.from("media_assets")
      .select("bucket_id,object_path,mime_type").eq("id", mediaId).maybeSingle();
    if (assetError) throw new ApiError(400, assetError.message);
    if (!asset) throw new ApiError(404, "Media not found");
    const { data: file, error: downloadError } = await supabase.storage.from(asset.bucket_id).download(asset.object_path);
    if (downloadError) throw new ApiError(404, downloadError.message);
    return new Response(file, {
      headers: {
        "content-type": asset.mime_type,
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase } = await requireUser(request);
    const form = await request.formData();
    const replaceIndex = form.get("replaceIndex");
    const target = targetSchema.safeParse({ homeId: form.get("homeId"), entityType: form.get("entityType"), entityId: form.get("entityId"), ...(replaceIndex !== null ? { replaceIndex } : {}) });
    const file = form.get("file");
    if (!target.success || !(file instanceof File)) throw new ApiError(400, "A valid media target and file are required");
    if (!allowedTypes.has(file.type) || file.size > 50 * 1024 * 1024) throw new ApiError(400, "Unsupported file type or file is larger than 50 MiB");
    const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "bin";
    const mediaId = randomUUID();
    const bucket = target.data.entityType === "receipt" ? "receipts" : "inventory";
    const folder = target.data.entityType === "receipt" ? `${target.data.homeId}/${target.data.entityId}/${target.data.replaceIndex === undefined ? "original" : "cropped"}` : `${target.data.homeId}/${target.data.entityType}s/${target.data.entityId}`;
    const objectPath = `${folder}/${mediaId}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new ApiError(400, uploadError.message);
    const { error: mediaError } = await supabase.from("media_assets").insert({ id: mediaId, home_id: target.data.homeId, bucket_id: bucket,
      object_path: objectPath, kind: target.data.replaceIndex === undefined ? "original" : "cropped", mime_type: file.type, byte_size: file.size, original_filename: file.name });
    if (mediaError) { await supabase.storage.from(bucket).remove([objectPath]); throw new ApiError(400, mediaError.message); }
    if (target.data.entityType === "room") {
      if (target.data.replaceIndex !== undefined) {
        const { data: links, error: linksError } = await supabase.from("room_media").select("media_id,sort_order").eq("home_id", target.data.homeId).eq("room_id", target.data.entityId).order("sort_order");
        if (linksError || !links?.[target.data.replaceIndex]) throw new ApiError(400, linksError?.message ?? "Photo not found");
        const old = links[target.data.replaceIndex]!;
        const { error } = await supabase.from("room_media").update({ media_id: mediaId }).eq("home_id", target.data.homeId).eq("room_id", target.data.entityId).eq("media_id", old.media_id);
        if (error) throw new ApiError(400, error.message);
      } else {
      const { count } = await supabase.from("room_media").select("media_id", { count: "exact", head: true }).eq("home_id", target.data.homeId).eq("room_id", target.data.entityId);
      const { error } = await supabase.from("room_media").insert({ home_id: target.data.homeId, room_id: target.data.entityId, media_id: mediaId, sort_order: count ?? 0 });
      if (error) throw new ApiError(400, error.message);
      await supabase.from("rooms").update({ scan_status: "ready" }).eq("home_id", target.data.homeId).eq("id", target.data.entityId);
      }
    } else if (target.data.entityType === "item") {
      if (target.data.replaceIndex !== undefined) {
        const { data: links, error: linksError } = await supabase.from("item_media").select("media_id,sort_order").eq("home_id", target.data.homeId).eq("item_id", target.data.entityId).order("sort_order");
        if (linksError || !links?.[target.data.replaceIndex]) throw new ApiError(400, linksError?.message ?? "Photo not found");
        const old = links[target.data.replaceIndex]!;
        const { error } = await supabase.from("item_media").update({ media_id: mediaId }).eq("home_id", target.data.homeId).eq("item_id", target.data.entityId).eq("media_id", old.media_id);
        if (error) throw new ApiError(400, error.message);
      } else {
      const { count } = await supabase.from("item_media").select("media_id", { count: "exact", head: true }).eq("home_id", target.data.homeId).eq("item_id", target.data.entityId);
      const { error } = await supabase.from("item_media").insert({ home_id: target.data.homeId, item_id: target.data.entityId, media_id: mediaId, sort_order: count ?? 0 });
      if (error) throw new ApiError(400, error.message);
      }
    } else {
      if (target.data.replaceIndex !== undefined) {
        const { data: pages, error: pagesError } = await supabase.from("receipt_pages").select("id").eq("home_id", target.data.homeId).eq("receipt_id", target.data.entityId).order("page_number");
        if (pagesError || !pages?.[target.data.replaceIndex]) throw new ApiError(400, pagesError?.message ?? "Receipt page not found");
        const { error } = await supabase.from("receipt_pages").update({ processed_media_id: mediaId }).eq("home_id", target.data.homeId).eq("id", pages[target.data.replaceIndex]!.id);
        if (error) throw new ApiError(400, error.message);
      } else {
      const { count } = await supabase.from("receipt_pages").select("id", { count: "exact", head: true }).eq("home_id", target.data.homeId).eq("receipt_id", target.data.entityId);
      const pageId = randomUUID();
      const { error } = await supabase.from("receipt_pages").insert({ id: pageId, home_id: target.data.homeId, receipt_id: target.data.entityId, original_media_id: mediaId, page_number: (count ?? 0) + 1 });
      if (error) throw new ApiError(400, error.message);
      const { data: job, error: jobError } = await supabase.from("processing_jobs")
        .insert(receiptJobRecord(target.data.homeId, target.data.entityId, pageId, mediaId)).select("id").single();
      if (jobError) throw new ApiError(400, jobError.message);
      after(() => processReceiptJob(supabase, job.id).catch((processingError) => console.error("Receipt processing failed", processingError)));
      }
    }
    const { data } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 3600);
    const uri = request.headers.has("authorization")
      ? reachableMediaUrl(data?.signedUrl, request.nextUrl)
      : `/api/media?id=${encodeURIComponent(mediaId)}`;
    return Response.json({ media: { id: mediaId, uri } }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
