-- =====================================================================
-- VK VASTRAM SUPABASE SEED DATA (DEVELOPMENT ENVIRONMENT)
-- Migration: 20261005000003_seed_data.sql
-- All UUIDs are strictly valid 8-4-4-4-12 hexadecimal literals (0-9, a-f)
-- =====================================================================

-- 1. CATEGORIES SEED
INSERT INTO public.categories (id, name, slug, description, image_url, sort_order, is_active)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Sarees', 'sarees', 'Banarasi, Kanjivaram, Paithani & Chanderi Weaves', '/src/assets/images/product_banarasi_saree_1791192143761.jpg', 1, TRUE),
  ('a0000000-0000-0000-0000-000000000002', 'Bedsheets', 'bedsheets', 'Hand-block Printed, Percale & High Thread Count Cotton', '/src/assets/images/product_bedsheet_cotton_1791192169249.jpg', 2, TRUE),
  ('a0000000-0000-0000-0000-000000000003', 'Home Textiles', 'home-textiles', 'Woven Throws, Cushion Covers & Dining Linens', '/src/assets/images/craft_textile_detail_1791192181572.jpg', 3, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 2. COLLECTIONS SEED
INSERT INTO public.collections (id, name, slug, description, image_url, banner_image_url, sort_order, is_active)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Heritage Sarees', 'heritage-sarees', 'Classical handloom drapes woven by master artisans', '/src/assets/images/hero_vastram_saree_1791192126882.jpg', '/src/assets/images/hero_vastram_saree_1791192126882.jpg', 1, TRUE),
  ('b0000000-0000-0000-0000-000000000002', 'Artisanal Bedsheets', 'artisanal-bedsheets', 'Breathable long-staple cotton and natural vegetable block prints', '/src/assets/images/product_bedsheet_cotton_1791192169249.jpg', '/src/assets/images/product_bedsheet_cotton_1791192169249.jpg', 2, TRUE),
  ('b0000000-0000-0000-0000-000000000003', 'Seasonal Archive', 'seasonal-archive', 'Archival weave batches with special seasonal allocations', '/src/assets/images/craft_textile_detail_1791192181572.jpg', '/src/assets/images/craft_textile_detail_1791192181572.jpg', 3, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 3. PRODUCTS SEED
INSERT INTO public.products (
  id, slug, name, short_description, description, category_id, collection_id, sku,
  price, mrp, discount_percentage, status, featured, bestseller, new_arrival,
  fabric, weave, origin, dimensions, care_instructions, seo_title, seo_description
)
VALUES
  (
    'c0000000-0000-0000-0000-000000000001',
    'royal-emerald-banarasi-katan-silk-saree',
    'Royal Emerald Banarasi Katan Silk Saree',
    'Pure mulberry silk with antique gold jaal brocade.',
    'Woven in Varanasi using pure katan silk and antique zari. Features intricate floral jaal motifs across the body with an ornate pallu suitable for festive and wedding wear.',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'VK-SAR-BAN-001',
    18500.00,
    22000.00,
    15.90,
    'active',
    TRUE,
    TRUE,
    FALSE,
    '100% Pure Katan Silk',
    'Kadwa Brocade Handloom',
    'Varanasi, Uttar Pradesh',
    '5.5 meters saree with 0.8m running blouse piece',
    'Dry clean only. Store folded in muslin or soft cotton cloth away from moisture.',
    'Royal Emerald Banarasi Katan Silk Saree | VK VASTRAM',
    'Handwoven pure Katan silk Banarasi saree in emerald green with antique gold zari work.'
  ),
  (
    'c0000000-0000-0000-0000-000000000002',
    'crimson-temple-zari-kanjivaram-silk-saree',
    'Crimson & Temple Zari Kanjivaram Silk Saree',
    'Heavy 3-ply mulberry silk with authentic Korvai border.',
    'A heavy-weight Kanjivaram drape woven with three-ply twisted pure mulberry silk and golden zari borders featuring traditional temple gopuram motifs.',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'VK-SAR-KAN-002',
    24500.00,
    28000.00,
    12.50,
    'active',
    TRUE,
    TRUE,
    TRUE,
    'Pure Mulberry Silk (3-Ply)',
    'Korvai Handloom Technique with Tested Zari',
    'Kanchipuram, Tamil Nadu',
    '5.5 meters saree + 80 cm attached unstitched blouse piece',
    'Professional dry clean only. Periodically air in shade and refold.',
    'Crimson & Temple Zari Kanjivaram Silk Saree | VK VASTRAM',
    'Traditional heavy Kanjivaram bridal saree in crimson with gold zari temple borders.'
  ),
  (
    'c0000000-0000-0000-0000-000000000003',
    'ivory-blush-chanderi-silk-cotton-saree',
    'Ivory & Blush Chanderi Silk Cotton Saree',
    'Translucent lightweight silk cotton with golden eknaliya buttis.',
    'An airy, translucent Chanderi drape combining delicate silk warp with fine cotton weft. Adorned with subtle golden eknaliya buttis and a shimmering tissue zari border.',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'VK-SAR-CHA-003',
    7800.00,
    9200.00,
    15.20,
    'active',
    TRUE,
    FALSE,
    TRUE,
    'Pure Silk & Mercerised Cotton blend',
    'Traditional Chanderi Handloom',
    'Chanderi, Madhya Pradesh',
    '6.2 meters including contrast blouse piece',
    'Dry clean recommended. Light steam iron on reverse side.',
    'Ivory & Blush Chanderi Silk Cotton Saree | VK VASTRAM',
    'Delicate handwoven Chanderi silk cotton saree with fine golden zari border.'
  ),
  (
    'c0000000-0000-0000-0000-000000000004',
    'indigo-bagh-handblock-printed-cotton-bedsheet',
    'Indigo Bagh Hand-Block Printed Cotton Bedsheet Set',
    '400 thread count organic percale with natural indigo block print.',
    'Hand-block printed with carved teakwood blocks using natural mineral and indigo dyes on crisp 400 thread count percale cotton. Set includes one bedsheet and two pillow shams.',
    'a0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000002',
    'VK-BED-BAG-004',
    3450.00,
    4200.00,
    17.85,
    'active',
    TRUE,
    TRUE,
    FALSE,
    '100% Long-Staple Cotton (400 TC)',
    'Crisp Percale Weave',
    'Bagh, Madhya Pradesh',
    'King: 274 x 274 cm (108" x 108") | Pillowcases: 45 x 70 cm',
    'Machine wash cold on gentle cycle with mild detergent. Line dry in shade.',
    'Indigo Bagh Hand-Block Printed Cotton Bedsheet | VK VASTRAM',
    '400 TC organic cotton bedsheet set handblock printed in Bagh with natural indigo.'
  ),
  (
    'c0000000-0000-0000-0000-000000000005',
    'sandstone-giza-sateen-bedsheet-set',
    'Sandstone Giza Cotton Sateen Bedsheet Set',
    '500 thread count long-staple sateen with tailored hemstitch.',
    'Ultra-smooth long-staple cotton in a warm neutral sandstone tone, tailored with a clean tailored hemstitch border. Naturally breathable with a lustrous drape.',
    'a0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000002',
    'VK-BED-GIZ-005',
    4800.00,
    5800.00,
    17.24,
    'active',
    FALSE,
    TRUE,
    FALSE,
    '100% Giza Long-Staple Cotton Sateen',
    'Sateen Weave',
    'Coimbatore, Tamil Nadu',
    'Super King: 275 x 300 cm (108" x 118") | Pillowcases: 50 x 75 cm',
    'Machine wash warm (40°C). Tumble dry low or air dry for optimum hand-feel.',
    'Sandstone Giza Cotton Sateen Bedsheet Set | VK VASTRAM',
    '500 thread count Egyptian Giza cotton sateen bedsheet set in warm neutral sandstone.'
  ),
  (
    'c0000000-0000-0000-0000-000000000006',
    'heritage-paithani-silk-saree-peacock-pallu',
    'Heritage Paithani Silk Saree with Peacock Pallu',
    'Traditional Maharashtrian handloom with gold Muniya border.',
    'Traditional Maharashtrian handloom Paithani woven with fine mulberry silk yarn. Highlighted by the iconic oblique square design border (narali) and a vibrant peacock mor pallu.',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'VK-SAR-PAI-006',
    21000.00,
    25000.00,
    16.00,
    'active',
    TRUE,
    FALSE,
    TRUE,
    'Pure Mulberry Silk with Gold Muniya Border',
    'Paithani Tapestry Handloom',
    'Yeola, Maharashtra',
    '6.0 meters saree with matching unstitched blouse',
    'Dry clean only. Refold along different creases every six months.',
    'Heritage Paithani Silk Saree with Peacock Pallu | VK VASTRAM',
    'Handwoven Paithani silk saree in royal purple with handloom peacock pallu.'
  ),
  (
    'c0000000-0000-0000-0000-000000000007',
    'raw-tussar-silk-saree-kantha-stitch',
    'Raw Tussar Silk Saree with Hand Kantha Work',
    'Handspun wild Tussar with intricate hand-embroidered Kantha motifs.',
    'Handspun natural wild Tussar silk in an earthy beige tone, embellished with running Kantha needlework depicting traditional floral creeper motifs.',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'VK-SAR-TUS-007',
    13500.00,
    15500.00,
    12.90,
    'active',
    FALSE,
    FALSE,
    TRUE,
    '100% Wild Raw Tussar Silk',
    'Handspun Textured Silk with Hand Needlework',
    'Santiniketan, West Bengal',
    '6.0 meters with embroidered running blouse',
    'Dry clean only. Iron on silk heat with protective cloth.',
    'Raw Tussar Silk Saree with Hand Kantha Work | VK VASTRAM',
    'Textured raw Tussar silk saree with authentic Bengal Kantha hand needlework.'
  ),
  (
    'c0000000-0000-0000-0000-000000000008',
    'handloom-cotton-throw-blanket',
    'Handloom Waffle Weave Pure Cotton Throw',
    'Breathable combed cotton with honeycomb waffle texture and fringe tassels.',
    'Woven on wooden table looms using breathable combed cotton yarn. Features a rich honeycomb waffle texture finished with knotted fringe tassels.',
    'a0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000003',
    'VK-HOM-WAF-008',
    2200.00,
    2600.00,
    15.38,
    'active',
    FALSE,
    TRUE,
    FALSE,
    '100% Combed Indian Cotton',
    'Honeycomb Waffle Weave',
    'Karur, Tamil Nadu',
    '150 x 200 cm (60" x 78")',
    'Machine wash cold with similar colors. Gentle tumble dry.',
    'Handloom Waffle Weave Pure Cotton Throw | VK VASTRAM',
    'Pure cotton waffle weave handloom throw blanket with handmade fringe tassels.'
  )
ON CONFLICT (id) DO NOTHING;

-- 4. PRODUCT IMAGES SEED
INSERT INTO public.product_images (id, product_id, image_url, alt_text, sort_order, is_primary)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '/src/assets/images/product_banarasi_saree_1791192143761.jpg', 'Royal Emerald Banarasi Katan Silk Saree Front View', 1, TRUE),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', '/src/assets/images/hero_vastram_saree_1791192126882.jpg', 'Royal Emerald Banarasi Saree Model Drape', 2, FALSE),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', '/src/assets/images/hero_vastram_saree_1791192126882.jpg', 'Crimson & Temple Zari Bridal Kanjivaram Full Drape', 1, TRUE),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', '/src/assets/images/product_banarasi_saree_1791192143761.jpg', 'Kanjivaram Silk Border Detail', 2, FALSE),
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000003', '/src/assets/images/product_chanderi_saree_1791192155766.jpg', 'Ivory Blush Chanderi Silk Saree Studio View', 1, TRUE),
  ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000003', '/src/assets/images/craft_textile_detail_1791192181572.jpg', 'Chanderi Zari Eknaliya Butti Weave Detail', 2, FALSE),
  ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000004', '/src/assets/images/product_bedsheet_cotton_1791192169249.jpg', 'Indigo Bagh Hand-Block Printed Bedsheet Bed Setting', 1, TRUE),
  ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000005', '/src/assets/images/product_bedsheet_cotton_1791192169249.jpg', 'Sandstone Giza Sateen Bedsheet Setting', 1, TRUE),
  ('d0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000006', '/src/assets/images/product_banarasi_saree_1791192143761.jpg', 'Heritage Paithani Silk Saree Studio View', 1, TRUE),
  ('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000007', '/src/assets/images/craft_textile_detail_1791192181572.jpg', 'Raw Tussar Silk Kantha Stitch Detail', 1, TRUE),
  ('d0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000008', '/src/assets/images/craft_textile_detail_1791192181572.jpg', 'Handloom Waffle Throw Texture View', 1, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 5. PRODUCT VARIANTS SEED
INSERT INTO public.product_variants (
  id, product_id, sku, variant_name, color, size, bed_size, dimensions,
  stock_quantity, reserved_quantity, is_active
)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'VK-SAR-BAN-001-EME', 'Emerald Green', 'Emerald Green', 'Standard 5.5m + 0.8m Blouse', NULL, '5.5m + 0.8m', 12, 0, TRUE),
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'VK-SAR-BAN-001-WIN', 'Deep Wine', 'Deep Wine', 'Standard 5.5m + 0.8m Blouse', NULL, '5.5m + 0.8m', 8, 0, TRUE),
  ('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'VK-SAR-KAN-002-CRM', 'Crimson Red', 'Crimson Red', 'Standard 5.5m + 0.8m Blouse', NULL, '5.5m + 0.8m', 10, 0, TRUE),
  ('e0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003', 'VK-SAR-CHA-003-IVO', 'Ivory Blush', 'Ivory Blush', 'Standard 6.2m with Blouse', NULL, '6.2m', 15, 0, TRUE),
  ('e0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000004', 'VK-BED-BAG-004-KNG', 'Indigo King', 'Indigo & Sandstone', 'King Size (108" x 108")', 'King', '274 x 274 cm', 20, 0, TRUE),
  ('e0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000004', 'VK-BED-BAG-004-QEN', 'Indigo Queen', 'Indigo & Sandstone', 'Queen Size (90" x 108")', 'Queen', '228 x 274 cm', 15, 0, TRUE),
  ('e0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000005', 'VK-BED-GIZ-005-SKN', 'Sandstone Super King', 'Warm Sandstone', 'Super King (108" x 118")', 'Super King', '275 x 300 cm', 18, 0, TRUE),
  ('e0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000006', 'VK-SAR-PAI-006-PUR', 'Royal Purple', 'Royal Purple', 'Standard 6.0m with Blouse', NULL, '6.0m', 6, 0, TRUE),
  ('e0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000007', 'VK-SAR-TUS-007-NAT', 'Natural Honey Beige', 'Natural Honey Beige', 'Standard 6.0m with Blouse', NULL, '6.0m', 9, 0, TRUE),
  ('e0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000008', 'VK-HOM-WAF-008-CRM', 'Natural Cream', 'Natural Unbleached Cream', 'Standard (150 x 200 cm)', NULL, '150 x 200 cm', 25, 0, TRUE)
ON CONFLICT (sku) DO NOTHING;

-- 6. HOMEPAGE SECTIONS SEED
INSERT INTO public.homepage_sections (id, section_type, title, subtitle, content, sort_order, is_active)
VALUES
  (
    'f0000000-0000-0000-0000-000000000001',
    'hero',
    'Timeless Indian Textiles for Modern Living.',
    'Authentic handwoven sarees, pure katan silks, and breathable organic cotton bedsheets—crafted with generational patience and pure materials.',
    '{"badge": "The Heritage Loom", "primary_cta": {"text": "Explore Sarees", "url": "/sarees"}, "secondary_cta": {"text": "Shop Bedsheets", "url": "/bedsheets"}}'::JSONB,
    1,
    TRUE
  ),
  (
    'f0000000-0000-0000-0000-000000000002',
    'categories',
    'Rooted in Craft, Woven for Every Space',
    'Explore our curated textile houses—from ceremonial silk drapes to breathable everyday bedding.',
    '{}'::JSONB,
    2,
    TRUE
  ),
  (
    'f0000000-0000-0000-0000-000000000003',
    'philosophy',
    'The Dignity of Generational Handloom Weaving.',
    'In an age of synthetic speed and mass printing, VK VASTRAM stands for the patient rhythm of the authentic wooden loom.',
    '{}'::JSONB,
    3,
    TRUE
  )
ON CONFLICT (id) DO NOTHING;

-- 7. SITE SETTINGS SEED
INSERT INTO public.site_settings (key, value, description)
VALUES
  (
    'general',
    '{
      "store_name": "VK VASTRAM",
      "tagline": "Classical Indian Textiles & Sarees",
      "support_email": "care@vkvastram.com",
      "support_phone": "+91 98234 56789",
      "whatsapp_number": "+91 98234 56789",
      "studio_address": "VK Vastram Design Pavilion, Jayanagar Heritage Enclave, Bengaluru, Karnataka 560041",
      "announcement_bar_text": "Complimentary Insured Delivery Across India on Orders Above ₹1,999",
      "free_shipping_threshold": 1999,
      "standard_shipping_fee": 150
    }'::JSONB,
    'General store and business contact settings'
  ),
  (
    'policies',
    '{
      "exchange_window_days": 7,
      "dispatch_window_hours": "24-48",
      "cod_max_limit": 15000,
      "currency": "INR",
      "currency_symbol": "₹"
    }'::JSONB,
    'Store operational policies'
  )
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW();
