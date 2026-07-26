import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { accessToken?: string; refreshToken?: string; password?: string };
    if (!body.accessToken || !body.refreshToken) return NextResponse.json({ error: "Recovery session is missing or expired" }, { status: 401 });
    if (!body.password || body.password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    const client = createSupabaseServerClient(body.accessToken);
    const { error: sessionError } = await client.auth.setSession({ access_token: body.accessToken, refresh_token: body.refreshToken });
    if (sessionError) return NextResponse.json({ error: "Recovery link is invalid or expired. Request a new reset link." }, { status: 401 });
    const { error } = await client.auth.updateUser({ password: body.password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ message: "Password updated. You can now sign in." });
  } catch (error) { return errorResponse(error); }
}
