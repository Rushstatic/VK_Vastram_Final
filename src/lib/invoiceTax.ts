export interface InvoiceTaxLine {
  quantity?: number;
  price?: number;
  unitPrice?: number;
  totalAmount?: number;
  productMetadata?: Record<string, any> | null;
  product_metadata_snapshot?: Record<string, any> | null;
}

const STATE_CODES: Record<string, string> = {
  'jammu and kashmir': '01', 'himachal pradesh': '02', 'punjab': '03', 'chandigarh': '04',
  'uttarakhand': '05', 'haryana': '06', 'delhi': '07', 'rajasthan': '08', 'uttar pradesh': '09',
  'bihar': '10', 'sikkim': '11', 'arunachal pradesh': '12', 'nagaland': '13', 'manipur': '14',
  'mizoram': '15', 'tripura': '16', 'meghalaya': '17', 'assam': '18', 'west bengal': '19',
  'jharkhand': '20', 'odisha': '21', 'chhattisgarh': '22', 'madhya pradesh': '23', 'gujarat': '24',
  'dadra and nagar haveli and daman and diu': '26', 'maharashtra': '27', 'andhra pradesh': '37',
  'karnataka': '29', 'goa': '30', 'lakshadweep': '31', 'kerala': '32', 'tamil nadu': '33',
  'puducherry': '34', 'andaman and nicobar islands': '35', 'telangana': '36', 'ladakh': '38'
};

const money = (amount: number) => `₹${(Number.isFinite(amount) ? amount : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));

export function buildInvoiceTaxRows(
  items: InvoiceTaxLine[],
  sellerGstin: string | null | undefined,
  customerState: string | null | undefined,
  recordedTaxAmount: number | null | undefined
): string {
  const groups = new Map<number, { taxable: number; tax: number }>();
  let snapshotCount = 0;
  let missingSnapshotCount = 0;
  for (const item of items || []) {
    const meta = item.productMetadata || item.product_metadata_snapshot || {};
    const hasRate = meta.gstRateSnapshot !== null && meta.gstRateSnapshot !== undefined && String(meta.gstRateSnapshot).trim() !== '';
    const hasTax = meta.gstAmountSnapshot !== null && meta.gstAmountSnapshot !== undefined && String(meta.gstAmountSnapshot).trim() !== '';
    const hasTaxable = meta.taxableAmountSnapshot !== null && meta.taxableAmountSnapshot !== undefined && String(meta.taxableAmountSnapshot).trim() !== '';
    const rate = Number(meta.gstRateSnapshot);
    const tax = Number(meta.gstAmountSnapshot);
    const taxable = Number(meta.taxableAmountSnapshot);
    if (hasRate && hasTax && hasTaxable && Number.isFinite(rate) && rate >= 0 && Number.isFinite(tax) && tax >= 0 && Number.isFinite(taxable) && taxable >= 0) {
      const key = Math.round(rate * 100) / 100;
      const existing = groups.get(key) || { taxable: 0, tax: 0 };
      existing.taxable += taxable;
      existing.tax += tax;
      groups.set(key, existing);
      snapshotCount += 1;
    } else {
      missingSnapshotCount += 1;
    }
  }

  if (snapshotCount > 0) {
    const taxableTotal = Array.from(groups.values()).reduce((sum, g) => sum + g.taxable, 0);
    const sellerCode = /^\d{2}/.test(String(sellerGstin || '')) ? String(sellerGstin).slice(0, 2) : '';
    const normalizedState = String(customerState || '').trim().toLowerCase();
    const customerCode = /^\d{2}$/.test(normalizedState) ? normalizedState : (STATE_CODES[normalizedState] || '');
    const interstateKnown = Boolean(sellerCode && customerCode);
    const intraState = interstateKnown && sellerCode === customerCode;
    const html = [
      `<p><span>Taxable value (included in item subtotal)</span><strong>${money(taxableTotal)}</strong></p>`,
      ...Array.from(groups.entries()).sort(([a], [b]) => a - b).flatMap(([rate, values]) => {
        if (rate === 0 || values.tax <= 0) return [];
        if (intraState) return [
          `<p><span>CGST (${escapeHtml((rate / 2).toFixed(2))}%) included</span><strong>${money(values.tax / 2)}</strong></p>`,
          `<p><span>SGST (${escapeHtml((rate / 2).toFixed(2))}%) included</span><strong>${money(values.tax / 2)}</strong></p>`
        ];
        if (interstateKnown) return [`<p><span>IGST (${escapeHtml(rate.toFixed(2))}%) included</span><strong>${money(values.tax)}</strong></p>`];
        return [`<p><span>GST (${escapeHtml(rate.toFixed(2))}%) included</span><strong>${money(values.tax)}</strong></p>`];
      })
    ].join('');
    const incompleteNote = missingSnapshotCount > 0
      ? `<p class="tax-note">GST rate snapshots are missing for ${missingSnapshotCount} line item(s). Those items are excluded from the rate-wise breakdown; configure the product GST rate before future checkout.</p>`
      : '';
    return `${html}<p class="tax-note">GST components are already included in the listed item prices and are not added again to the payable total.</p>${incompleteNote}`;
  }

  const tax = Number(recordedTaxAmount || 0);
  if (Number.isFinite(tax) && tax > 0) {
    return `<p><span>GST recorded on this order</span><strong>${money(tax)}</strong></p><p class="tax-note">Rate-wise tax snapshots are unavailable for this order, so the invoice shows only the recorded tax total.</p>`;
  }
  return '<p class="tax-note">Rate-wise GST details are unavailable for this order. Configure the GST rate for each applicable product before checkout to include an item-wise breakdown.</p>';
}
