import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: string };
    if (!body.email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
    const configuredRedirect = process.env.PASSWORD_RESET_REDIRECT_URL;
    const redirectTo = configuredRedirect || `${request.nextUrl.origin}/?recovery=1`;
    const { error } = await createSupabaseServerClient().auth.resetPasswordForEmail(body.email.trim(), { redirectTo });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ message: "If an account exists for that email, a password reset link has been sent." });
  } catch (error) { return errorResponse(error); }
}
