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
  errors: string[];
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

        const rawPrice = getField(raw, ['Price', 'Selling Price', 'Price INR', 'Offer Price']);
        const price = Number(rawPrice);
        if (rawPrice === undefined || isNaN(price) || price <= 0) {
          errors.push('Valid positive price is required');
        }

        const rawGstRate = getField(raw, ['GST Rate %', 'GST Rate (%)', 'GST Rate', 'Tax Rate', 'gst_rate']);
        const gstRate = rawGstRate === undefined || String(rawGstRate).trim() === '' ? null : Number(rawGstRate);
        if (gstRate !== null && (!Number.isFinite(gstRate) || ![0, 5, 12, 18].includes(gstRate))) errors.push('GST Rate must be one of 0, 5, 12 or 18. Confirm the applicable rate with your accountant.');

        const rawMrp = getField(raw, ['MRP', 'Maximum Retail Price', 'Original Price', 'List Price']);
        const mrp = rawMrp !== undefined && !isNaN(Number(rawMrp)) ? Number(rawMrp) : undefined;
        if (mrp !== undefined && mrp < price) {
          errors.push(`MRP (${mrp}) cannot be lower than price (${price})`);
        }

        const rawSku = String(getField(raw, ['SKU', 'Product SKU', 'Item Code', 'Code']) || '').trim();
        const sku = rawSku || `VKV-SAR-${(index + 1).toString().padStart(4, '0')}`;

        const category = String(getField(raw, ['Category', 'Category Name', 'Collection Type']) || '').trim();
        if (!category) errors.push('Category is required. Choose a value from the LISTS sheet.');
        const collection = String(getField(raw, ['Collection', 'Collection Name']) || '').trim();

        const rawStock = getField(raw, ['Stock', 'Quantity', 'Stock Quantity', 'Inventory']);
        const parsedStock = rawStock !== undefined && String(rawStock).trim() !== '' ? Number(rawStock) : NaN;
        const stockQuantity = Number.isInteger(parsedStock) && parsedStock >= 0 ? parsedStock : 0;
        if (!Number.isInteger(parsedStock) || parsedStock < 0) {
          errors.push('Valid non-negative Stock is required; stock will not default silently to 5');
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
        if (!color) errors.push('Primary Colour Name is required.');
        if (!primaryColourHex) errors.push('Primary Colour Hex is required.');
        if (primaryColourHex && !/^#[0-9A-F]{6}$/.test(primaryColourHex)) errors.push('Primary Colour Hex must use #RRGGBB format.');
        if (secondaryColourHex && !/^#[0-9A-F]{6}$/.test(secondaryColourHex)) errors.push('Secondary Colour Hex must use #RRGGBB format.');
        if (secondaryColourName && !secondaryColourHex) errors.push('Secondary Colour Hex is required when Secondary Colour Name is provided.');
        if (!primaryImageUrl) errors.push('Primary Image URL is required.');
        if (category.toLowerCase().includes('saree') && !sareeType) errors.push('Saree Type is required for saree products.');
        if (category.toLowerCase().includes('saree') && !fabric) errors.push('Fabric is required for saree products.');
        if (mrp !== undefined && mrp < price) errors.push(`MRP (${mrp}) cannot be lower than price (${price}).`);

        const rawStatus = String(getField(raw, ['Catalog Status', 'Status', 'Product Status']) || '').toLowerCase().trim();
        if (!['active', 'draft'].includes(rawStatus)) errors.push('Catalog Status must be active or draft.');
        const status: 'active' | 'draft' = rawStatus === 'draft' ? 'draft' : 'active';

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
          primaryImageUrl,
          status,
          color,
          slug,
          sareeType,
          primaryColourHex,
          secondaryColourName,
          secondaryColourHex,
          additionalImageUrls,
          imageAltText,
          seoTitle,
          seoDescription,
          featured,
          bestSeller,
          newArrival,
          tags,
          isValid: errors.length === 0,
          errors,
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
      if (isSupabaseConfigured()) {
        const [{ data: existingProducts }, { data: typeSetting }, { data: fabricSetting }] = await Promise.all([
          (supabase as any).from('products').select('sku, slug'),
          (supabase as any).from('site_settings').select('value').eq('key', 'saree_types').maybeSingle(),
          (supabase as any).from('site_settings').select('value').eq('key', 'fabric_types').maybeSingle(),
        ]);
        (existingProducts || []).forEach((product: any) => { if (product.sku && product.slug) existingSlugBySku.set(String(product.sku).toLowerCase(), String(product.slug).toLowerCase()); if (product.slug) knownSlugs.add(String(product.slug).toLowerCase()); });
        const extractNames = (value: any): Set<string> | null => {
          if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = null; } }
          return Array.isArray(value?.types) ? new Set<string>(value.types.filter((x: any) => x && x.active !== false && x.name).map((x: any) => String(x.name).trim().toLowerCase())) : null;
        };
        knownTypes = extractNames(typeSetting?.value);
        knownFabrics = extractNames(fabricSetting?.value);
      }
      const validated = parsed.map((row) => {
        const errors = [...row.errors];
        const skuKey = row.sku.toLowerCase(); const slugKey = row.slug.toLowerCase();
        if (seenSkus.has(skuKey)) errors.push(`Duplicate SKU in this workbook: ${row.sku}`);
        const existingSlugForSku = existingSlugBySku.get(skuKey);
        if (seenSlugs.has(slugKey) || (knownSlugs.has(slugKey) && existingSlugForSku !== slugKey)) errors.push(`Duplicate URL slug: ${row.slug}`);
        seenSkus.add(skuKey); seenSlugs.add(slugKey);
        if (row.category.toLowerCase().includes('saree') && row.sareeType && knownTypes && !knownTypes.has(row.sareeType.toLowerCase())) errors.push(`Unknown Saree Type: ${row.sareeType}. Add it in Admin > Saree Attributes first.`);
        if (row.fabric && knownFabrics && !knownFabrics.has(row.fabric.toLowerCase())) errors.push(`Unknown Fabric: ${row.fabric}. Add it in Admin > Saree Attributes first.`);
        return { ...row, errors, isValid: errors.length === 0 };
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
      setGlobalError('There are no valid rows to import. Fix the row errors and try again.');
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
      'Product Title': 'Required. Unique product display name.', 'Master SKU': 'Optional; blank SKU is generated automatically.', 'URL Slug': 'Optional; generated from title if blank and must be unique.',
      Category: 'Required. Choose a value from LISTS.', Collection: 'Optional. Choose a value from LISTS.', 'Saree Type': 'Required for sarees; choose a managed type.',
      Fabric: 'Required for sarees; choose a managed fabric.', 'Weave / Technique': 'Optional descriptive text; not used as a filter.', 'Selling Price': 'Required GST-inclusive amount greater than zero.',
      MRP: 'Optional; must be greater than or equal to Selling Price.', 'GST Rate %': 'Use 0, 5, 12 or 18 as confirmed by your accountant.', 'Stock Quantity': 'Required whole number, zero or greater.',
      'Primary Colour Name': 'Required. Enter the customer-facing primary colour.', 'Primary Colour Hex': 'Required hex colour in #RRGGBB format.', 'Secondary Colour Name': 'Optional.',
      'Secondary Colour Hex': 'Required only when a secondary colour name is entered.', 'Primary Image URL': 'Required for a product intended to be displayed.', 'Additional Image URLs': 'Optional comma-separated URLs.',
      'Catalog Status': 'Choose active or draft.', Featured: 'TRUE/FALSE; controls Curated Heritage section.', 'Best Seller': 'TRUE/FALSE.', 'New Arrival': 'TRUE/FALSE.',
      Tags: 'Optional comma-separated tags.',
    } as Record<string, string>)[header] || 'Optional unless marked required.' }));
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

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const errorCount = parsedRows.filter((r) => !r.isValid).length;

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
                {validCount} Valid Rows
              </span>
              {errorCount > 0 && (
                <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] rounded-xs font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  {errorCount} Rows with Warnings
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
                    <td className="p-2.5 font-mono font-medium text-[#1C1917]">{row.sku}</td>
                    <td className="p-2.5">
                      <span className="font-medium text-[#1C1917] block">{row.name}</span>
                      {row.primaryImageUrl && (
                        <span className="text-[10px] text-emerald-700 truncate block max-w-xs">
                          📷 Image Linked
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-[#57534E]">{row.category}</td>
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
                      {row.isValid ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-xs">
                          <Check className="w-2.5 h-2.5" /> Valid
                        </span>
                      ) : (
                        <span
                          title={row.errors.join('; ')}
                          className="inline-flex items-center gap-1 text-[10px] text-red-700 bg-red-50 px-1.5 py-0.5 rounded-xs cursor-help"
                        >
                          <AlertCircle className="w-2.5 h-2.5" /> Error
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
              Showing first 8 of {parsedRows.length} rows. Only valid rows will be sent; invalid rows are skipped.
            </p>
          )}

          {/* Action Trigger */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-[#57534E]">
              Ready to synchronize {validCount} valid records to Supabase. {errorCount > 0 ? `${errorCount} invalid rows will be skipped.` : ''}
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
