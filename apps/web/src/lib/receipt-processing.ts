import { createHash, randomUUID } from "node:crypto";
import type { Database } from "@stuffhub/domain/database";
import sharp from "sharp";
import { createWorker, PSM } from "tesseract.js";
import type { createSupabaseServerClient } from "./supabase-server";

type Client = ReturnType<typeof createSupabaseServerClient>;
type ReceiptJobPayload = { pageId: string; originalMediaId: string };

function receiptJobPayload(value: unknown): ReceiptJobPayload {
  if (!value || typeof value !== "object") throw new Error("Receipt processing job has no payload");
  const payload = value as Record<string, unknown>;
  if (typeof payload.pageId !== "string" || typeof payload.originalMediaId !== "string") throw new Error("Receipt processing job payload is invalid");
  return { pageId: payload.pageId, originalMediaId: payload.originalMediaId };
}

async function enhanceReceipt(input: Buffer) {
  const source = sharp(input, { failOn: "warning" }).rotate();
  const metadata = await source.metadata();
  const enhanced = await source.clone()
    .resize({ width: 2500, height: 2500, fit: "inside", withoutEnlargement: true })
    .normalize({ lower: 1, upper: 99 })
    .sharpen({ sigma: 0.7, m1: 0.5, m2: 1.5 })
    .webp({ quality: 92, smartSubsample: false, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  const ocrImage = await sharp(enhanced.data).grayscale().normalize({ lower: 1, upper: 99 })
    .sharpen({ sigma: 0.9, m1: 0.7, m2: 2 }).png({ compressionLevel: 9 }).toBuffer();
  return { metadata, enhanced, ocrImage };
}

async function recognizeReceipt(input: Buffer) {
  const worker = await createWorker("eng", undefined, {
    ...(process.env.TESSERACT_LANG_PATH ? { langPath: process.env.TESSERACT_LANG_PATH } : {}),
    ...(process.env.NODE_ENV === "development" ? { logger: (event) => console.info("receipt OCR", event.status, event.progress) } : {}),
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    const { data } = await worker.recognize(input, {}, { text: true });
    return { text: data.text.trim(), confidence: Math.max(0, Math.min(1, data.confidence / 100)), version: data.version };
  } finally {
    await worker.terminate();
  }
}

export async function processReceiptJob(client: Client, jobId: string) {
  const { data: pendingJob, error: readError } = await client.from("processing_jobs")
    .select("id,home_id,entity_id,payload,attempts").eq("id", jobId).eq("status", "pending").maybeSingle();
  if (readError) throw readError;
  if (!pendingJob) return;
  const { data: job, error: claimError } = await client.from("processing_jobs")
    .update({ status: "processing", started_at: new Date().toISOString(), attempts: pendingJob.attempts + 1, error_message: null })
    .eq("id", jobId).eq("status", "pending").select("id,home_id,entity_id,payload").maybeSingle();
  if (claimError) throw claimError;
  if (!job || !job.entity_id) return;

  let uploadedPath: string | null = null;
  let processedMediaId: string | null = null;
  let published = false;
  let pageId: string | null = null;
  try {
    const payload = receiptJobPayload(job.payload);
    pageId = payload.pageId;
    const { data: original, error: originalError } = await client.from("media_assets")
      .select("id,bucket_id,object_path").eq("home_id", job.home_id).eq("id", payload.originalMediaId).single();
    if (originalError) throw originalError;
    const { data: sourceBlob, error: downloadError } = await client.storage.from(original.bucket_id).download(original.object_path);
    if (downloadError) throw downloadError;
    const source = Buffer.from(await sourceBlob.arrayBuffer());
    const { metadata, enhanced, ocrImage } = await enhanceReceipt(source);

    processedMediaId = randomUUID();
    uploadedPath = `${job.home_id}/${job.entity_id}/processed/${processedMediaId}.webp`;
    const { error: uploadError } = await client.storage.from("receipts").upload(uploadedPath, enhanced.data, {
      contentType: "image/webp", cacheControl: "31536000", upsert: false,
    });
    if (uploadError) throw uploadError;
    const { error: assetError } = await client.from("media_assets").insert({
      id: processedMediaId, home_id: job.home_id, bucket_id: "receipts", object_path: uploadedPath,
      kind: "document", mime_type: "image/webp", byte_size: enhanced.data.length,
      width: enhanced.info.width, height: enhanced.info.height,
      sha256: createHash("sha256").update(enhanced.data).digest("hex"),
    });
    if (assetError) throw assetError;

    await client.from("media_assets").update({ width: metadata.width ?? null, height: metadata.height ?? null,
      sha256: createHash("sha256").update(source).digest("hex") }).eq("home_id", job.home_id).eq("id", original.id);
    const ocr = await recognizeReceipt(ocrImage);
    const { error: ocrError } = await client.from("receipt_ocr_results").insert({
      home_id: job.home_id, receipt_id: job.entity_id, page_id: payload.pageId, engine: "tesseract",
      engine_version: ocr.version, raw_text: ocr.text,
      structured_data: { language: "eng", processing_version: 1 }, confidence: ocr.confidence,
    });
    if (ocrError) throw ocrError;
    const { error: pageError } = await client.from("receipt_pages").update({ processed_media_id: processedMediaId })
      .eq("home_id", job.home_id).eq("id", payload.pageId).is("processed_media_id", null);
    if (pageError) throw pageError;
    published = true;
    const { error: completeError } = await client.from("processing_jobs").update({ status: "completed", completed_at: new Date().toISOString(),
      result: { processedMediaId, ocrCharacters: ocr.text.length, confidence: ocr.confidence } }).eq("id", job.id);
    if (completeError) throw completeError;
  } catch (error) {
    if (!published) {
      if (pageId) await client.from("receipt_ocr_results").delete().eq("home_id", job.home_id).eq("page_id", pageId).eq("engine", "tesseract");
      if (processedMediaId) await client.from("media_assets").delete().eq("id", processedMediaId);
      if (uploadedPath) await client.storage.from("receipts").remove([uploadedPath]);
    }
    const message = error instanceof Error ? error.message : "Receipt processing failed";
    await client.from("processing_jobs").update({ status: "failed", completed_at: new Date().toISOString(), error_message: message }).eq("id", job.id);
    throw error;
  }
}

export async function resumeReceiptJobs(client: Client, homeId: string) {
  const staleBefore = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  await client.from("processing_jobs").update({ status: "pending", started_at: null, available_at: new Date().toISOString() })
    .eq("home_id", homeId).eq("job_type", "receipt.document").eq("status", "processing").lt("started_at", staleBefore);
  const { data: jobs, error } = await client.from("processing_jobs").select("id")
    .eq("home_id", homeId).eq("job_type", "receipt.document").eq("status", "pending")
    .lte("available_at", new Date().toISOString()).order("created_at").limit(1);
  if (error) throw error;
  if (jobs?.[0]) await processReceiptJob(client, jobs[0].id);
}

export function receiptJobRecord(homeId: string, receiptId: string, pageId: string, originalMediaId: string): Database["public"]["Tables"]["processing_jobs"]["Insert"] {
  return { home_id: homeId, job_type: "receipt.document", entity_id: receiptId, payload: { pageId, originalMediaId } };
}
