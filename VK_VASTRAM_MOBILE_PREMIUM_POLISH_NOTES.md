# VK VASTRAM — Mobile Wave & Spacing Polish

Changes in this patch:
- Centered the bag-wave overlay to the viewport width and clipped horizontal overflow to prevent right drift on mobile.
- Adjusted wave timing to a slower 1.12s sequence with a brief start pause and a subtle mid-transition drift.
- Reduced excessive mobile section padding in the featured sarees, categories, and craftsmanship sections.
- Restored category image proportions to 4:3 on mobile and 3:4 from the sm breakpoint, matching the supplied reference.
- Reduced mobile product-card rail width and kept quick actions inside the card.
- Added a translucent, blurred finish to the mobile navigation drawer and shopping bag drawer.

Before deployment:
1. Merge the `zip` folder into your local project, preserving `.env` and newer work.
2. Run `npm ci`, `npm run lint`, and `npm run build`.
3. Test at narrow mobile widths (320px, 360px, 390px) and desktop; check the wave, drawer open/close, and horizontal product rails.
