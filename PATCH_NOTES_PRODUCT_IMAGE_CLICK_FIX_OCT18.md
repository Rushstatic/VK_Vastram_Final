# Product image click fix — 18 Oct 2026

## Issue
A product card's first image click only flipped to a temporary details overlay. The user had to click a second time to open the product detail page, which appeared broken on desktop and mobile.

## Fix
- One click/tap on a product image opens that product's detail page immediately.
- Keyboard Enter/Space follows the same behavior.
- Removed the temporary flip overlay and its timer/state.
- Kept explicit quick-view (eye), Add to Bag, wishlist, and color swatch controls separate.
- Kept image tilt only for devices with hover support.

## Validation
Source-level checks confirm the delayed flip handlers and stale state references are removed. Run `npm ci`, `npm run build`, `npm run lint`, and the existing variant image regression script locally before deployment.
