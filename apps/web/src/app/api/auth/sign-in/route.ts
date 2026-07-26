import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, setSessionCookies } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: string; password?: string; mobile?: boolean };
    if (!body.email || !body.password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    const { data, error } = await createSupabaseServerClient().auth.signInWithPassword({ email: body.email, password: body.password });
    if (error || !data.session) return NextResponse.json({ error: error?.message ?? "Unable to sign in" }, { status: 401 });
    const payload = body.mobile ? { user: { id: data.user.id, email: data.user.email }, accessToken: data.session.access_token, refreshToken: data.session.refresh_token }
      : { user: { id: data.user.id, email: data.user.email } };
    const response = NextResponse.json(payload);
    if (!body.mobile) setSessionCookies(response, data.session.access_token, data.session.refresh_token, data.session.expires_in);
    return response;
  } catch (error) { return errorResponse(error); }
}
