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
      const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (rawRows.length === 0) {
        throw new Error(`Sheet "${targetSheetName}" is empty.`);
      }

      // Parse and validate each row
      const parsed: ParsedRow[] = rawRows.map((raw, index) => {
        const rowNumber = index + 2; // header is row 1
        const errors: string[] = [];

        const name = String(getField(raw, ['Name', 'Product Name', 'Title', 'Product']) || '').trim();
        if (!name) {
          errors.push('Product name is required');
        }

        const rawPrice = getField(raw, ['Price', 'Selling Price', 'Price INR', 'Offer Price']);
        const price = Number(rawPrice);
        if (rawPrice === undefined || isNaN(price) || price <= 0) {
          errors.push('Valid positive price is required');
        }

        const rawGstRate = getField(raw, ['GST Rate (%)', 'GST Rate', 'Tax Rate', 'gst_rate']);
        const gstRate = rawGstRate === undefined || String(rawGstRate).trim() === '' ? null : Number(rawGstRate);
        if (gstRate !== null && (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100)) errors.push('GST Rate must be between 0 and 100, or blank if not yet configured.');

        const rawMrp = getField(raw, ['MRP', 'Maximum Retail Price', 'Original Price', 'List Price']);
        const mrp = rawMrp !== undefined && !isNaN(Number(rawMrp)) ? Number(rawMrp) : undefined;
        if (mrp !== undefined && mrp < price) {
          errors.push(`MRP (${mrp}) cannot be lower than price (${price})`);
        }

        const rawSku = String(getField(raw, ['SKU', 'Product SKU', 'Item Code', 'Code']) || '').trim();
        const sku = rawSku || `VKV-SAR-${(index + 1).toString().padStart(4, '0')}`;

        const category = String(getField(raw, ['Category', 'Category Name', 'Collection Type']) || 'Sarees').trim();
        const collection = String(getField(raw, ['Collection', 'Collection Name']) || '').trim();

        const rawStock = getField(raw, ['Stock', 'Quantity', 'Stock Quantity', 'Inventory']);
        const parsedStock = rawStock !== undefined && String(rawStock).trim() !== '' ? Number(rawStock) : NaN;
        const stockQuantity = Number.isInteger(parsedStock) && parsedStock >= 0 ? parsedStock : 0;
        if (!Number.isInteger(parsedStock) || parsedStock < 0) {
          errors.push('Valid non-negative Stock is required; stock will not default silently to 5');
        }

        const fabric = String(getField(raw, ['Fabric', 'Material', 'Fabric Composition']) || '').trim();
        const weave = String(getField(raw, ['Weave', 'Craft', 'Weave Type']) || '').trim();
        const origin = String(getField(raw, ['Origin', 'Region', 'City', 'Provenance']) || '').trim();
        const dimensions = String(getField(raw, ['Dimensions', 'Length', 'Measurements', 'Size']) || '').trim();
        const careInstructions = String(getField(raw, ['Care Instructions', 'Care', 'Wash Care']) || '').trim();
        const description = String(getField(raw, ['Description', 'Short Description', 'Details']) || '').trim();
        const primaryImageUrl = String(getField(raw, ['Primary Image', 'Image URL', 'Image', 'Photo']) || '').trim();
        const color = String(getField(raw, ['Color', 'Colours', 'Primary Color']) || '').trim();

        const rawStatus = String(getField(raw, ['Status', 'Product Status']) || '').toLowerCase().trim();
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
          isValid: errors.length === 0,
          errors,
        };
      });

      setParsedRows(parsed);
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
      slug: r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
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

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSummary({
            total: data.total || payload.length,
            imported: data.imported || 0,
            updated: data.updated || 0,
            failed: data.failed || 0,
            errors: data.errors || [],
          });
          setStatus('completed');
          return;
        }
      }

      // 2. Direct client fallback if API route returned error
      if (isSupabaseConfigured()) {
        let imported = 0;
        let updated = 0;
        let failed = 0;
        const errors: { row: number; sku?: string; error: string }[] = [];

        // Fetch categories to map IDs
        const { data: catData } = await (supabase as any).from('categories').select('id, slug, name');
        const defaultCatId = catData?.[0]?.id || null;

        for (const item of payload) {
          const originalRow = parsedRows.find((r) => r.sku === item.sku);
          const rowNumber = originalRow?.rowNumber || 0;

          try {
            if (!item.name || item.price <= 0) {
              throw new Error('Name and valid positive price are required');
            }

            // Find category ID
            let categoryId = defaultCatId;
            if (item.category && catData) {
              const matched = catData.find(
                (c: any) =>
                  c.slug.toLowerCase() === item.category.toLowerCase() ||
                  c.name.toLowerCase() === item.category.toLowerCase()
              );
              if (matched) categoryId = matched.id;
            }

            // Check if SKU exists
            const { data: existing } = await (supabase as any)
              .from('products')
              .select('id')
              .eq('sku', item.sku)
              .maybeSingle();

            if (existing) {
              // Update
              const { error: updErr } = await (supabase as any)
                .from('products')
                .update({
                  name: item.name,
                  price: item.price,
                  mrp: item.mrp || null,
                  category_id: categoryId,
                  status: item.status,
                  fabric: item.fabric || null,
                  weave: item.weave || null,
                  origin: item.origin || null,
                  dimensions: item.dimensions || null,
                  care_instructions: item.careInstructions || null,
                  description: item.description || null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);

              if (updErr) throw updErr;

              if (item.primaryImageUrl) {
                await (supabase as any)
                  .from('product_images')
                  .upsert({
                    product_id: existing.id,
                    image_url: item.primaryImageUrl,
                    is_primary: true,
                    alt_text: item.name,
                    sort_order: 1,
                  });
              }

              updated++;
            } else {
              // Insert
              const { data: newProd, error: insErr } = await (supabase as any)
                .from('products')
                .insert({
                  sku: item.sku,
                  slug: `${item.slug}-${Date.now().toString().slice(-4)}`,
                  name: item.name,
                  price: item.price,
                  mrp: item.mrp || null,
                  category_id: categoryId,
                  status: item.status,
                  fabric: item.fabric || null,
                  weave: item.weave || null,
                  origin: item.origin || null,
                  dimensions: item.dimensions || null,
                  care_instructions: item.careInstructions || null,
                  description: item.description || null,
                })
                .select('id')
                .single();

              if (insErr || !newProd) throw (insErr || new Error('Insert failed'));

              if (item.primaryImageUrl) {
                await (supabase as any).from('product_images').insert({
                  product_id: newProd.id,
                  image_url: item.primaryImageUrl,
                  is_primary: true,
                  alt_text: item.name,
                  sort_order: 1,
                });
              }

              await (supabase as any).from('product_variants').insert({
                product_id: newProd.id,
                sku: item.sku,
                variant_name: 'Standard Free Size',
                stock_quantity: item.stockQuantity,
                color: item.color || null,
                is_active: true,
              });

              imported++;
            }
          } catch (rowErr: any) {
            failed++;
            errors.push({
              row: rowNumber,
              sku: item.sku,
              error: rowErr?.message || 'Row import failed',
            });
          }
        }

        setSummary({
          total: payload.length,
          imported,
          updated,
          failed,
          errors,
        });
        setStatus('completed');
      }
    } catch (err: any) {
      console.error('Import execution error:', err);
      setGlobalError(err.message || 'Execution error during product import.');
      setStatus('ready');
    }
  };

  const downloadSampleTemplate = () => {
    const templateData = [
      {
        SKU: 'VKV-SAR-001',
        Name: 'Royal Emerald Banarasi Katan Silk Saree',
        Category: 'Sarees',
        Collection: 'Heritage Sarees',
        Price: 18500,
        MRP: 22000,
        Stock: 10,
        Fabric: '100% Pure Katan Silk',
        Weave: 'Kadwa Brocade Handloom',
        Origin: 'Varanasi, Uttar Pradesh',
        Dimensions: '5.5 meters saree with 0.8m running blouse piece',
        'Care Instructions': 'Dry clean only. Store in pure cotton muslin cloth.',
        Description: 'Classical Banarasi saree handwoven using pure katan silk and antique zari floral jaal motifs across the body.',
        'Primary Image': 'https://jyiegidgzrvszqjhyfus.supabase.co/storage/v1/object/public/store-assets/products/product_banarasi_saree_1791192143761.jpg',
        Status: 'active',
        Color: 'Emerald Green',
      },
      {
        SKU: 'VKV-SAR-002',
        Name: 'Crimson Temple Border Pure Kanjivaram Silk Saree',
        Category: 'Sarees',
        Collection: 'Heritage Sarees',
        Price: 24500,
        MRP: 28000,
        Stock: 8,
        Fabric: 'Pure Mulberry Silk',
        Weave: 'Korvai Interlock Handloom',
        Origin: 'Kanchipuram, Tamil Nadu',
        Dimensions: '5.5 meters saree with 0.8m blouse piece',
        'Care Instructions': 'Dry clean only. Air out occasionally in shade.',
        Description: 'Bridal Kanjivaram silk saree featuring pure silver and gold zari korvai contrast borders with temple motifs.',
        'Primary Image': 'https://jyiegidgzrvszqjhyfus.supabase.co/storage/v1/object/public/store-assets/products/hero_vastram_saree_1791192126882.jpg',
        Status: 'active',
        Color: 'Crimson Red',
      },
      {
        SKU: 'VKV-SAR-003',
        Name: 'Chanderi Silk Cotton Eknaliya Butti Saree',
        Category: 'Sarees',
        Collection: 'Seasonal Archive',
        Price: 8900,
        MRP: 11000,
        Stock: 15,
        Fabric: 'Silk Cotton Blend',
        Weave: 'Chanderi Handloom',
        Origin: 'Chanderi, Madhya Pradesh',
        Dimensions: '5.5 meters saree with unstitched blouse',
        'Care Instructions': 'Dry clean recommended or gentle cold hand wash.',
        Description: 'Lightweight gossamer Chanderi drape adorned with delicate handwoven gold zari eknaliya floral butties.',
        'Primary Image': 'https://jyiegidgzrvszqjhyfus.supabase.co/storage/v1/object/public/store-assets/products/craft_textile_detail_1791192181572.jpg',
        Status: 'active',
        Color: 'Pastel Peach',
      },
      {
        SKU: 'VKV-SAR-004',
        Name: 'Heritage Peacock Border Paithani Silk Saree',
        Category: 'Sarees',
        Collection: 'Heritage Sarees',
        Price: 32000,
        MRP: 36000,
        Stock: 5,
        Fabric: 'Pure Silk',
        Weave: 'Tapestry Handloom',
        Origin: 'Yeola, Maharashtra',
        Dimensions: '5.5m saree + 0.8m blouse',
        'Care Instructions': 'Dry clean only. Avoid spraying perfumes directly.',
        Description: 'Regal Paithani saree with an ornate peacock and parrot motif pallu handwoven in kaleidoscopic jewel silk.',
        'Primary Image': 'https://jyiegidgzrvszqjhyfus.supabase.co/storage/v1/object/public/store-assets/products/product_banarasi_saree_1791192143761.jpg',
        Status: 'active',
        Color: 'Royal Magenta',
        'GST Rate (%)': 5,
        'Additional Image URLs (comma-separated)': '',
        'Image Alt Text': 'Royal Magenta Paithani saree',
        'SEO Title': 'Heritage Peacock Border Paithani Silk Saree | VK VASTRAM',
        'SEO Description': 'Handwoven Paithani silk saree from VK VASTRAM.',
        'Featured (TRUE/FALSE)': true,
        'Best Seller (TRUE/FALSE)': false,
        'New Arrival (TRUE/FALSE)': true,
        'Tags (comma-separated)': 'Paithani, Silk, Heritage',
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set auto column widths
    const colWidths = Object.keys(templateData[0]).map((k) => ({
      wch: Math.max(k.length + 4, 16),
    }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'PRODUCT_IMPORT');
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
