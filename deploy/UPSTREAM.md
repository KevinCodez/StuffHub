# Vendored Supabase configuration

The database initialization and Kong entrypoint files in `volumes/` were
adapted from the Supabase Docker distribution at commit
`2b27ed0ab17ec74f17bfa2e4e54175e3a1f5b444` (2026-07-25).

Upstream project: <https://github.com/supabase/supabase/tree/master/docker>

Only services required by StuffHub are included in `compose.yaml`. Studio,
Realtime, Edge Functions, Analytics, and Supavisor are intentionally omitted.
