import React, { useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  Database,
  Check,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Button } from '../ui/Button';

interface ParsedRow {
  rowNumber: number;
  sku: string;
  name: string;
  category: string;
  collection: string;
  price: number;
  gstRate?: number | null;
  mrp?: number;
  stockQuantity: number;
  fabric: string;
  weave: string;
  origin: string;
  dimensions: string;
  careInstructions: string;
  description: string;
  primaryImageUrl: string;
  status: 'active' | 'draft';
  /** Exactly what the sheet's status cell said ('' when blank); existing products only change status when this is set. */
  requestedStatus: '' | 'active' | 'draft';
  color: string;
  slug: string;
  sareeType: string;
  primaryColourHex: string;
  secondaryColourName: string;
  secondaryColourHex: string;
  additionalImageUrls: string;
  imageAltText: string;
  seoTitle: string;
  seoDescription: string;
  featured: boolean;
  bestSeller: boolean;
  newArrival: boolean;
  tags: string;
  isValid: boolean;
  /** Blocks the row (only: missing product name, duplicate SKU in the same file). */
  errors: string[];
  /** Row still imports; the listed fields were left empty / the product is saved as a draft. */
  warnings: string[];
}

interface ImportSummary {
  total: number;
  imported: number;
  updated: number;
  failed: number;
  errors: { row: number; sku?: string; error: string }[];
}

