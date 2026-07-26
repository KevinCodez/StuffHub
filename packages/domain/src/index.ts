import { z } from "zod";

export type { Database, Json } from "./database.types";

export const inventoryItemSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid(),
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string(),
  estimatedReplacementValueCents: z.number().int().nonnegative(),
  purchaseYear: z.number().int().min(1900).max(2200).nullable(),
  serialNumber: z.string().nullable(),
  modelNumber: z.string().nullable().optional(),
  ownerName: z.string().nullable().optional(),
  photoUris: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
});

export type InventoryItem = z.infer<typeof inventoryItemSchema>;

export const receiptSchema = z.object({
  id: z.string().uuid(),
  merchant: z.string().min(1),
  purchaseDate: z.string().nullable(),
  totalCents: z.number().int().nonnegative(),
  imageUri: z.string().nullable(),
  photoUris: z.array(z.string()).optional(),
  description: z.string().optional(),
  itemIds: z.array(z.string().uuid()),
  createdAt: z.string(),
});

export type Receipt = z.infer<typeof receiptSchema>;

export interface Warranty {
  id: string;
  provider: string;
  policyNumber: string;
  purchaseDate: string | null;
  durationMonths: number;
  description: string;
  claimContact: string;
  itemIds: string[];
  receiptId: string | null;
  documentUris: string[];
}

export interface MaintenanceReminder {
  id: string;
  title: string;
  description: string;
  startDate: string;
  frequency: "one_time" | "monthly" | "quarterly" | "semiannual" | "annual";
  itemIds: string[];
}

export interface InventoryContainer {
  id: string;
  roomId: string;
  name: string;
  description: string;
  ownerName?: string | null;
  itemIds: string[];
  label?: {
    payload: string;
    qrCodeDataUri: string;
    createdAt: string;
  };
}

export interface RoomPhoto {
  id: string;
  uri: string;
  capturedAt: string;
}

export interface Room {
  id: string;
  name: string;
  photoCount: number;
  photos: RoomPhoto[];
  scanStatus: "not_started" | "ready" | "review_needed";
  items: InventoryItem[];
}

export interface HomeInventory {
  id: string;
  name: string;
  updatedAt: string;
  rooms: Room[];
  receipts: Receipt[];
  warranties: Warranty[];
  maintenanceReminders: MaintenanceReminder[];
  containers: InventoryContainer[];
}

export const sampleInventory: HomeInventory = {
  id: "1db035fd-f8b4-4f37-8702-8fab721f5420",
  name: "My Home",
  updatedAt: "2026-07-15T20:15:00.000Z",
  rooms: [
    {
      id: "9f117ee2-f36c-4b48-bc94-c2e28559d33d",
      name: "Living room",
      photoCount: 6,
      photos: [],
      scanStatus: "review_needed",
      items: [
        {
          id: "84d3eeab-47cf-479c-80bc-4dc447ea3fa3",
          roomId: "9f117ee2-f36c-4b48-bc94-c2e28559d33d",
          name: "55-inch television",
          category: "Electronics",
          description: "Flat-screen television on media console",
          estimatedReplacementValueCents: 64900,
          purchaseYear: null,
          serialNumber: null,
          confidence: 0.94,
        },
        {
          id: "8b93e66c-4864-4e9e-92b6-4d8118c65a39",
          roomId: "9f117ee2-f36c-4b48-bc94-c2e28559d33d",
          name: "Sectional sofa",
          category: "Furniture",
          description: "Five-seat upholstered sectional",
          estimatedReplacementValueCents: 180000,
          purchaseYear: 2022,
          serialNumber: null,
          confidence: 0.89,
        },
      ],
    },
    {
      id: "84a2b96c-fcac-41e0-a207-60e31ee90939",
      name: "Kitchen",
      photoCount: 0,
      photos: [],
      scanStatus: "not_started",
      items: [],
    },
    {
      id: "139391cc-f992-402a-b0b6-c88c6f2dafae",
      name: "Primary bedroom",
      photoCount: 4,
      photos: [],
      scanStatus: "ready",
      items: [],
    },
  ],
  receipts: [],
  warranties: [],
  maintenanceReminders: [],
  containers: [],
};

export function inventoryTotal(inventory: HomeInventory): number {
  return inventory.rooms.flatMap((room) => room.items).reduce(
    (total, item) => total + item.estimatedReplacementValueCents,
    0,
  );
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
