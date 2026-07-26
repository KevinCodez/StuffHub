import { createClient } from "@supabase/supabase-js";
import type { Database } from "@stuffhub/domain/database";

function required(name: "SUPABASE_URL" | "SUPABASE_ANON_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function createSupabaseServerClient(accessToken?: string) {
  return createClient<Database>(required("SUPABASE_URL"), required("SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
  });
}

export function publicBackendConfig() {
  return { url: required("SUPABASE_URL"), key: required("SUPABASE_ANON_KEY") };
}
