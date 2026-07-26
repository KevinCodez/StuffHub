import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, requireUser } from "@/lib/api-auth";
import { runInventoryCommand, type InventoryCommand } from "@/lib/inventory-repository";

const itemInput = z.object({ name: z.string().trim().min(1), category: z.string().min(1), description: z.string(), estimatedReplacementValueCents: z.number().int().nonnegative(), purchaseYear: z.number().int().min(1900).max(2200).nullable(), serialNumber: z.string().nullable(), modelNumber: z.string().nullable().optional(), ownerName: z.string().trim().max(120).nullable().optional() });
const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("room.create"), id: z.string().uuid(), name: z.string().trim().min(1) }),
  z.object({ type: z.literal("room.update"), id: z.string().uuid(), name: z.string().trim().min(1) }),
  z.object({ type: z.literal("room.delete"), id: z.string().uuid() }),
  z.object({ type: z.literal("item.create"), id: z.string().uuid(), roomId: z.string().uuid(), input: itemInput }),
  z.object({ type: z.literal("item.update"), id: z.string().uuid(), roomId: z.string().uuid(), input: itemInput }),
  z.object({ type: z.literal("item.photo.delete"), id: z.string().uuid(), photoIndex: z.number().int().nonnegative() }),
  z.object({ type: z.literal("item.delete"), id: z.string().uuid() }),
  z.object({ type: z.literal("receipt.delete"), id: z.string().uuid() }),
  z.object({ type: z.literal("container.delete"), id: z.string().uuid() }),
  z.object({ type: z.literal("container.label.set"), id: z.string().uuid(), payload: z.string().min(1), createdAt: z.string().datetime() }),
  z.object({ type: z.literal("container.label.delete"), id: z.string().uuid() }),
  z.object({ type: z.literal("receipt.save"), id: z.string().uuid().optional(), newId: z.string().uuid(), input: z.object({ merchant: z.string(), purchaseDate: z.string().nullable(), totalCents: z.number().int().nonnegative(), description: z.string().optional(), itemIds: z.array(z.string().uuid()) }) }),
  z.object({ type: z.literal("receipt.attach"), receiptId: z.string().uuid(), itemId: z.string().uuid() }),
  z.object({ type: z.literal("container.save"), id: z.string().uuid().optional(), newId: z.string().uuid(), input: z.object({ roomId: z.string().uuid(), name: z.string().min(1), description: z.string(), ownerName: z.string().trim().max(120).nullable().optional(), itemIds: z.array(z.string().uuid()) }) }),
  z.object({ type: z.literal("warranty.save"), id: z.string().uuid().optional(), newId: z.string().uuid(), input: z.object({ provider: z.string().min(1), policyNumber: z.string(), purchaseDate: z.string().nullable(), durationMonths: z.number().int().nonnegative(), description: z.string(), claimContact: z.string(), itemIds: z.array(z.string().uuid()), receiptId: z.string().uuid().nullable() }) }),
  z.object({ type: z.literal("maintenance.create"), id: z.string().uuid(), input: z.object({ title: z.string().min(1), description: z.string(), startDate: z.string(), frequency: z.enum(["one_time", "monthly", "quarterly", "semiannual", "annual"]), itemIds: z.array(z.string().uuid()) }) }),
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { homeId?: string; command?: unknown };
    const homeId = z.string().uuid().safeParse(body.homeId);
    const command = commandSchema.safeParse(body.command);
    if (!homeId.success || !command.success) throw new ApiError(400, "Invalid inventory command");
    const { supabase } = await requireUser(request);
    const result = await runInventoryCommand(supabase, homeId.data, command.data as InventoryCommand);
    return Response.json({ result });
  } catch (error) { return errorResponse(error); }
}
