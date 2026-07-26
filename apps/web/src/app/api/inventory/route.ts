import { after, type NextRequest } from "next/server";
import { errorResponse, requireUser } from "@/lib/api-auth";
import { loadInventory } from "@/lib/inventory-repository";
import { resumeReceiptJobs } from "@/lib/receipt-processing";

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireUser(request);
    const inventory = await loadInventory(supabase, request.nextUrl.searchParams.get("homeId"), request.nextUrl, !request.headers.has("authorization"));
    if (inventory) after(() => resumeReceiptJobs(supabase, inventory.id).catch((processingError) => console.error("Receipt processing resume failed", processingError)));
    return Response.json({ inventory });
  } catch (error) { return errorResponse(error); }
}
