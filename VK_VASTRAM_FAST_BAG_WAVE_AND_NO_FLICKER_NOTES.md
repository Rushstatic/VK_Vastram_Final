# VK VASTRAM — Fast Bag Wave & Branding Flicker Patch

## Changes
- Bag wave starts immediately on the Add to Bag interaction, before waiting for authenticated cart API round-trips.
- If an authenticated cart mutation fails, the success overlay is dismissed.
- Bag wave duration reduced from 1180ms to 780ms.
- Full-screen maroon wave surface now covers the viewport instead of leaving an uncovered top region.
- Public site settings are cached in localStorage and reused on initial render, then refreshed from Supabase.
- Header avoids showing the fallback emblem while settings are still loading and a configured logo URL is not yet known.
- Announcement bar reserves its height and no longer flashes unrelated fallback announcement text before settings load.

## Verify before deployment
Run `npm ci`, `npm run lint`, and `npm run build`.
Test Add to Bag as guest and authenticated user, including Quick View. Simulate a failed authenticated cart request and confirm the wave disappears.
Clear localStorage once to test first-ever visitor behavior; the header should reserve the logo space rather than flash the fallback emblem. On first-ever visit, branding appears once the settings request completes.
