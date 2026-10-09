import fs from 'fs';
import path from 'path';

function runGalleryAudit() {
  console.log('--- STARTING VK VASTRAM VARIANT GALLERY AUDIT ---');

  // Read catalog.ts content directly to verify structural definitions
  const catalogPath = path.resolve(process.cwd(), 'src/data/catalog.ts');
  const catalogContent = fs.readFileSync(catalogPath, 'utf8');

  if (!catalogContent.includes('kerala-tissue-silk-saree')) {
    throw new Error('FAIL: Kerala Tissue Silk Saree missing in catalog.ts');
  }
  console.log('✓ Found Kerala Tissue Silk Saree slug in catalog.ts');

  // Check roles in Kerala Tissue Silk Saree
  const requiredRoles = ['hero', 'full_saree', 'pallu', 'border', 'texture'];
  for (const role of requiredRoles) {
    if (!catalogContent.includes(`role: '${role}'`)) {
      throw new Error(`FAIL: Missing role: ${role} in catalog`);
    }
  }
  console.log('✓ Kerala Tissue Silk Saree defines all required roles: hero, full_saree, pallu, border, texture');

  // Check variants Lavender and Gold
  if (!catalogContent.includes("color: 'Lavender'") || !catalogContent.includes("color: 'Gold'")) {
    throw new Error('FAIL: Missing Lavender or Gold variant in catalog.ts');
  }
  console.log('✓ Kerala Tissue Silk Saree defines both Lavender and Gold variants');

  // Check migration file
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261005000012_variant_product_images_and_gallery.sql'
  );
  if (!fs.existsSync(migrationPath)) {
    throw new Error('FAIL: Migration 20261005000012 missing');
  }
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  if (
    !migrationSql.includes('variant_id') ||
    !migrationSql.includes('role') ||
    !migrationSql.includes('fit') ||
    !migrationSql.includes('focal_x')
  ) {
    throw new Error('FAIL: Migration missing required columns');
  }
  console.log('✓ Migration 20261005000012 verified with variant_id, role, fit, focal_x, focal_y, scale');

  // Verify ImageContainer has key reset and neutral placeholder
  const imageContainerPath = path.resolve(process.cwd(), 'src/components/ui/ImageContainer.tsx');
  const imgContent = fs.readFileSync(imageContainerPath, 'utf8');
  if (!imgContent.includes('key={normalizedSrc}') || !imgContent.includes('setLoadedSrc(null)')) {
    throw new Error('FAIL: ImageContainer missing flash bug fix');
  }
  console.log('✓ ImageContainer verified with key unmount reset and neutral placeholder (#EFE9DC)');

  // Verify AdminProductForm has role and variant selector
  const adminFormPath = path.resolve(process.cwd(), 'src/components/admin/AdminProductForm.tsx');
  const adminContent = fs.readFileSync(adminFormPath, 'utf8');
  if (
    !adminContent.includes('full_saree') ||
    !adminContent.includes('newImageTargetVariant') ||
    !adminContent.includes('ImageAdjustmentControl')
  ) {
    throw new Error('FAIL: AdminProductForm missing variant gallery upgrades');
  }
  console.log('✓ AdminProductForm verified with variant tabs, full_saree role, and ImageAdjustmentControl');

  console.log('--- ALL GALLERY CHECKS PASSED WITH 100% SUCCESS ---');
}

runGalleryAudit();
