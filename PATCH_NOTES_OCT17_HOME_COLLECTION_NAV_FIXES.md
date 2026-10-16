# VK VASTRAM — Mobile Spacing, Navigation, and Collection Visibility Fixes

## Changes

- Saree Traditions carousel now gives each animation wrapper a stable mobile width, so the circular cards no longer overlap. Reduced mobile section/rail spacing below the cards.
- Responsive header uses a three-column desktop grid at wide sizes, smaller wordmark/letter spacing, and a more compact desktop navigation to prevent Track Order and the brand from colliding.
- Mobile drawer is available through tablet widths and has a visible **Track Your Order** row directly in the navigation list.
- The Sale navigation item in desktop, mobile, and footer follows the CMS `Seasonal Sale`/`seasonal-archive` record when one exists. If it is active, Sale opens that collection; if archived, the Sale entry is hidden. If no managed seasonal collection exists, the existing generic `/sale` route remains available.
- The homepage now renders an active Seasonal Sale collection section using products assigned to that collection. If it is active but has no active products, the section tells visitors the edit is being curated instead of rendering a blank product rail.
- The hardcoded curated bedsheet section is hidden once CMS loading confirms that the corresponding Artisanal Bedsheets collection is archived.
- App refreshes collection and homepage state on admin change events, tab focus, and cross-tab storage events.

## Database migration required

`supabase/migrations/20261017000001_storefront_collection_visibility.sql`

Public collection SELECT RLS intentionally returns active collection rows only. This meant the browser could not distinguish “archived” from “not present” and could keep showing the hardcoded section. The migration adds `storefront_collection_visibility()`, a restricted SECURITY DEFINER RPC that exposes only collection slug, active flag, and sort order. It does not expose archived descriptions or images. The service merges minimal inactive-state records into the storefront's in-memory collection list to enforce visibility without changing the full-row RLS policy.

Apply this migration to Supabase before expecting archived-state synchronization to work. Check migration history first, particularly because earlier security migrations may have been applied manually through the SQL Editor. Do not blindly run `supabase db push` if local and remote histories differ.

## Validation

- ZIP integrity check passed.
- TypeScript transpilation syntax scan passed for all 104 `.ts`/`.tsx` source files.
- Full `npm run lint` and `npm run build` were not completed in this packaging environment because `npm ci` hung/timed out and required dependencies (including `vite/client`) were unavailable. Run them locally before deployment.
- No browser test or live Supabase/RLS test was run. Verify mobile carousel width, desktop header at 1280px and wider, mobile drawer tracking link, collection archive/unarchive transitions, and Seasonal Sale routing in staging.
