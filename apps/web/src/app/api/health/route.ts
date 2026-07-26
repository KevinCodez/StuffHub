export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return Response.json({ status: "unhealthy", error: "Supabase is not configured" }, { status: 503 });
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/health`, {
      cache: "no-store",
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) throw new Error(`Auth health check returned ${response.status}`);
    return Response.json({ status: "ok" });
  } catch (error) {
    console.error("Health check failed", error);
    return Response.json({ status: "unhealthy" }, { status: 503 });
  }
}
