import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { createSupabaseServerClient } from "./supabase-server";

export const ACCESS_COOKIE = "stuffhub_access_token";
export const REFRESH_COOKIE = "stuffhub_refresh_token";

function secureCookies() {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.APP_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production";
}

export function setSessionCookies(response: NextResponse, accessToken: string, refreshToken: string, expiresIn: number) {
  const common = { httpOnly: true, sameSite: "lax" as const, secure: secureCookies(), path: "/" };
  response.cookies.set(ACCESS_COOKIE, accessToken, { ...common, maxAge: expiresIn });
  response.cookies.set(REFRESH_COOKIE, refreshToken, { ...common, maxAge: 60 * 60 * 24 * 30 });
}

export async function accessTokenFrom(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return (await cookies()).get(ACCESS_COOKIE)?.value ?? null;
}

export async function requireUser(request: NextRequest) {
  const accessToken = await accessTokenFrom(request);
  if (!accessToken) throw new ApiError(401, "Authentication required");
  const supabase = createSupabaseServerClient(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) throw new ApiError(401, "Session is invalid or expired");
  return { accessToken, supabase, user: data.user };
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error && /^SUPABASE_(URL|ANON_KEY) is required$/.test(error.message)) {
    return Response.json({ error: "The StuffHub backend is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY on the server." }, { status: 503 });
  }
  console.error(error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
