import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, setSessionCookies } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: string; password?: string; displayName?: string; homeName?: string; mobile?: boolean };
    if (!body.email || !body.password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    const client = createSupabaseServerClient();
    const { data, error } = await client.auth.signUp({ email: body.email, password: body.password, options: { data: { display_name: body.displayName?.trim() } } });
    if (error || !data.user) return NextResponse.json({ error: error?.message ?? "Unable to create account" }, { status: 400 });
    if (!data.session) return NextResponse.json({ user: { id: data.user.id, email: data.user.email }, confirmationRequired: true }, { status: 202 });
    const userClient = createSupabaseServerClient(data.session.access_token);
    const { error: homeError } = await userClient.rpc("create_home", { home_name: body.homeName?.trim() || "My Home", currency: "USD" });
    if (homeError) return NextResponse.json({ error: homeError.message }, { status: 400 });
    const payload = body.mobile ? { user: { id: data.user.id, email: data.user.email }, accessToken: data.session.access_token, refreshToken: data.session.refresh_token }
      : { user: { id: data.user.id, email: data.user.email } };
    const response = NextResponse.json(payload, { status: 201 });
    if (!body.mobile) setSessionCookies(response, data.session.access_token, data.session.refresh_token, data.session.expires_in);
    return response;
  } catch (error) { return errorResponse(error); }
}
