# Supabase-only architecture

This repository is configured to use Supabase as the single database layer.

## Rule
- Do not introduce or reintroduce any alternative database backend (such as Vafebiz, Fayebiz, or similar).
- Keep all persistence logic centered on Supabase clients and RLS-safe queries.
- Use only `@supabase/supabase-js` and the project `supabase-config.json` / environment variables for database access.

## Approved patterns
- `createClient(...)` from `@supabase/supabase-js`
- `supabase.from('...')`
- `supabase.auth.*`
- RLS-based `userClient` with Authorization header for per-workshop access

## Forbidden patterns
- Direct calls to third-party DB SDKs
- Hard-coded references to Vafebiz / Fayebiz / FaiB biz names
- Mixing local-only DB logic with Supabase unless explicitly required for offline-first UI state

## AI Studio instruction for future edits
When modifying this repository, follow this checklist:
1. Confirm whether the file is database-access related.
2. If yes, use Supabase only.
3. Never add new DB provider code.
4. Prefer the existing `supabase-config.json` + `process.env.*` pattern.
5. If an old reference to another database is found, replace it with the Supabase equivalent and remove the stale code.
6. Keep the codebase consistent with the current architecture and do not introduce parallel storage systems.

## Current repo state
- The app and server code are already centered on Supabase clients.
- `server.ts`, `src/db/productsCloud.ts`, and related modules use Supabase and workshop-scoped data access.
- Any leftover references in external config, environment files, or deployment setup should be removed to keep the system fully Supabase-only.
