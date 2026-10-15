# VK VASTRAM — Filter, Saree Type CMS, Homepage Visibility & Card Motion Patch

Based on the latest supplied source ZIP `VKVASTRAM_Product_Budget_Saree_Type_Layout_Fixes.zip`.

## Changes
- Desktop collection filter sidebar now has its own viewport-bounded vertical scroll area while remaining sticky; the product grid no longer needs to scroll just to reach lower filter controls.
- Saree Types CMS now has a square image uploader per type. The saved image URL is stored in the existing `site_settings` row (`saree_types`) and takes precedence over the matching product image in Saree Traditions. Active types still require a matching visible saree product so the circle never links customers to an empty type.
- Homepage storefront now reads the saved homepage section visibility flags. Deactivating the `philosophy` section hides the Craftsmanship/Philosophy block. Hero and Category Showcase visibility flags are also honored. Saving a section refreshes the cache before dispatching the storefront update event.
- Product card detail flip duration reduced to 1.5 seconds, with a restrained antique-gold inner glow while the details face is visible.
- Additional low-risk polish: circle images use lazy loading and async decoding with low fetch priority; hover transitions are shorter and respect reduced-motion preferences.

## Notes
- No database migration is included; existing `site_settings` JSON stores the type image URL.
- This archive was checked for ZIP integrity and source-level consistency. Dependency installation timed out in this environment, so a full TypeScript/lint/build run could not be completed. Run `npm ci`, `npm run lint`, and `npm run build` locally before deployment.
- In Admin → Homepage, toggle the section and click **Save Section**. In Admin → Saree Types, upload images and click **Save types**.
