import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, errorResponse, setSessionCookies } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { refreshToken?: string; mobile?: boolean };
    const refreshToken = body.refreshToken ?? (await cookies()).get(REFRESH_COOKIE)?.value;
    if (!refreshToken) return NextResponse.json({ error: "Refresh token is required" }, { status: 401 });
    const { data, error } = await createSupabaseServerClient().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) return NextResponse.json({ error: "Session could not be refreshed" }, { status: 401 });
    const payload = body.mobile ? { accessToken: data.session.access_token, refreshToken: data.session.refresh_token } : { ok: true };
    const response = NextResponse.json(payload);
    if (!body.mobile) setSessionCookies(response, data.session.access_token, data.session.refresh_token, data.session.expires_in);
    return response;
  } catch (error) { return errorResponse(error); }
}