export const AdminImport: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'ready' | 'importing' | 'completed'>('idle');
  const [sheetName, setSheetName] = useState<string>('');
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Normalize column keys regardless of case and spacing
  const getField = (row: any, keys: string[]): any => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
        return row[key];
      }
      // Check case-insensitive match
      const matchingKey = Object.keys(row).find(
        (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === key.toLowerCase().replace(/[^a-z0-9]/g, '')
      );
      if (matchingKey && row[matchingKey] !== undefined && row[matchingKey] !== null) {
        return row[matchingKey];
      }
    }
    return undefined;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setGlobalError(null);
    setSummary(null);
    setStatus('parsing');

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      setAvailableSheets(workbook.SheetNames);

      // Locate sheet: prefer 'PRODUCT_IMPORT' (case-insensitive) or first sheet
      let targetSheetName = workbook.SheetNames.find(
        (name) => name.trim().toUpperCase() === 'PRODUCT_IMPORT'
      );

      if (!targetSheetName && workbook.SheetNames.length > 0) {
        targetSheetName = workbook.SheetNames[0];
      }

      if (!targetSheetName) {
        throw new Error('No worksheets found in uploaded Excel file.');
      }

      setSheetName(targetSheetName);
      const worksheet = workbook.Sheets[targetSheetName];
      const allRawRows: any[] = XLSX.utils.sheet_to_json(worksheet);
      const rawRows = allRawRows.filter((row: any) => !String(getField(row, ['Product Title', 'Name', 'Product Name', 'Title', 'Product']) || '').toLowerCase().includes('delete this row'));

      if (rawRows.length === 0) {
        throw new Error(`Sheet "${targetSheetName}" is empty.`);
      }

      // Parse and validate each row
      const parsed: ParsedRow[] = rawRows.map((raw, index) => {
        const rowNumber = index + 2; // header is row 1
        const errors: string[] = [];

        const name = String(getField(raw, ['Product Title', 'Name', 'Product Name', 'Title', 'Product']) || '').trim();
        if (!name) {
          errors.push('Product name is required');
        }

        const warnings: string[] = [];

        const rawPrice = getField(raw, ['Price', 'Selling Price', 'Price INR', 'Offer Price']);
        const parsedPrice = rawPrice === undefined || String(rawPrice).trim() === '' ? NaN : Number(String(rawPrice).replace(/[₹,\s]/g, ''));
        const hasPrice = Number.isFinite(parsedPrice) && parsedPrice > 0;
        const price = hasPrice ? parsedPrice : 0;
        if (!hasPrice) warnings.push('No valid price: price left at 0 and the product is saved as a draft.');

        const rawGstRate = getField(raw, ['GST Rate %', 'GST Rate (%)', 'GST Rate', 'Tax Rate', 'gst_rate']);
        let gstRate = rawGstRate === undefined || String(rawGstRate).trim() === '' ? null : Number(rawGstRate);
        if (gstRate !== null && (!Number.isFinite(gstRate) || ![0, 5, 12, 18].includes(gstRate))) { warnings.push('GST Rate must be 0, 5, 12 or 18: left empty so the default rate applies.'); gstRate = null; }

        const rawMrp = getField(raw, ['MRP', 'Maximum Retail Price', 'Original Price', 'List Price']);
        const parsedMrp = rawMrp !== undefined && String(rawMrp).trim() !== '' ? Number(String(rawMrp).replace(/[₹,\s]/g, '')) : NaN;
        let mrp: number | undefined = Number.isFinite(parsedMrp) && parsedMrp > 0 ? parsedMrp : undefined;
        if (mrp !== undefined && mrp < price) {
          warnings.push(`MRP (${mrp}) is lower than the price (${price}): MRP ignored.`);
          mrp = undefined;
        }

        const rawSku = String(getField(raw, ['Master SKU', 'SKU', 'Product SKU', 'Item Code', 'Code']) || '').trim();
        // Blank SKU stays blank: the server generates a unique one. (An index-based SKU such as
        // VKV-SAR-0001 could collide with an existing product and silently overwrite it.)
        const sku = rawSku;

        const category = String(getField(raw, ['Category', 'Category Name', 'Collection Type']) || '').trim();
        if (!category) warnings.push('No category: the product is saved to Sarees as a draft.');
        const collection = String(getField(raw, ['Collection', 'Collection Name']) || '').trim();

        const rawStock = getField(raw, ['Stock', 'Quantity', 'Stock Quantity', 'Inventory']);
        const parsedStock = rawStock !== undefined && String(rawStock).trim() !== '' ? Number(rawStock) : NaN;
        const stockQuantity = Number.isInteger(parsedStock) && parsedStock >= 0 ? parsedStock : 0;
        if (!Number.isInteger(parsedStock) || parsedStock < 0) {
          warnings.push('No valid stock quantity: stock set to 0.');
        }

        const fabric = String(getField(raw, ['Fabric', 'Material', 'Fabric Composition']) || '').trim();
        const weave = String(getField(raw, ['Weave / Technique', 'Weave / Style', 'Weave', 'Craft', 'Weave Type']) || '').trim();
        const origin = String(getField(raw, ['Weaving Origin', 'Origin', 'Region', 'City', 'Provenance']) || '').trim();
        const dimensions = String(getField(raw, ['Dimensions / Sizing', 'Dimensions', 'Length', 'Measurements', 'Size']) || '').trim();
        const careInstructions = String(getField(raw, ['Care Instructions', 'Care', 'Wash Care']) || '').trim();
        const description = String(getField(raw, ['Description', 'Short Description', 'Details']) || '').trim();
        const primaryImageUrl = String(getField(raw, ['Primary Image URL', 'Primary Image', 'Image URL', 'Image', 'Photo']) || '').trim();
        const color = String(getField(raw, ['Primary Colour Name', 'Primary Color Name', 'Color', 'Colours', 'Primary Color']) || '').trim();
        const slugRaw = String(getField(raw, ['URL Slug', 'Slug', 'Product Slug']) || '').trim();
        const slug = (slugRaw || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')).toLowerCase();
        const sareeType = String(getField(raw, ['Saree Type', 'SareeType', 'Type']) || '').trim();
        const primaryColourHex = String(getField(raw, ['Primary Colour Hex', 'Primary Color Hex', 'Primary Colour HEX', 'Primary Color HEX']) || '').trim().toUpperCase();
        const secondaryColourName = String(getField(raw, ['Secondary Colour Name', 'Secondary Color Name']) || '').trim();
        const secondaryColourHex = String(getField(raw, ['Secondary Colour Hex', 'Secondary Color Hex']) || '').trim().toUpperCase();
        const additionalImageUrls = String(getField(raw, ['Additional Image URLs', 'Additional Images', 'Additional Image URLs (comma-separated)']) || '').trim();
        const imageAltText = String(getField(raw, ['Image Alt Text', 'Alt Text']) || '').trim();
        const seoTitle = String(getField(raw, ['SEO Title']) || '').trim();
        const seoDescription = String(getField(raw, ['SEO Description', 'SEO Meta Description']) || '').trim();
        const boolValue = (value: any) => ['true', 'yes', '1', 'y'].includes(String(value ?? '').trim().toLowerCase());
        const featured = boolValue(getField(raw, ['Featured', 'Featured (TRUE/FALSE)']));
        const bestSeller = boolValue(getField(raw, ['Best Seller', 'Best Seller (TRUE/FALSE)', 'Bestseller']));
        const newArrival = boolValue(getField(raw, ['New Arrival', 'New Arrival (TRUE/FALSE)', 'New Arrivals']));
        const tags = String(getField(raw, ['Tags', 'Tags (comma-separated)']) || '').trim();
        // Optional fields: keep what is valid, leave the rest empty, never block the row.
        let primaryHexClean = primaryColourHex;
        if (primaryHexClean && !/^#[0-9A-F]{6}$/.test(primaryHexClean)) {
          warnings.push(`Primary Colour Hex "${primaryHexClean}" is not #RRGGBB: left empty.`);
          primaryHexClean = '';
        }
        let secondaryHexClean = secondaryColourHex;
        if (secondaryHexClean && !/^#[0-9A-F]{6}$/.test(secondaryHexClean)) {
          warnings.push(`Secondary Colour Hex "${secondaryHexClean}" is not #RRGGBB: left empty.`);
          secondaryHexClean = '';
        }
        let secondaryNameClean = secondaryColourName;
        if (secondaryNameClean && !secondaryHexClean) {
          warnings.push('Secondary colour has no valid HEX code: secondary colour skipped.');
          secondaryNameClean = '';
        }

        // Images that can never work for customers (localhost / blob / embedded) are dropped.
        const imageProblem = (url: string) =>
          /^blob:/i.test(url) || /^data:/i.test(url) || /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?)(:|\/|$)/i.test(url);
        let primaryImageClean = primaryImageUrl;
        if (primaryImageClean && imageProblem(primaryImageClean)) {
          warnings.push('Primary Image URL points to your computer (localhost/blob): image skipped. Upload it in the product form.');
          primaryImageClean = '';
        }
        const additionalImagesClean = additionalImageUrls.split(',').map((url) => url.trim()).filter((url) => url && !imageProblem(url));
        if (!primaryImageClean) warnings.push('No image: the product is saved as a draft. Add photos in the product form, then publish.');
        if (!color && !primaryHexClean) warnings.push('No colour entered: colour left empty.');
        if (category.toLowerCase().includes('saree') && !sareeType) warnings.push('No Saree Type: it will not appear under a saree-type filter or menu item until you set it.');
        if (category.toLowerCase().includes('saree') && !fabric) warnings.push('No Fabric: left empty.');

        const rawStatus = String(getField(raw, ['Catalog Status', 'Status', 'Product Status']) || '').toLowerCase().trim();
        // Incomplete products never go live automatically: without a price, an image or a
        // category they are saved as drafts so the admin can finish them in the product form.
        const isIncomplete = !hasPrice || !primaryImageClean || !category;
        const status: 'active' | 'draft' = rawStatus === 'draft' || isIncomplete ? 'draft' : 'active';

        return {
          rowNumber,
          sku,
          name,
          category,
          collection,
          price: isNaN(price) ? 0 : price,
          gstRate,
          mrp,
          stockQuantity,
          fabric,
          weave,
          origin,
          dimensions,
          careInstructions,
          description,
          primaryImageUrl: primaryImageClean,
          status,
          requestedStatus: rawStatus === 'active' || rawStatus === 'draft' ? rawStatus : '',
          color,
          slug,
          sareeType,
          primaryColourHex: primaryHexClean,
          secondaryColourName: secondaryNameClean,
          secondaryColourHex: secondaryHexClean,
          additionalImageUrls: additionalImagesClean.join(','),
          imageAltText,
          seoTitle,
          seoDescription,
          featured,
          bestSeller,
          newArrival,
          tags,
          isValid: errors.length === 0,
          errors,
          warnings,
        };
      });

      // Validate duplicates against the uploaded workbook and existing catalogue, and
      // reject unknown managed taxonomy values instead of silently creating new ones.
      const seenSkus = new Set<string>();
      const seenSlugs = new Set<string>();
      const knownSlugs = new Set<string>();
      const existingSlugBySku = new Map<string, string>();
      let knownTypes: Set<string> | null = null;
      let knownFabrics: Set<string> | null = null;
      let knownCategories: Set<string> | null = null;
      let knownCollections: Set<string> | null = null;
      if (isSupabaseConfigured()) {
        const [{ data: existingProducts }, { data: typeSetting }, { data: fabricSetting }, { data: categoryRows }, { data: collectionRows }] = await Promise.all([
          (supabase as any).from('products').select('sku, slug'),
          (supabase as any).from('site_settings').select('value').eq('key', 'saree_types').maybeSingle(),
          (supabase as any).from('site_settings').select('value').eq('key', 'fabric_types').maybeSingle(),
          (supabase as any).from('categories').select('name, slug'),
          (supabase as any).from('collections').select('name, slug'),
        ]);
        (existingProducts || []).forEach((product: any) => { if (product.sku && product.slug) existingSlugBySku.set(String(product.sku).toLowerCase(), String(product.slug).toLowerCase()); if (product.slug) knownSlugs.add(String(product.slug).toLowerCase()); });
        const extractNames = (value: any): Set<string> | null => {
          if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = null; } }
          return Array.isArray(value?.types) ? new Set<string>(value.types.filter((x: any) => x && x.active !== false && x.name).map((x: any) => String(x.name).trim().toLowerCase())) : null;
        };
        knownTypes = extractNames(typeSetting?.value);
        knownFabrics = extractNames(fabricSetting?.value);
        const toSet = (rows: any[] | null) => rows && rows.length
          ? new Set<string>(rows.flatMap((r: any) => [r.name, r.slug]).filter(Boolean).map((v: string) => String(v).trim().toLowerCase()))
          : null;
        knownCategories = toSet(categoryRows);
        knownCollections = toSet(collectionRows);
      }
      const validated = parsed.map((row) => {
        const errors = [...row.errors];
        const warnings = [...row.warnings];
        let status = row.status;

        // Only a repeated SKU inside the same file blocks a row (the second one would overwrite the first).
        const skuKey = row.sku.toLowerCase();
        if (row.sku) {
          if (seenSkus.has(skuKey)) errors.push(`Duplicate SKU in this workbook: ${row.sku}`);
          seenSkus.add(skuKey);
        }

        // Slugs are made unique automatically (two "Pink Mulmul Saree" rows are fine).
        let slug = row.slug;
        if (slug) {
          const existingSlugForSku = row.sku ? existingSlugBySku.get(skuKey) : undefined;
          const taken = (candidate: string) => seenSlugs.has(candidate) || (knownSlugs.has(candidate) && existingSlugForSku !== candidate);
          if (taken(slug)) {
            let n = 2;
            while (taken(`${slug}-${n}`)) n += 1;
            warnings.push(`URL slug "${slug}" is already used: using "${slug}-${n}".`);
            slug = `${slug}-${n}`;
          }
          seenSlugs.add(slug);
        }

        // Values that do not match the managed lists are kept as typed (nothing is lost) but flagged.
        if (row.category && knownCategories && !knownCategories.has(row.category.toLowerCase())) {
          warnings.push(`Category "${row.category}" was not found: the product is saved to Sarees as a draft.`);
          status = 'draft';
        }
        if (row.collection && knownCollections && !knownCollections.has(row.collection.toLowerCase())) {
          warnings.push(`Collection "${row.collection}" was not found: collection left empty.`);
        }
        if (row.category.toLowerCase().includes('saree') && row.sareeType && knownTypes && !knownTypes.has(row.sareeType.toLowerCase())) {
          warnings.push(`Saree Type "${row.sareeType}" is not in Saree Types: kept as typed, but add it in Admin > Saree Types so it appears in the menu and filters.`);
        }
        if (row.fabric && knownFabrics && !knownFabrics.has(row.fabric.toLowerCase())) {
          warnings.push(`Fabric "${row.fabric}" is not in the Fabrics list: kept as typed, but add it in Admin > Saree Types (Fabrics) so it appears in the filter.`);
        }
        return { ...row, slug, status, errors, warnings, isValid: errors.length === 0 };
      });
      setParsedRows(validated);
      setStatus('ready');
    } catch (err: any) {
      console.error('Excel parse error:', err);
      setGlobalError(err.message || 'Failed to read Excel workbook.');
      setStatus('idle');
    }
  };

  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((row) => row.isValid);
    if (validRows.length === 0) {
      setGlobalError('No importable rows: every row is missing a product name or repeats a SKU already used in this file.');
      return;
    }

    setStatus('importing');
    setGlobalError(null);

    // Prepare payload
    const payload = validRows.map((r) => ({
      sku: r.sku,
      name: r.name,
      slug: r.slug,
      category: r.category,
      collection: r.collection,
      price: r.price,
      gstRate: r.gstRate,
      mrp: r.mrp,
      stockQuantity: r.stockQuantity,
      fabric: r.fabric,
      weave: r.weave,
      origin: r.origin,
      dimensions: r.dimensions,
      careInstructions: r.careInstructions,
      description: r.description,
      primaryImageUrl: r.primaryImageUrl,
      status: r.status,
      requestedStatus: r.requestedStatus,
      color: r.color,
      sareeType: r.sareeType,
      primaryColourHex: r.primaryColourHex,
      secondaryColourName: r.secondaryColourName,
      secondaryColourHex: r.secondaryColourHex,
      additionalImageUrls: r.additionalImageUrls.split(',').map((url) => url.trim()).filter(Boolean),
      imageAltText: r.imageAltText,
      seoTitle: r.seoTitle,
      seoDescription: r.seoDescription,
      featured: r.featured,
      bestSeller: r.bestSeller,
      newArrival: r.newArrival,
      tags: r.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    }));

    try {
      // 1. Attempt secure server-side bulk import endpoint
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token || '';

      const res = await fetch('/api/admin/products/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ products: payload }),
      });

      const responseData = await res.json().catch(() => ({}));
      if (!res.ok || !responseData.success) {
        throw new Error(responseData?.error || responseData?.message || `Secure import failed (HTTP ${res.status}). No products were imported. Check admin authorization and server logs, then retry.`);
      }
      setSummary({
        total: responseData.total || payload.length,
        imported: responseData.imported || 0,
        updated: responseData.updated || 0,
        failed: responseData.failed || 0,
        errors: responseData.errors || [],
      });
      setStatus('completed');
      return;
    } catch (err: any) {
      console.error('Import execution error:', err);
      setGlobalError(err.message || 'Execution error during product import.');
      setStatus('ready');
    }
  };

  const downloadSampleTemplate = async () => {
    const headers = [
      'Product Title', 'Master SKU', 'URL Slug', 'Category', 'Collection', 'Saree Type', 'Fabric', 'Weave / Technique',
      'Weaving Origin', 'Dimensions / Sizing', 'Care Instructions', 'Description', 'Selling Price', 'MRP', 'GST Rate %',
      'Stock Quantity', 'Primary Colour Name', 'Primary Colour Hex', 'Secondary Colour Name', 'Secondary Colour Hex',
      'Primary Image URL', 'Additional Image URLs', 'Image Alt Text', 'Catalog Status', 'Featured', 'Best Seller', 'New Arrival',
      'SEO Title', 'SEO Description', 'Tags',
    ];
    let categoryNames = ['Sarees', 'Bedsheets', 'Home Textiles'];
    let collectionNames = ['Heritage Sarees', 'Artisanal Bedsheets', 'Seasonal Archive'];
    let sareeTypes = ['Chanderi', 'Malmal Cotton', 'Tissue Silk', 'Linen Cotton', 'Banarasi', 'Kanjivaram', 'Paithani'];
    let fabrics = ['Malmal Cotton', 'Tissue Silk', 'Linen Cotton', 'Pure Silk', 'Katan Silk', 'Silk Cotton Blend', 'Cotton'];
    try {
      if (isSupabaseConfigured()) {
        const [cats, cols, typesSetting, fabricsSetting] = await Promise.all([
          (supabase as any).from('categories').select('name').eq('is_active', true).order('sort_order'),
          (supabase as any).from('collections').select('name').eq('is_active', true).order('sort_order'),
          (supabase as any).from('site_settings').select('value').eq('key', 'saree_types').maybeSingle(),
          (supabase as any).from('site_settings').select('value').eq('key', 'fabric_types').maybeSingle(),
        ]);
        if (cats.data?.length) categoryNames = cats.data.map((x: any) => x.name);
        if (cols.data?.length) collectionNames = cols.data.map((x: any) => x.name);
        if (Array.isArray(typesSetting.data?.value?.types)) sareeTypes = typesSetting.data.value.types.filter((x: any) => x.active !== false).map((x: any) => x.name);
        if (Array.isArray(fabricsSetting.data?.value?.types)) fabrics = fabricsSetting.data.value.types.filter((x: any) => x.active !== false).map((x: any) => x.name);
      }
    } catch (error) { console.warn('Could not load live import dropdown values; using safe examples.', error); }

    const example = {
      'Product Title': 'Sample Saree - delete this row', 'Master SKU': '', 'URL Slug': '', Category: categoryNames[0] || 'Sarees',
      Collection: collectionNames[0] || '', 'Saree Type': sareeTypes[0] || '', Fabric: fabrics[0] || '', 'Weave / Technique': '',
      'Weaving Origin': '', 'Dimensions / Sizing': '', 'Care Instructions': '', Description: '', 'Selling Price': 1, MRP: 1,
      'GST Rate %': 5, 'Stock Quantity': 0, 'Primary Colour Name': 'Sample Colour', 'Primary Colour Hex': '#78281F',
      'Secondary Colour Name': '', 'Secondary Colour Hex': '', 'Primary Image URL': 'https://example.com/replace-with-real-image.jpg',
      'Additional Image URLs': '', 'Image Alt Text': 'Sample image - replace before import', 'Catalog Status': 'draft', Featured: false,
      'Best Seller': false, 'New Arrival': false, 'SEO Title': '', 'SEO Description': '', Tags: '',
    } as Record<string, any>;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([example], { header: headers });
    ws['!cols'] = headers.map((h) => ({ wch: Math.min(Math.max(h.length + 3, 16), 38) }));
    // SheetJS Community Edition writes values and formula lists reliably; dropdowns are also
    // documented in LISTS for spreadsheet editors that do not preserve imported validations.
    XLSX.utils.book_append_sheet(wb, ws, 'PRODUCTS');
    const instructions = headers.map((header) => ({ Column: header, Instructions: ({
      'Product Title': 'The only required column. Product display name.', 'Master SKU': 'Optional; blank SKU is generated automatically.', 'URL Slug': 'Optional; generated from title if blank and must be unique.',
      Category: 'Optional. Choose a value from LISTS. Blank or unknown: saved to Sarees as a draft.', Collection: 'Optional. Choose a value from LISTS.', 'Saree Type': 'Optional. Choose a type from LISTS so the product appears in the menu and filters.',
      Fabric: 'Optional. Choose a fabric from LISTS so it appears in the Fabric filter.', 'Weave / Technique': 'Optional descriptive text; not used as a filter.', 'Selling Price': 'Optional GST-inclusive amount. Without it the product is saved as a draft with price 0.',
      MRP: 'Optional. Ignored if lower than the Selling Price.', 'GST Rate %': 'Use 0, 5, 12 or 18 as confirmed by your accountant.', 'Stock Quantity': 'Optional whole number. Blank = 0.',
      'Primary Colour Name': 'Optional. Customer-facing primary colour, e.g. Pearl Beige.', 'Primary Colour Hex': 'Optional #RRGGBB code. An invalid code is left empty.', 'Secondary Colour Name': 'Optional.',
      'Secondary Colour Hex': 'Optional #RRGGBB code; the secondary colour is used only when it has a valid code.', 'Primary Image URL': 'Optional. Without an image the product is saved as a draft (add photos later in the product form).', 'Additional Image URLs': 'Optional comma-separated URLs.',
      'Catalog Status': 'Optional: active or draft. Products missing a price, image or category are always saved as drafts.', Featured: 'TRUE/FALSE; controls Curated Heritage section.', 'Best Seller': 'TRUE/FALSE.', 'New Arrival': 'TRUE/FALSE.',
      Tags: 'Optional comma-separated tags.',
    } as Record<string, string>)[header] || 'Optional.' }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(instructions), 'INSTRUCTIONS');
    const lists = XLSX.utils.aoa_to_sheet([
      ['Category', 'Collection', 'Saree Type', 'Fabric', 'Catalog Status', 'GST Rate %', 'Boolean'],
      ...Array.from({ length: Math.max(categoryNames.length, collectionNames.length, sareeTypes.length, fabrics.length, 2, 4) }, (_, i) => [
        categoryNames[i] || '', collectionNames[i] || '', sareeTypes[i] || '', fabrics[i] || '',
        ['active', 'draft'][i] || '', [0, 5, 12, 18][i] ?? '', ['TRUE', 'FALSE'][i] || '',
      ]),
    ]);
    XLSX.utils.book_append_sheet(wb, lists, 'LISTS');
    // Named ranges are Excel-compatible references for list validation.
    (wb as any).Workbook = (wb as any).Workbook || {};
    (wb.Workbook as any).Names = [
      { Name: 'CategoryOptions', Ref: `LISTS!$A$2:$A$${categoryNames.length + 1}` },
      { Name: 'CollectionOptions', Ref: `LISTS!$B$2:$B$${collectionNames.length + 1}` },
      { Name: 'SareeTypeOptions', Ref: `LISTS!$C$2:$C$${sareeTypes.length + 1}` },
      { Name: 'FabricOptions', Ref: `LISTS!$D$2:$D$${fabrics.length + 1}` },
      { Name: 'StatusOptions', Ref: 'LISTS!$E$2:$E$3' },
      { Name: 'GstOptions', Ref: 'LISTS!$F$2:$F$5' },
      { Name: 'BooleanOptions', Ref: 'LISTS!$G$2:$G$3' },
    ];
    (ws as any)['!dataValidation'] = [
      { sqref: 'D2:D500', type: 'list', formula1: '=CategoryOptions' },
      { sqref: 'E2:E500', type: 'list', formula1: '=CollectionOptions' },
      { sqref: 'F2:F500', type: 'list', formula1: '=SareeTypeOptions' },
      { sqref: 'G2:G500', type: 'list', formula1: '=FabricOptions' },
      { sqref: 'X2:X500', type: 'list', formula1: '=StatusOptions' },
      { sqref: 'O2:O500', type: 'list', formula1: '=GstOptions' },
      { sqref: 'Y2:AA500', type: 'list', formula1: '=BooleanOptions' },
    ];
    XLSX.writeFile(wb, 'VK_VASTRAM_PRODUCT_IMPORT_TEMPLATE.xlsx');
  };

  // importable = will be sent (no blocking error); clean = importable without any warning.
  const importableCount = parsedRows.filter((r) => r.isValid).length;
  const warningCount = parsedRows.filter((r) => r.isValid && r.warnings.length > 0).length;
  const draftCount = parsedRows.filter((r) => r.isValid && r.status === 'draft').length;
  const errorCount = parsedRows.filter((r) => !r.isValid).length;
  const validCount = importableCount;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1C1917]/10">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#1C1917] font-normal">
            Product Catalog Excel Import
          </h1>
          <p className="text-xs text-[#57534E] mt-1">
            Batch import genuine saree products from Excel (.xlsx/.xls/.csv) into Supabase PostgreSQL catalog.
          </p>
        </div>

        <button
          type="button"
          onClick={downloadSampleTemplate}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#F4EFE6] border border-[#1C1917]/15 rounded-xs text-xs font-medium text-[#1C1917] hover:bg-[#EFE9DC] transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-[#967029]" />
          <span>Download Excel Template (.xlsx)</span>
        </button>
      </div>

      {/* Global Error Banner */}
      {globalError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xs flex items-start gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <div className="space-y-1">
            <p className="font-medium">Import Notice</p>
            <p>{globalError}</p>
          </div>
        </div>
      )}

      {/* Step 1: Upload Card */}
      <div className="bg-[#FAF8F5] p-6 rounded-xs border border-[#1C1917]/10 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-sm font-medium text-[#1C1917] flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#1C1917] text-[#FAF8F5] text-[10px] flex items-center justify-center">
              1
            </span>
            <span>Upload Spreadsheet</span>
          </h2>
          {file && (
            <span className="text-[11px] font-mono text-[#78716C]">
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </span>
          )}
        </div>

        <div className="border-2 border-dashed border-[#1C1917]/20 rounded-xs p-8 text-center hover:bg-[#F4EFE6]/50 transition-colors">
          <FileSpreadsheet className="w-10 h-10 text-[#967029] mx-auto mb-3" />
          <p className="text-xs font-medium text-[#1C1917]">
            Select or drag your product catalog spreadsheet
          </p>
          <p className="text-[11px] text-[#78716C] mt-1 max-w-md mx-auto">
            Supports sheet named <strong>PRODUCT_IMPORT</strong>. Automatically preserves SKU, pricing, dimensions, fabrics, stock inventory, and primary images.
          </p>

          <label className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-[#1C1917] hover:bg-[#2E2926] text-[#FAF8F5] text-xs font-medium rounded-xs cursor-pointer transition-colors shadow-2xs">
            <Upload className="w-3.5 h-3.5" />
            <span>{file ? 'Choose Different File' : 'Browse Excel File (.xlsx)'}</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Step 2: Parsing & Validation Preview */}
      {status === 'ready' && parsedRows.length > 0 && (
        <div className="bg-[#FAF8F5] p-6 rounded-xs border border-[#1C1917]/10 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1C1917]/10 pb-4">
            <div>
              <h2 className="font-serif text-sm font-medium text-[#1C1917] flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#1C1917] text-[#FAF8F5] text-[10px] flex items-center justify-center">
                  2
                </span>
                <span>Pre-Import Validation & Preview</span>
              </h2>
              <p className="text-[11px] text-[#78716C] mt-0.5">
                Sheet: <strong className="font-mono text-[#1C1917]">{sheetName}</strong> · Found {parsedRows.length} product rows
              </p>
            </div>

            {/* Validation Badges */}
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] rounded-xs font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                {importableCount} Rows will import
              </span>
              {warningCount > 0 && (
                <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] rounded-xs font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  {warningCount} with empty fields{draftCount > 0 ? ` (${draftCount} as draft)` : ''}
                </span>
              )}
              {errorCount > 0 && (
                <span className="px-2.5 py-1 bg-red-50 border border-red-200 text-red-800 text-[11px] rounded-xs font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3 text-red-600" />
                  {errorCount} skipped
                </span>
              )}
            </div>
          </div>

          {/* Preview Table */}
          <div className="overflow-x-auto border border-[#1C1917]/10 rounded-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4EFE6] text-[#57534E] uppercase text-[10px] tracking-wider border-b border-[#1C1917]/10">
                <tr>
                  <th className="p-2.5">Row</th>
                  <th className="p-2.5">SKU</th>
                  <th className="p-2.5">Product Name</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5">Price / MRP</th>
                  <th className="p-2.5">Stock</th>
                  <th className="p-2.5">Fabric / Weave</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C1917]/5">
                {parsedRows.slice(0, 8).map((row) => (
                  <tr key={row.rowNumber} className="hover:bg-white/50 transition-colors">
                    <td className="p-2.5 font-mono text-[11px] text-[#78716C]">{row.rowNumber}</td>
                    <td className="p-2.5 font-mono font-medium text-[#1C1917]">{row.sku || <span className="text-[#A8A29E] font-normal">(auto)</span>}</td>
                    <td className="p-2.5">
                      <span className="font-medium text-[#1C1917] block">{row.name}</span>
                      {row.primaryImageUrl && (
                        <span className="text-[10px] text-emerald-700 truncate block max-w-xs">
                          📷 Image Linked
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-[#57534E]">{row.category || '—'}</td>
                    <td className="p-2.5 font-mono">
                      ₹{row.price.toLocaleString('en-IN')}
                      {row.mrp && (
                        <span className="text-[10px] text-[#A8A29E] block line-through">
                          ₹{row.mrp.toLocaleString('en-IN')}
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 font-mono">{row.stockQuantity} units</td>
                    <td className="p-2.5 text-[#57534E] text-[11px]">
                      {row.fabric || '—'} {row.weave ? `· ${row.weave}` : ''}
                    </td>
                    <td className="p-2.5">
                      {!row.isValid ? (
                        <span
                          title={row.errors.join('; ')}
                          className="inline-flex items-center gap-1 text-[10px] text-red-700 bg-red-50 px-1.5 py-0.5 rounded-xs cursor-help"
                        >
                          <AlertCircle className="w-2.5 h-2.5" /> Skipped
                        </span>
                      ) : row.warnings.length > 0 ? (
                        <span
                          title={row.warnings.join('\n')}
                          className="inline-flex items-center gap-1 text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-xs cursor-help"
                        >
                          <AlertTriangle className="w-2.5 h-2.5" /> {row.status === 'draft' ? 'Draft' : 'Imports'} · {row.warnings.length} note{row.warnings.length > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-xs">
                          <Check className="w-2.5 h-2.5" /> Ready
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {parsedRows.length > 8 && (
            <p className="text-[11px] text-[#78716C] text-center">
              Showing first 8 of {parsedRows.length} rows. Hover a status badge to see what was left empty. Only rows without a product name (or with a repeated SKU) are skipped.
            </p>
          )}

          {/* Action Trigger */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-[#57534E]">
              Ready to import {importableCount} products{draftCount > 0 ? ` (${draftCount} saved as drafts until price, image and category are complete)` : ''}. {errorCount > 0 ? `${errorCount} rows will be skipped.` : ''}
            </span>
            <Button
              onClick={handleExecuteImport}
              className="bg-[#78281F] hover:bg-[#5E1E17] text-white px-5 py-2 text-xs flex items-center gap-2 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Execute Catalog Import</span>
            </Button>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {status === 'importing' && (
        <div className="p-8 bg-[#FAF8F5] border border-[#1C1917]/10 rounded-xs text-center space-y-3">
          <RefreshCw className="w-7 h-7 text-[#967029] animate-spin mx-auto" />
          <h3 className="font-serif text-sm font-medium text-[#1C1917]">
            Synchronizing Product Rows with Database...
          </h3>
          <p className="text-xs text-[#78716C] max-w-sm mx-auto">
            Inserting products, mapping categories, syncing inventory variants, and updating primary images.
          </p>
        </div>
      )}

      {/* Step 3: Completion & Results Summary */}
      {status === 'completed' && summary && (
        <div className="bg-[#FAF8F5] p-6 rounded-xs border border-[#1C1917]/10 shadow-2xs space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-serif text-base font-medium text-[#1C1917]">
                Import Execution Completed
              </h2>
              <p className="text-xs text-[#57534E]">
                Processed {summary.total} rows from {file?.name || 'Excel worksheet'}.
              </p>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-[#F4EFE6] border border-[#1C1917]/10 rounded-xs text-center">
              <span className="text-[10px] text-[#78716C] uppercase font-semibold block">Total</span>
              <span className="font-mono text-xl font-semibold text-[#1C1917]">{summary.total}</span>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xs text-center">
              <span className="text-[10px] text-emerald-800 uppercase font-semibold block">New Created</span>
              <span className="font-mono text-xl font-semibold text-emerald-700">+{summary.imported}</span>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xs text-center">
              <span className="text-[10px] text-blue-800 uppercase font-semibold block">Updated</span>
              <span className="font-mono text-xl font-semibold text-blue-700">{summary.updated}</span>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded-xs text-center">
              <span className="text-[10px] text-red-800 uppercase font-semibold block">Failed</span>
              <span className="font-mono text-xl font-semibold text-red-700">{summary.failed}</span>
            </div>
          </div>

          {/* Row-by-Row Errors (if any) */}
          {summary.errors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[#1C1917] flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                <span>Issues by Row ({summary.errors.length})</span>
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-3 bg-red-50/50 border border-red-200 rounded-xs text-xs font-mono">
                {summary.errors.map((err, idx) => (
                  <div key={idx} className="text-red-800 flex items-start gap-2">
                    <span className="text-red-500 shrink-0 font-semibold">Row {err.row}:</span>
                    <span>
                      {err.sku ? `[${err.sku}] ` : ''}
                      {err.error}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={() => {
                setFile(null);
                setParsedRows([]);
                setSummary(null);
                setStatus('idle');
              }}
              variant="outline"
              className="text-xs"
            >
              Import Another File
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
