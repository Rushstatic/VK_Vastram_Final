# VK VASTRAM — Homepage Realtime Crash Fix (2026-10-18)

## Root cause

`useSareeTypes()` is consumed by the desktop/mobile header, the Saree Traditions home section, and collection filtering. The hook previously tried to initialize its own realtime channel from each mounted instance using the same `shared-saree-type-settings-sync` topic. The fixed version uses a fresh `shared-saree-type-settings-sync-v2` topic to avoid reusing an already-joined stale development channel. The browser error reported `cannot add postgres_changes callbacks ... after subscribe()`, and the uncaught setup error reached `AppErrorBoundary`, replacing the storefront with a crash screen.

## Fix

- Centralized the realtime channel at module scope so only one channel is initialized for these hook consumers.
- Registered the Postgres listener before `subscribe()` and stored the channel reference before subscription begins.
- Fan out notifications to current hook instances via a listener set.
- Guard realtime setup and database refresh with try/catch; Realtime is now an enhancement, not a condition for rendering the homepage.
- If Realtime or the network is unavailable, initial fetch plus window focus/storage/custom-event refresh remains available; errors are warnings, not fatal React errors.
- The New Arrivals ordering and Featured-only Curated Heritage section are preserved from the prior package.

## Validation

Run locally:

```powershell
npm ci
npm run build
npm run lint
```

Then load the homepage with DevTools open. Confirm the homepage renders even when the Supabase Realtime WebSocket is blocked or disconnected. Confirm the `cannot add postgres_changes callbacks ... after subscribe()` error no longer occurs. Google Fonts timeouts and Realtime WebSocket warnings are separate network conditions and must not crash the page.
