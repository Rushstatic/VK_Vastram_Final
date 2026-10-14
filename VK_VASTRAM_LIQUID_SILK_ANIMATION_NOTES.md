# VK VASTRAM — Liquid Silk Transitions

## Included
- Full-screen bottom-to-top maroon liquid-silk wave after a successful Add to Bag operation.
- Antique-gold edge and a short centered bag confirmation.
- Wave applies to product cards and the full product detail page through the shared cart handler.
- Quick View uses the same wave; the bag drawer opens after the add succeeds and remains underneath the transition.
- Failed authenticated cart additions do not trigger the wave or open the bag drawer.
- Buy Now bypasses the bag wave so it can proceed directly to checkout without showing the animation over checkout.
- Refined quick-view modal entrance and page-entry transitions.
- Respects `prefers-reduced-motion`.
- Cart pricing, inventory, payment, and order logic were not intentionally changed.

## Apply
1. Back up your current project.
2. Extract the ZIP and copy the contents of the `zip` folder into your project, reviewing/merging if you have newer local changes.
3. Keep your own `.env` and deployment secrets; they are not included.
4. Run `npm ci`, `npm run lint`, and `npm run build` before deployment.

## Verification note
The archive contents were checked, but dependency installation could not complete in the build environment because the npm registry package was unavailable. TypeScript/build checks therefore remain unverified and must be run locally before deploying.
