import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, accessTokenFrom } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const token = await accessTokenFrom(request);
  if (token) await createSupabaseServerClient(token).auth.signOut().catch(() => undefined);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}
