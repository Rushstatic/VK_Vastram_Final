# VK VASTRAM UI polish + settings flicker fix

## Changes in this patch
- Persisted public site settings in a versioned localStorage cache and synchronously hydrate from it on app startup.
- Retain last-known-good settings on temporary Supabase request errors instead of replacing configured values with defaults.
- Header logo area reserves its geometry while settings load and avoids showing the unrelated bundled emblem before the configured logo is ready.
- Announcement bar reserves its height and no longer flashes invented default announcement copy while settings are loading.
- Restored the category image proportions to the supplied reference: 4:3 on mobile and 3:4 from the `sm` breakpoint upward, while preserving horizontal mobile scrolling.
- Made product quick actions visible on touch/mobile screens while keeping hover-reveal behavior on desktop.
- Improved category/product hover feedback, focus-visible states, scroll behavior, and reduced-motion support.
- ScrollReveal content remains visible if animation initialization is delayed or fails.

## After applying
1. Run `npm ci` (close dev servers first if Windows reports EPERM).
2. Run `npm run lint` and `npm run build`.
3. Test a cold first visit and a repeat visit: configured logo/announcement should not show unrelated defaults before loading.
4. Test a transient offline/Supabase failure: cached settings should remain visible.
5. Check mobile category carousel proportions and add-to-bag/quick-view controls, plus desktop hover actions.

Note: first-ever visitors with no cache see a reserved logo space and a neutral announcement placeholder until the real settings load; this prevents wrong branding from flashing. The cache is refreshed when the database returns successfully.
