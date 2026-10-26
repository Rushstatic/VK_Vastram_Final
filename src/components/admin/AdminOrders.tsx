import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  User,
  ArrowRight,
  FileText,
  Calendar,
  X,
  History,
  CornerDownLeft,
  ChevronLeft,
  ChevronRight,
  Package,
  Truck,
  Sparkles,
  ShoppingBag,
  ShieldCheck
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { buildInvoiceTaxRows } from '../../lib/invoiceTax';
import { formatCityLine, isStorePickup } from '../../lib/orderAddress';
import { formatPrice } from '../ui/PriceDisplay';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { normalizeImageUrl } from '../../lib/imageHelper';

// Enums & lists for filters
const ORDER_STATUS_OPTIONS = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Payment Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Packed', value: 'packed' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Out for Delivery', value: 'out_for_delivery' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Return Requested', value: 'return_requested' },
  { label: 'Returned', value: 'returned' }
];

const PAYMENT_STATUS_OPTIONS = [
  { label: 'All Payments', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Paid / Captured', value: 'captured' },
  { label: 'Failed', value: 'failed' },
  { label: 'Refunded', value: 'refunded' },
  { label: 'COD Pending', value: 'cod_pending' },
  { label: 'COD Collected', value: 'cod_collected' },
  { label: 'COD Settled', value: 'cod_settled' }
];

const CUSTOMER_TYPE_OPTIONS = [
  { label: 'All Customers', value: 'all' },
  { label: 'Guest Checkout', value: 'guest' },
  { label: 'Registered Patron', value: 'registered' }
];

const DATE_RANGE_OPTIONS = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: '7days' },
  { label: 'Last 30 Days', value: '30days' }
];

export const AdminOrders: React.FC = () => {
  const { settings: storeSettings } = useSiteSettings();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // Search & Filter state
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('order') || '');
  const [orderStatus, setOrderStatus] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [customerType, setCustomerType] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  // Which orders to show. Only real orders (paid online or Cash on Delivery) appear by default;
  // unpaid checkouts and failed / abandoned payments live in their own tabs.
  type OrderView = 'confirmed' | 'awaiting' | 'failed' | 'all';
  const [orderView, setOrderView] = useState<OrderView>('confirmed');
  const [viewCounts, setViewCounts] = useState<{ confirmed: number; awaiting: number; failed: number }>({ confirmed: 0, awaiting: 0, failed: 0 });

  // Selected order details state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isUpdatingPaymentStatus, setIsUpdatingPaymentStatus] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Operations state
  const [transitionNotes, setTransitionNotes] = useState('');
  const [isUpdatingStatus, setIsTransitioning] = useState(false);
  const [adminNotesText, setAdminNotesText] = useState('');
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [isSavingShipment, setIsSavingShipment] = useState(false);
  const [isUpdatingNotes, setIsUpdatingNotes] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const exportOrdersExcel = async () => {
    if (!orders.length) { setErrorMessage('There are no matching orders to export.'); return; }
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      // Export the full currently filtered result set, not just the visible 10-row page.
      const pageLimit = 100;
      const filters = { search: search.trim(), orderStatus, paymentStatus, customerType, dateRange, view: orderView };
      const firstPage = await adminService.getOrders({ ...filters, page: 1, limit: pageLimit });
      if (!firstPage.success) throw new Error(firstPage.error || 'Could not load orders for export.');
      const orderSummaries: any[] = [...(firstPage.orders || [])];
      const total = Math.max(Number(firstPage.totalCount || 0), orderSummaries.length);
      const pageCount = Math.ceil(total / pageLimit);
      for (let exportPage = 2; exportPage <= pageCount; exportPage += 1) {
        const result = await adminService.getOrders({ ...filters, page: exportPage, limit: pageLimit });
        if (!result.success) throw new Error(result.error || `Could not load order export page ${exportPage}.`);
        orderSummaries.push(...(result.orders || []));
      }
      if (!orderSummaries.length) throw new Error('No orders matched the current filters.');

      // The orders endpoint returns item/payment snapshots; avoid fragile N+1 detail calls.
      const detailed: any[] = orderSummaries;
      const headers = [
        'Name','Email','Financial Status','Paid at','Fulfillment Status','Fulfilled at','Accepts Marketing','Currency','Subtotal','Shipping','Taxes','Total','Discount Code','Discount Amount','Shipping Method','Created at','Lineitem quantity','Lineitem name','Lineitem price','Lineitem compare at price','Lineitem sku','Lineitem requires shipping','Lineitem taxable','Lineitem fulfillment status','Billing Name','Billing Street','Billing Address1','Billing Address2','Billing Company','Billing City','Billing Zip','Billing Province','Billing Country','Billing Phone','Shipping Name','Shipping Street','Shipping Address1','Shipping Address2','Shipping Company','Shipping City','Shipping Zip','Shipping Province','Shipping Country','Shipping Phone','Notes','Note Attributes','Cancelled at','Payment Method','Payment Reference','Refunded Amount','Vendor','Outstanding Balance','Employee','Location','Device ID','Id','Tags','Risk Level','Source','Lineitem discount','Tax Type','CGST Rate','CGST Amount','SGST Rate','SGST Amount','IGST Rate','IGST Amount','Seller GSTIN','Phone','Receipt Number','Duties','Billing Province Name','Shipping Province Name','Payment ID','Payment Terms Name','Next Payment Due At','Payment References','Status '
      ];
      const valueOf = (obj: any, ...keys: string[]) => {
        for (const key of keys) if (obj?.[key] !== undefined && obj?.[key] !== null && obj?.[key] !== '') return obj[key];
        return '';
      };
      const rows: any[][] = [];
      for (const o of detailed) {
        const shipping = o.shippingAddressSnapshot || o.shipping_address_snapshot || {};
        const billing = o.billingAddressSnapshot || o.billing_address_snapshot || shipping;
        const items = Array.isArray(o.items) && o.items.length ? o.items : [{}];
        const orderTaxTotal = Number(valueOf(o, 'taxAmount', 'tax_amount', 'gst_amount') || 0);
        const orderLineBaseTotal = items.reduce((sum: number, item: any) => {
          const qty = Number(valueOf(item, 'quantity') || 0);
          const price = Number(valueOf(item, 'price', 'unitPrice', 'unit_price') || 0);
          return sum + Math.max(0, qty * price);
        }, 0);
        const paymentStatus = String(valueOf(o, 'paymentStatus', 'payment_status') || 'pending').toLowerCase();
        const orderStatus = String(valueOf(o, 'orderStatus', 'order_status', 'status') || 'pending').toLowerCase();
        const paymentMethod = String(valueOf(o, 'paymentMethod', 'payment_method') || '').toLowerCase();
        const financialStatus = ['captured','paid','cod_collected','cod_settled'].includes(paymentStatus) ? 'paid' : paymentStatus === 'refunded' ? 'refunded' : 'pending';
        const fulfillmentStatus = orderStatus === 'delivered' ? 'fulfilled' : ['shipped','out_for_delivery'].includes(orderStatus) ? 'partial' : 'unfulfilled';
        const paidAt = valueOf(o.payment, 'verifiedAt', 'verified_at') || (financialStatus === 'paid' ? valueOf(o, 'updatedAt', 'updated_at') : '');
        const fulfilledAt = valueOf(o, 'deliveredAt', 'delivered_at', 'shippedAt', 'shipped_at');
        const refundedAmount = o.refundStatus === 'completed' ? '' : ''; // No refund amount is stored; do not fabricate one.
        for (const item of items) {
          const lineName = valueOf(item, 'productName', 'product_name', 'name');
          const lineQty = Number(valueOf(item, 'quantity') || 0);
          const linePrice = Number(valueOf(item, 'price', 'unitPrice', 'unit_price') || 0);
          const lineSku = valueOf(item, 'sku', 'sku_snapshot');
          const metadata = valueOf(item, 'productMetadata', 'product_metadata_snapshot') || {};
          const gstRateRaw = metadata.gstRateSnapshot ?? metadata.gst_rate_snapshot ?? metadata.gstRate ?? metadata.gst_rate;
          const gstAmountRaw = metadata.gstAmountSnapshot ?? metadata.gst_amount_snapshot ?? metadata.gstAmount ?? metadata.gst_amount;
          const gstRate = gstRateRaw !== '' && gstRateRaw !== undefined && gstRateRaw !== null && Number.isFinite(Number(gstRateRaw)) ? Number(gstRateRaw) : null;
          const snapshotTaxAmount = gstAmountRaw !== '' && gstAmountRaw !== undefined && gstAmountRaw !== null && Number.isFinite(Number(gstAmountRaw)) ? Number(gstAmountRaw) : null;
          const lineBase = Math.max(0, lineQty * linePrice);
          const gstAmount = snapshotTaxAmount !== null ? snapshotTaxAmount : (orderLineBaseTotal > 0 && orderTaxTotal > 0 ? Math.round((orderTaxTotal * lineBase / orderLineBaseTotal) * 100) / 100 : null);
          const sellerGstin = String(storeSettings?.gstin || '');
          const sellerStateCode = /^\d{2}/.test(sellerGstin) ? sellerGstin.slice(0, 2) : '27'; // VK VASTRAM seller location: Maharashtra; configure GSTIN in Admin Settings for statutory validation.
          const destinationStateRaw = String(valueOf(shipping, 'state', 'province') || '').trim().toLowerCase().replace(/^in[- ]/, '').replace(/,.*$/, '').trim();
          const stateCodes: Record<string, string> = { 'jammu and kashmir': '01', 'himachal pradesh': '02', punjab: '03', chandigarh: '04', uttarakhand: '05', haryana: '06', delhi: '07', rajasthan: '08', 'uttar pradesh': '09', bihar: '10', sikkim: '11', 'arunachal pradesh': '12', nagaland: '13', manipur: '14', mizoram: '15', tripura: '16', meghalaya: '17', assam: '18', 'west bengal': '19', jharkhand: '20', odisha: '21', chhattisgarh: '22', 'madhya pradesh': '23', gujarat: '24', 'dadra and nagar haveli and daman and diu': '26', maharashtra: '27', mh: '27', andhra: '37', 'andhra pradesh': '37', karnataka: '29', goa: '30', lakshadweep: '31', kerala: '32', 'tamil nadu': '33', puducherry: '34', 'andaman and nicobar islands': '35', telangana: '36', ladakh: '38' };
          const destinationCode = /^\d{2}$/.test(destinationStateRaw) ? destinationStateRaw : stateCodes[destinationStateRaw] || '';
          const interstateKnown = Boolean(sellerStateCode && destinationCode);
          const taxType = interstateKnown ? (sellerStateCode === destinationCode ? 'CGST/SGST' : 'IGST') : 'UNKNOWN — CHECK GSTIN/STATE';
          const savedCgst = metadata.cgstAmountSnapshot ?? metadata.cgst_amount_snapshot;
          const savedSgst = metadata.sgstAmountSnapshot ?? metadata.sgst_amount_snapshot;
          const savedIgst = metadata.igstAmountSnapshot ?? metadata.igst_amount_snapshot;
          const cgstAmount = taxType === 'CGST/SGST' && savedCgst != null ? Number(savedCgst) : (gstAmount !== null && taxType === 'CGST/SGST' ? Math.round((gstAmount / 2) * 100) / 100 : '');
          const sgstAmount = taxType === 'CGST/SGST' && savedSgst != null ? Number(savedSgst) : (gstAmount !== null && taxType === 'CGST/SGST' ? Math.round((gstAmount - Number(cgstAmount)) * 100) / 100 : '');
          const igstAmount = taxType === 'IGST' && savedIgst != null ? Number(savedIgst) : (gstAmount !== null && taxType === 'IGST' ? gstAmount : '');
          const cgstRate = gstRate !== null && taxType === 'CGST/SGST' ? gstRate / 2 : '';
          const sgstRate = gstRate !== null && taxType === 'CGST/SGST' ? gstRate / 2 : '';
          const igstRate = gstRate !== null && taxType === 'IGST' ? gstRate : '';
          const row: Record<string, any> = {
            'Name': valueOf(o, 'orderNumber', 'order_number') || valueOf(o, 'id'),
            'Email': valueOf(o, 'customerEmail', 'customer_email') || valueOf(shipping, 'email'),
            'Financial Status': financialStatus,
            'Paid at': paidAt,
            'Fulfillment Status': fulfillmentStatus,
            'Fulfilled at': fulfilledAt,
            'Accepts Marketing': '',
            'Currency': valueOf(o, 'currency') || 'INR',
            'Subtotal': Number(valueOf(o, 'subtotal') || 0),
            'Shipping': Number(valueOf(o, 'shippingAmount', 'shipping_amount', 'shipping_cost') || 0),
            'Taxes': gstAmount ?? '',
            'Total': Number(valueOf(o, 'totalAmount', 'total_amount', 'total') || 0),
            'Discount Code': valueOf(o, 'couponCode', 'coupon_code'),
            'Discount Amount': Number(valueOf(o, 'discountAmount', 'discount_amount') || 0),
            'Shipping Method': valueOf(o, 'courierName', 'courier_name') || 'Manual Courier',
            'Created at': valueOf(o, 'createdAt', 'created_at'),
            'Lineitem quantity': lineQty || '',
            'Lineitem name': lineName,
            'Lineitem price': linePrice || '',
            'Lineitem compare at price': '',
            'Lineitem sku': lineSku,
            'Lineitem requires shipping': lineName ? 'TRUE' : '',
            'Lineitem taxable': lineName ? 'TRUE' : '',
            'Lineitem fulfillment status': fulfillmentStatus,
            'Billing Name': valueOf(billing, 'recipientName', 'full_name', 'name') || valueOf(o, 'customerName', 'customer_name'),
            'Billing Street': [valueOf(billing, 'addressLine1','address_line1'), valueOf(billing, 'addressLine2','address_line2')].filter(Boolean).join(', '),
            'Billing Address1': valueOf(billing, 'addressLine1','address_line1'),
            'Billing Address2': valueOf(billing, 'addressLine2','address_line2'),
            'Billing Company': valueOf(billing, 'company'),
            'Billing City': valueOf(billing, 'city'),
            'Billing Zip': valueOf(billing, 'pincode','postal_code','zip'),
            'Billing Province': valueOf(billing, 'state','province'),
            'Billing Country': valueOf(billing, 'country') || 'India',
            'Billing Phone': valueOf(billing, 'phone') || valueOf(o, 'customerPhone','customer_phone'),
            'Shipping Name': valueOf(shipping, 'recipientName','full_name','name') || valueOf(o, 'customerName','customer_name'),
            'Shipping Street': [valueOf(shipping, 'addressLine1','address_line1'), valueOf(shipping, 'addressLine2','address_line2')].filter(Boolean).join(', '),
            'Shipping Address1': valueOf(shipping, 'addressLine1','address_line1'),
            'Shipping Address2': valueOf(shipping, 'addressLine2','address_line2'),
            'Shipping Company': valueOf(shipping, 'company'),
            'Shipping City': valueOf(shipping, 'city'),
            'Shipping Zip': valueOf(shipping, 'pincode','postal_code','zip'),
            'Shipping Province': valueOf(shipping, 'state','province'),
            'Shipping Country': valueOf(shipping, 'country') || 'India',
            'Shipping Phone': valueOf(shipping, 'phone') || valueOf(o, 'customerPhone','customer_phone'),
            'Notes': valueOf(o, 'notes'),
            'Note Attributes': '',
            'Cancelled at': valueOf(o, 'cancelledAt','cancelled_at'),
            'Payment Method': valueOf(o.payment, 'method') || paymentMethod,
            'Payment Reference': valueOf(o.payment, 'providerPaymentId','provider_payment_id','providerOrderId','provider_order_id'),
            'Refunded Amount': refundedAmount,
            'Vendor': 'VK VASTRAM',
            'Outstanding Balance': ['pending','cod_pending'].includes(paymentStatus) ? Number(valueOf(o, 'totalAmount','total_amount','total') || 0) : 0,
            'Employee': '', 'Location': '', 'Device ID': '',
            'Id': valueOf(o, 'id'),
            'Tags': valueOf(o, 'courierName','courier_name') ? 'manual-courier' : '',
            'Risk Level': '', 'Source': 'online-store', 'Lineitem discount': '',
            'Tax Type': taxType,
            'CGST Rate': cgstRate, 'CGST Amount': cgstAmount,
            'SGST Rate': sgstRate, 'SGST Amount': sgstAmount,
            'IGST Rate': igstRate, 'IGST Amount': igstAmount,
            'Seller GSTIN': sellerGstin,
            'Phone': valueOf(o, 'customerPhone','customer_phone') || valueOf(shipping, 'phone'),
            'Receipt Number': '', 'Duties': '',
            'Billing Province Name': valueOf(billing, 'state','province'),
            'Shipping Province Name': valueOf(shipping, 'state','province'),
            'Payment ID': valueOf(o.payment, 'providerPaymentId','provider_payment_id'),
            'Payment Terms Name': paymentMethod === 'cod' ? 'Cash on Delivery' : 'Prepaid',
            'Next Payment Due At': '', 'Payment References': valueOf(o.payment, 'providerPaymentId','provider_payment_id'),
            'Status ': orderStatus === 'cancelled' ? 'cancelled' : orderStatus === 'delivered' ? 'closed' : 'open'
          };
          rows.push(headers.map((header) => row[header] ?? ''));
        }
      }
      const fileStem = `vk-vastram-orders-${new Date().toISOString().slice(0,10)}`;
      const wb = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      sheet['!cols'] = headers.map((h) => ({ wch: Math.min(Math.max(h.length + 2, 12), 30) }));
      XLSX.utils.book_append_sheet(wb, sheet, 'orders_export');
      try {
        const output = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileStem}.xlsx`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      } catch (xlsxError) {
        // Download remains possible if a browser/library combination can't serialize XLSX.
        const csv = [headers, ...rows].map((row) => row.map((cell) => {
          const val = String(cell ?? '').replace(/"/g, '""');
          return /[",\r\n]/.test(val) ? `"${val}"` : val;
        }).join(',')).join('\r\n');
        const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `${fileStem}.csv`; link.style.display = 'none';
        document.body.appendChild(link); link.click(); link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      }
      setSuccessMessage(`Exported ${rows.length} line-item rows across ${detailed.length} orders using the reference workbook's ${headers.length}-column layout.`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to export the order ledger.');
    }
  };

  // Open a printable invoice using the immutable amounts stored on the order.
  // Browser print supports Save as PDF; tax split follows place-of-supply state.
  const printSelectedOrderInvoice = () => {
    if (!selectedOrder) return;
    const o = selectedOrder;
    const address = o.shippingAddressSnapshot || o.shipping_address_snapshot || {};
    const tax = Number(o.taxAmount ?? o.tax_amount ?? 0) || 0;
    const items = Array.isArray(o.items) ? o.items : Array.isArray(o.orderItems) ? o.orderItems : [];
    const escapeHtml = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c));
    const money = (v: unknown) => `₹${(Number(v) || 0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    const gstRowsHtml = buildInvoiceTaxRows(items, storeSettings?.gstin, address.state, tax);
    const itemRows = items.map((it: any) => `<tr><td>${escapeHtml(it.productName || it.product_name || it.name || 'Item')}</td><td>${escapeHtml(it.sku || '')}</td><td>${Number(it.quantity || 1)}</td><td>${money(it.unitPrice ?? it.unit_price ?? it.price)}</td><td>${money((Number(it.unitPrice ?? it.unit_price ?? it.price)||0)*(Number(it.quantity)||1))}</td></tr>`).join('');
    const sellerName = escapeHtml(storeSettings?.storeName || 'VK VASTRAM');
    const sellerAddress = escapeHtml(storeSettings?.studioAddress || '');
    const sellerGstin = escapeHtml(storeSettings?.gstin || '');
    const invoiceLogo = escapeHtml(storeSettings?.logoUrl || '/vk-vastram-logo.png');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${escapeHtml(o.orderNumber || o.order_number || o.id)}</title><style>body{font:14px Arial,sans-serif;color:#222;margin:32px}header{display:flex;justify-content:space-between;border-bottom:2px solid #78281f;padding-bottom:16px}h1{font:28px Georgia,serif;color:#78281f;margin:0}table{width:100%;border-collapse:collapse;margin-top:28px}th,td{border:1px solid #ddd;padding:9px;text-align:left}th{background:#f4efe6}.totals{margin:24px 0 0 auto;width:320px}.totals p{display:flex;justify-content:space-between}.grand{font-weight:bold;border-top:2px solid #333;padding-top:10px}.tax-note{font-size:10px;color:#666;line-height:1.5}@media print{button{display:none}}</style></head><body><header><div><div style="display:flex;align-items:center;gap:12px"><img src="${invoiceLogo}" alt="VK VASTRAM logo" style="width:68px;height:68px;object-fit:contain"><h1>${sellerName}</h1></div><p>Order Invoice (recorded order amounts)</p><p>${sellerAddress}${sellerGstin ? `<br><strong>GSTIN:</strong> ${sellerGstin}` : ''}</p></div><div><strong>Order:</strong> ${escapeHtml(o.orderNumber || o.order_number || o.id)}<br><strong>Date:</strong> ${escapeHtml(o.createdAt || o.created_at || new Date().toISOString())}<br><strong>Payment:</strong> ${escapeHtml(o.paymentMethod || o.payment_method || '')} / ${escapeHtml(o.paymentStatus || o.payment_status || '')}</div></header><h3>Bill / Ship To</h3><p>${escapeHtml(address.recipientName || address.full_name || o.customerName || o.customer_name)}<br>${escapeHtml(address.addressLine1 || address.address_line1 || '')} ${escapeHtml(address.addressLine2 || address.address_line2 || '')}<br>${escapeHtml(address.city || '')}, ${escapeHtml(address.state || '')} ${escapeHtml(address.pincode || address.postal_code || '')}<br>${escapeHtml(o.customerEmail || o.customer_email || '')} · ${escapeHtml(address.phone || o.customerPhone || o.customer_phone || '')}</p><table><thead><tr><th>Item</th><th>SKU</th><th>Qty</th><th>Unit Price</th><th>Line Total</th></tr></thead><tbody>${itemRows || '<tr><td colspan="5">Order item details unavailable</td></tr>'}</tbody></table><div class="totals"><p><span>Item subtotal (GST-inclusive)</span><strong>${money(o.subtotal ?? o.subtotalAmount)}</strong></p>${gstRowsHtml}<p><span>Discount ${escapeHtml(o.couponCode || o.coupon_code || '')}</span><strong>−${money(o.discountAmount ?? o.discount_amount)}</strong></p><p><span>Shipping</span><strong>${money(o.shippingAmount ?? o.shipping_amount ?? o.shipping_cost)}</strong></p><p class="grand"><span>Grand Total</span><strong>${money(o.totalAmount ?? o.total_amount ?? o.total)}</strong></p></div><p style="margin-top:32px;color:#666;font-size:11px">Rate-wise GST values use the immutable line-item snapshot captured at checkout. IGST versus CGST/SGST is only split when the seller GSTIN state code and customer state are available. Verify HSN/SAC and applicable tax rates before treating this as a statutory GST tax invoice.</p><button onclick="window.print()">Print / Save as PDF</button><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`;
    const win = window.open('', '_blank');
    if (!win) { setErrorMessage('Allow popups to print or save the invoice.'); return; }
    win.document.open(); win.document.write(html); win.document.close();
  };

  // Fetch orders with pagination & filters
  const fetchOrdersList = async () => {
    setLoading(true);
    try {
      const res = await adminService.getOrders({
        search,
        orderStatus,
        paymentStatus,
        customerType,
        dateRange,
        view: orderView,
        page,
        limit
      });
      if (res.success) {
        setOrders(res.orders || []);
        setTotalCount(res.totalCount || 0);
        if (res.viewCounts) setViewCounts(res.viewCounts);
      } else {
        console.error('Failed to retrieve orders list:', res.error);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch single order details
  const fetchSingleOrderDetails = async (orderId: string) => {
    setLoadingDetails(true);
    setErrorMessage(null);
    try {
      const res = await adminService.getOrderDetails(orderId);
      if (res.success && res.order) {
        setSelectedOrder(res.order);
        setAdminNotesText(res.order.adminNotes || res.order.admin_notes || '');
        setCourierName(res.order.courierName || '');
        setTrackingNumber(res.order.trackingNumber || '');
        setTrackingUrl(res.order.trackingUrl || '');
      } else {
        setErrorMessage(res.error || 'Failed to load order details.');
      }
    } catch (err) {
      setErrorMessage('Communication error loading order details.');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Trigger search / filters reload
  useEffect(() => {
    setPage(1);
    fetchOrdersList();
  }, [search, orderStatus, paymentStatus, customerType, dateRange, orderView]);

  // Handle page change
  useEffect(() => {
    fetchOrdersList();
  }, [page]);

  // Load details when ID is selected
  useEffect(() => {
    if (selectedOrderId) {
      fetchSingleOrderDetails(selectedOrderId);
    } else {
      setSelectedOrder(null);
    }
  }, [selectedOrderId]);

  // Clear notifications
  const clearNotifications = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Handle Order Status State Machine Transition
  const handleStatusTransition = async (nextStatus: string) => {
    if (!selectedOrder) return;
    if (nextStatus === 'shipped' && !String(selectedOrder.courierName || '').trim()) {
      setErrorMessage('Save a courier partner in the Courier & Tracking section before marking this order as Shipped. Tracking number and URL are optional for local delivery.');
      return;
    }
    setIsTransitioning(true);
    clearNotifications();

    try {
      const res = await adminService.updateOrderStatus(
        selectedOrder.id,
        nextStatus,
        // Optional Payment status transitions depending on standard COD lifecycle or cancelled/refunded flows
        undefined,
        transitionNotes || (nextStatus === 'cancelled' ? 'Cancelled by administrator' : '')
      );

      if (res.success) {
        setSuccessMessage(res.message || `Order successfully transitioned to ${nextStatus}.`);
        setTransitionNotes('');
        if (nextStatus === 'cancelled') setShowCancelConfirm(false);
        // Refresh single order details & list
        await fetchSingleOrderDetails(selectedOrder.id);
        fetchOrdersList();
      } else {
        setErrorMessage(res.error || 'Status transition rejected.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unexpected transition error.');
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleCodPaymentUpdate = async (nextPaymentStatus: 'cod_collected' | 'cod_settled') => {
    if (!selectedOrder) return;
    setIsUpdatingPaymentStatus(true);
    clearNotifications();
    try {
      const res = await adminService.updateCodPaymentStatus(selectedOrder.id, nextPaymentStatus, transitionNotes);
      if (!res.success) { setErrorMessage(res.error || 'Could not update COD payment status.'); return; }
      setSuccessMessage(res.message || `COD payment marked ${nextPaymentStatus.replace('_', ' ')}.`);
      setTransitionNotes('');
      await fetchSingleOrderDetails(selectedOrder.id);
      await fetchOrdersList();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not update COD payment status.');
    } finally {
      setIsUpdatingPaymentStatus(false);
    }
  };

  const handleRefundStatusUpdate = async (nextRefundStatus: 'processing' | 'completed' | 'failed') => {
    if (!selectedOrder) return;
    if (nextRefundStatus === 'completed' && !window.confirm('Confirm the refund has actually been completed with the payment provider or through your manual payment process. This records completion; it does not transfer money.')) return;
    setIsUpdatingPaymentStatus(true);
    clearNotifications();
    try {
      const res = await adminService.updateOrderRefundStatus(selectedOrder.id, nextRefundStatus, transitionNotes);
      if (!res.success) { setErrorMessage(res.error || 'Could not update refund status.'); return; }
      setSuccessMessage(res.message || `Refund marked ${nextRefundStatus}.`);
      setTransitionNotes('');
      await fetchSingleOrderDetails(selectedOrder.id);
      await fetchOrdersList();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not update refund status.');
    } finally {
      setIsUpdatingPaymentStatus(false);
    }
  };

  const handleSaveShipment = async () => {
    if (!selectedOrder) return;
    setIsSavingShipment(true);
    clearNotifications();
    try {
      const normalizedTrackingUrl = trackingUrl.trim();
      if (normalizedTrackingUrl) {
        try {
          const parsed = new URL(normalizedTrackingUrl);
          if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Use an http:// or https:// URL.');
        } catch {
          setErrorMessage('Enter a valid http(s) tracking URL, or leave it blank for local courier delivery.');
          return;
        }
      }
      const result = await adminService.updateOrderShipment(selectedOrder.id, { courierName, trackingNumber, trackingUrl: normalizedTrackingUrl });
      if (result.success) {
        setSuccessMessage(result.message || 'Courier tracking saved.');
        await fetchSingleOrderDetails(selectedOrder.id);
        fetchOrdersList();
      } else setErrorMessage(result.error || 'Unable to save courier tracking.');
    } catch (err: any) { setErrorMessage(err?.message || 'Unable to save courier tracking.'); }
    finally { setIsSavingShipment(false); }
  };

  // Save Internal Admin Notes
  const handleSaveAdminNotes = async () => {
    if (!selectedOrder) return;
    setIsUpdatingNotes(true);
    clearNotifications();

    try {
      const res = await adminService.updateAdminNotes(selectedOrder.id, adminNotesText);
      if (res.success) {
        setSuccessMessage('Internal administrative notes updated successfully.');
        // Refresh order details to confirm timeline update
        await fetchSingleOrderDetails(selectedOrder.id);
      } else {
        setErrorMessage(res.error || 'Failed to save admin notes.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error updating notes.');
    } finally {
      setIsUpdatingNotes(false);
    }
  };

  const totalPages = Math.ceil(totalCount / limit);

  // Helper for Order Status Badge styling
  const getOrderStatusBadge = (status: string) => {
    const s = (status || 'pending').toLowerCase();
    const base = "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[10px] uppercase tracking-wider font-semibold ";
    switch (s) {
      case 'pending':
        return base + "bg-amber-50 text-amber-800 border border-amber-200/50";
      case 'confirmed':
        return base + "bg-blue-50 text-blue-800 border border-blue-200/50";
      case 'packed':
      case 'processing':
        return base + "bg-purple-50 text-purple-800 border border-purple-200/50";
      case 'shipped':
        return base + "bg-indigo-50 text-shipped text-indigo-800 border border-indigo-200/50";
      case 'out_for_delivery':
        return base + "bg-orange-50 text-orange-800 border border-orange-200/50";
      case 'delivered':
        return base + "bg-emerald-50 text-emerald-800 border border-emerald-200/50";
      case 'cancelled':
        return base + "bg-stone-100 text-stone-700 border border-stone-300/40";
      case 'return_requested':
        return base + "bg-rose-50 text-rose-800 border border-rose-100";
      case 'returned':
        return base + "bg-rose-100 text-rose-900 border border-rose-200";
      case 'refunded':
        return base + "bg-stone-200 text-stone-800 border border-stone-300";
      default:
        return base + "bg-zinc-100 text-zinc-800 border border-zinc-200";
    }
  };

  // Helper for Payment Status Badge styling
  const getPaymentStatusBadge = (status: string) => {
    const s = (status || 'pending').toLowerCase();
    const base = "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-[10px] font-bold uppercase tracking-wider ";
    switch (s) {
      case 'captured':
      case 'paid':
      case 'cod_collected':
      case 'cod_settled':
        return base + "bg-emerald-100 text-emerald-900 border border-emerald-200";
      case 'failed':
        return base + "bg-rose-100 text-rose-900 border border-rose-200";
      case 'refunded':
        return base + "bg-stone-200 text-stone-800 border border-stone-300";
      case 'pending':
      case 'cod_pending':
        return base + "bg-amber-100 text-amber-900 border border-amber-200";
      default:
        return base + "bg-zinc-100 text-zinc-900 border border-zinc-200";
    }
  };

  // Check state machine: can cancel?
  const canCancel = (status: string) => {
    const s = (status || '').toLowerCase();
    return ['pending', 'confirmed', 'packed', 'processing'].includes(s);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1C1917]/10 pb-5">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#1C1917] font-normal tracking-wide">
            Fulfillment & Order Control Center
          </h1>
          <p className="text-xs text-[#57534E] mt-1.5 font-normal max-w-2xl leading-relaxed">
            Manage real customer orders, immutable address snapshots, and monitor server-verified payments from a single unified workspace.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
        <button onClick={exportOrdersExcel} title="Export all orders matching the current filters, including GST breakdown" className="px-3 py-2.5 bg-[#F4EFE6] border border-[#1C1917]/15 rounded-xs text-[#1C1917] text-[11px] font-semibold hover:bg-[#ECE5D8]">Export Excel</button>
        <button
          onClick={fetchOrdersList}
          title="Refresh real-time data"
          className="p-2.5 bg-[#FAF8F5] border border-[#1C1917]/15 rounded-xs hover:bg-[#F4EFE6] text-[#57534E] transition-colors cursor-pointer self-start sm:self-auto flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Sync List</span>
        </button>
        </div>
      </div>

      {/* ORDER VIEW TABS: real orders first; unpaid / failed checkouts are kept separate */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Order views">
          {([
            { id: 'confirmed', label: 'Confirmed orders', count: viewCounts.confirmed },
            { id: 'awaiting', label: 'Awaiting payment', count: viewCounts.awaiting },
            { id: 'failed', label: 'Failed / abandoned payments', count: viewCounts.failed },
            { id: 'all', label: 'All', count: null as number | null },
          ] as Array<{ id: OrderView; label: string; count: number | null }>).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={orderView === tab.id}
              onClick={() => setOrderView(tab.id)}
              className={`px-3.5 py-2 text-xs rounded-xs border transition-colors cursor-pointer ${
                orderView === tab.id
                  ? 'bg-[#1C1917] text-[#FAF8F5] border-[#1C1917]'
                  : 'bg-[#FAF8F5] text-[#57534E] border-[#1C1917]/15 hover:border-[#B88E3E]'
              }`}
            >
              {tab.label}{tab.count !== null ? ` (${tab.count})` : ''}
            </button>
          ))}
        </div>
        {orderView === 'confirmed' && (
          <p className="text-[11px] text-[#78716C]">Paid online orders and Cash on Delivery orders. Stock is deducted for these orders.</p>
        )}
        {orderView === 'awaiting' && (
          <p className="text-[11px] text-[#78716C]">Customers who are on the payment step right now. The item is held for a short time, then released automatically if they do not pay.</p>
        )}
        {orderView === 'failed' && (
          <p className="text-[11px] text-[#78716C]">Payment failed, was cancelled, or the customer left. Stock has already been released. These are not orders to ship.</p>
        )}
      </div>

      {/* SEARCH, FILTER & QUERY WORKSPACE */}
      <div className="bg-[#FAF8F5] p-5 rounded-xs border border-[#1C1917]/10 space-y-4 shadow-2xs">
        <div className="flex items-center gap-2 text-xs text-[#967029] font-medium uppercase tracking-[0.1em]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Search & Refine Loom Orders</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
          {/* Text Search */}
          <div className="relative lg:col-span-4">
            <Search className="w-4 h-4 text-[#78716C] absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order #, name, email, phone..."
              className="w-full bg-[#F4EFE6] text-xs text-[#1C1917] placeholder-[#78716C]/70 pl-9 pr-3 py-2.5 rounded-xs border border-transparent focus:border-[#B88E3E] focus:outline-none"
            />
          </div>

          {/* Order Status */}
          <div className="lg:col-span-2 text-xs">
            <select
              value={orderStatus}
              onChange={(e) => setOrderStatus(e.target.value)}
              className="w-full bg-[#F4EFE6] text-xs text-[#1C1917] p-2.5 rounded-xs border border-transparent focus:border-[#B88E3E] focus:outline-none"
            >
              {ORDER_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Status */}
          <div className="lg:col-span-2 text-xs">
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="w-full bg-[#F4EFE6] text-xs text-[#1C1917] p-2.5 rounded-xs border border-transparent focus:border-[#B88E3E] focus:outline-none"
            >
              {PAYMENT_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Customer Type */}
          <div className="lg:col-span-2 text-xs">
            <select
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value)}
              className="w-full bg-[#F4EFE6] text-xs text-[#1C1917] p-2.5 rounded-xs border border-transparent focus:border-[#B88E3E] focus:outline-none"
            >
              {CUSTOMER_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="lg:col-span-2 text-xs">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full bg-[#F4EFE6] text-xs text-[#1C1917] p-2.5 rounded-xs border border-transparent focus:border-[#B88E3E] focus:outline-none"
            >
              {DATE_RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* RESULTS LIST TABLE */}
      <div className="bg-[#FAF8F5] rounded-xs border border-[#1C1917]/10 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[900px] border-collapse">
            <thead className="bg-[#F4EFE6] text-[#78716C] uppercase text-[10px] tracking-wider border-b border-[#1C1917]/15">
              <tr>
                <th className="px-5 py-3.5 font-semibold text-center w-12">Action</th>
                <th className="px-5 py-3.5 font-semibold">Order Number</th>
                <th className="px-4 py-3.5 font-semibold">Date Placed</th>
                <th className="px-4 py-3.5 font-semibold">Client Identity</th>
                <th className="px-4 py-3.5 font-semibold">Method</th>
                <th className="px-4 py-3.5 font-semibold">Payment Status</th>
                <th className="px-4 py-3.5 font-semibold">Fulfillment Status</th>
                <th className="px-4 py-3.5 font-semibold text-right">Items</th>
                <th className="px-5 py-3.5 font-semibold text-right">Grand Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C1917]/10">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-16 text-center text-[#78716C]">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="w-5 h-5 animate-spin text-[#967029]" />
                      <p className="font-serif italic text-sm">Retrieving real-time order ledgers...</p>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-16 text-center text-[#78716C]">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <ShoppingBag className="w-6 h-6 text-[#967029] opacity-70" />
                      <p className="font-serif italic text-sm text-[#1C1917]">No Matching Orders Found</p>
                      <p className="text-[11px] leading-relaxed">No transactions exist in the database matching your search or filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <React.Fragment key={ord.id}>
                  <tr className="hover:bg-[#F4EFE6]/30 transition-colors">
                    {/* Actions */}
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => {
                          const isClosing = selectedOrderId === ord.id;
                          setSelectedOrderId(isClosing ? null : ord.id);
                          setShowDetailsDrawer(false);
                        }}
                        aria-expanded={selectedOrderId === ord.id}
                        title={selectedOrderId === ord.id ? 'Collapse order details' : 'Expand order details'}
                        className="p-1.5 bg-[#FAF8F5] border border-[#1C1917]/15 rounded-xs hover:bg-[#F4EFE6] text-[#967029] transition-colors cursor-pointer flex items-center justify-center mx-auto"
                      >
                        {selectedOrderId === ord.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </td>

                    {/* Order # */}
                    <td className="px-5 py-3.5 font-mono font-bold text-[#1C1917] tracking-wider">
                      {ord.orderNumber}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3.5 text-[#57534E]">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar className="w-3.5 h-3.5 text-[#78716C]" />
                        <span>
                          {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        <span className="text-[10px] text-[#78716C]">
                          {new Date(ord.createdAt).toLocaleTimeString('en-IN', {
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </td>

                    {/* Patron Name / Guest */}
                    <td className="px-4 py-3.5 text-[#1C1917]">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-xs">
                            {ord.customerName}
                          </p>
                          {ord.isGuest ? (
                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded-xs bg-[#E7E5E4] text-[#57534E] font-semibold border border-stone-200">
                              Guest
                            </span>
                          ) : (
                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded-xs bg-[#B88E3E]/10 text-[#967029] font-semibold border border-[#B88E3E]/20">
                              Registered
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#78716C] line-clamp-1">{ord.customerEmail}</p>
                      </div>
                    </td>

                    {/* Payment Method */}
                    <td className="px-4 py-3.5 text-[11px] text-[#57534E] font-medium uppercase tracking-wide">
                      {ord.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Razorpay Online'}
                    </td>

                    {/* Payment Status */}
                    <td className="px-4 py-3.5">
                      <span className={getPaymentStatusBadge(ord.paymentStatus)}>
                        {ord.paymentStatus === 'captured' ? 'Paid / Captured' : ord.paymentStatus}
                      </span>
                    </td>

                    {/* Fulfillment Status */}
                    <td className="px-4 py-3.5">
                      <span className={getOrderStatusBadge(ord.orderStatus)}>
                        {ord.orderStatus}
                      </span>
                    </td>

                    {/* Item count */}
                    <td className="px-4 py-3.5 text-right font-medium text-[#57534E]">
                      {ord.itemsCount} {ord.itemsCount === 1 ? 'item' : 'items'}
                    </td>

                    {/* Amount */}
                    <td className="px-5 py-3.5 font-bold text-right text-[#1C1917] tabular-nums text-xs">
                      {formatPrice(ord.totalAmount)}
                    </td>
                  </tr>
                  {selectedOrderId === ord.id && (
                    <tr className="bg-[#FAF8F5] border-b-2 border-[#B88E3E]/40">
                      <td colSpan={9} className="px-5 py-5">
                        {loadingDetails || selectedOrder?.id !== ord.id ? (
                          <div className="flex items-center gap-2 text-xs text-[#78716C]"><RefreshCw className="w-4 h-4 animate-spin" />Loading order items and payment snapshot…</div>
                        ) : selectedOrder ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="p-3 border border-[#1C1917]/10 bg-white rounded-xs"><p className="text-[10px] uppercase tracking-wider text-[#78716C]">Order Total</p><p className="mt-1 text-lg font-bold text-[#78281F] tabular-nums">{formatPrice(selectedOrder.totalAmount)}</p></div>
                              <div className="p-3 border border-[#1C1917]/10 bg-white rounded-xs"><p className="text-[10px] uppercase tracking-wider text-[#78716C]">Payment</p><p className="mt-1 font-semibold text-[#1C1917]">{String(selectedOrder.paymentStatus || 'pending').replaceAll('_', ' ')}</p><p className="text-[10px] text-[#78716C]">{selectedOrder.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online payment'}</p></div>
                              <div className="p-3 border border-[#1C1917]/10 bg-white rounded-xs"><p className="text-[10px] uppercase tracking-wider text-[#78716C]">Fulfillment</p><p className="mt-1 font-semibold text-[#1C1917]">{String(selectedOrder.orderStatus || 'pending').replaceAll('_', ' ')}</p></div>
                              <div className="p-3 border border-[#1C1917]/10 bg-white rounded-xs"><p className="text-[10px] uppercase tracking-wider text-[#78716C]">Customer</p><p className="mt-1 font-semibold text-[#1C1917]">{selectedOrder.customerName || 'Customer'}</p><p className="text-[10px] text-[#78716C]">{selectedOrder.customerPhone || selectedOrder.customerEmail || ''}</p></div>
                            </div>
                            <div className="overflow-x-auto border border-[#1C1917]/10 rounded-xs bg-white">
                              <table className="w-full text-xs">
                                <thead className="bg-[#F4EFE6] text-[#57534E]"><tr><th className="text-left px-3 py-2">Product</th><th className="text-left px-3 py-2">SKU</th><th className="text-right px-3 py-2">Qty</th><th className="text-right px-3 py-2">Unit price</th><th className="text-right px-3 py-2">Line total</th></tr></thead>
                                <tbody className="divide-y divide-[#1C1917]/10">{(selectedOrder.items || []).map((item: any, idx: number) => <tr key={item.id || `${item.sku}-${idx}`}><td className="px-3 py-2.5 font-semibold text-[#1C1917]">{item.productName || 'Product'}</td><td className="px-3 py-2.5 font-mono text-[#78716C]">{item.sku || '—'}</td><td className="px-3 py-2.5 text-right">{item.quantity || 0}</td><td className="px-3 py-2.5 text-right tabular-nums">{formatPrice(item.price || 0)}</td><td className="px-3 py-2.5 text-right font-bold text-[#78281F] tabular-nums">{formatPrice(item.totalAmount ?? (Number(item.price || 0) * Number(item.quantity || 0)))}</td></tr>)}</tbody>
                              </table>
                            </div>
                            <div className="flex flex-wrap justify-between items-center gap-2"><p className="text-[11px] text-[#78716C]">{selectedOrder.courierName ? `Courier: ${selectedOrder.courierName}` : 'Courier not assigned'}{selectedOrder.trackingNumber ? ` · Tracking: ${selectedOrder.trackingNumber}` : ''}{selectedOrder.refundStatus === 'pending' ? ' · Refund review required' : ''}</p><div className="flex gap-2"><button type="button" onClick={printSelectedOrderInvoice} className="px-3 py-2 border border-[#1C1917]/20 rounded-xs text-[10px] font-semibold uppercase hover:bg-[#F4EFE6]">Invoice / PDF</button><button type="button" onClick={() => setShowDetailsDrawer(true)} className="px-3 py-2 bg-[#1C1917] text-white rounded-xs text-[10px] font-semibold uppercase">Manage fulfillment <ArrowRight className="inline w-3 h-3 ml-1" /></button></div></div>
                          </div>
                        ) : <p className="text-xs text-rose-700">Order details are unavailable. Open the row again to retry.</p>}
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {!loading && totalPages > 1 && (
          <div className="bg-[#F4EFE6] px-5 py-3.5 border-t border-[#1C1917]/10 flex items-center justify-between text-xs text-[#57534E]">
            <p className="font-medium">
              Showing page <span className="font-bold text-[#1C1917]">{page}</span> of <span className="font-bold text-[#1C1917]">{totalPages}</span> ({totalCount} total orders)
            </p>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 bg-[#FAF8F5] border border-[#1C1917]/15 rounded-xs hover:bg-[#FAF8F5]/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 text-[#1C1917]" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 bg-[#FAF8F5] border border-[#1C1917]/15 rounded-xs hover:bg-[#FAF8F5]/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 text-[#1C1917]" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DEDICATED TRANSACTION DETAILS WINDOW (MODAL DRAWER) */}
      {showDetailsDrawer && selectedOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-[#1C1917]/60 backdrop-blur-xs">
          <div className="bg-[#FAF8F5] border-l border-[#1C1917]/15 w-full max-w-3xl h-full shadow-2xl flex flex-col z-10 animate-slide-in">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#1C1917]/10 flex items-center justify-between bg-[#F4EFE6]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-serif text-lg font-bold text-[#1C1917]">
                    Transaction Ledger: {selectedOrder?.orderNumber}
                  </span>
                  {selectedOrder && (
                    <span className={getOrderStatusBadge(selectedOrder.orderStatus)}>
                      {selectedOrder.orderStatus}
                    </span>
                  )}
                </div>
                <p className="text-[10px] uppercase tracking-wider text-[#967029] font-medium mt-0.5">
                  Secure Administrative Fulfillment Review
                </p>
              </div>
              <div className="flex items-center gap-2">
              <button type="button" onClick={printSelectedOrderInvoice} disabled={!selectedOrder}
                className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider border border-[#1C1917]/20 rounded-xs hover:bg-[#FAF8F5] disabled:opacity-40">Invoice / PDF</button>
              <button
                onClick={() => setShowDetailsDrawer(false)}
                className="p-1.5 text-[#57534E] hover:text-[#1C1917] rounded-xs border border-transparent hover:border-[#1C1917]/10 cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
              </div>
            </div>

            {/* Modal Scrollable Workspace */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs sm:text-sm">
              {loadingDetails ? (
                <div className="py-24 text-center text-[#78716C] flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#967029]" />
                  <p className="font-serif italic">Loading detailed order snapshot...</p>
                </div>
              ) : !selectedOrder ? (
                <div className="py-16 text-center space-y-4">
                  <AlertCircle className="w-8 h-8 mx-auto text-rose-600" />
                  <h3 className="font-serif text-lg text-[#1C1917]">Could not load this order</h3>
                  <p className="text-sm text-[#57534E] max-w-md mx-auto">{errorMessage || 'The order details request did not return a usable order.'}</p>
                  <button onClick={() => selectedOrderId && void fetchSingleOrderDetails(selectedOrderId)} className="px-4 py-2 border rounded text-sm">Retry loading details</button>
                </div>
              ) : selectedOrder ? (
                <>
                  {/* Notifications inside Modal */}
                  {errorMessage && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xs flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                  {successMessage && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xs flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>{successMessage}</span>
                    </div>
                  )}

                  {/* 1. ORDER SUMMARY & CUSTOMER IDENTIFIER */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Transaction metadata */}
                    <div className="bg-[#FAF8F5] p-4 rounded-xs border border-[#1C1917]/10 space-y-2.5">
                      <h4 className="font-serif text-xs font-semibold text-[#1C1917] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#1C1917]/10 pb-2">
                        <FileText className="w-3.5 h-3.5 text-[#967029]" />
                        <span>Order Summary</span>
                      </h4>
                      <div className="space-y-1.5 text-xs text-[#57534E]">
                        <p className="flex justify-between">
                          <span className="text-[#78716C]">Order Number:</span>
                          <span className="font-mono font-bold text-[#1C1917]">{selectedOrder.orderNumber}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-[#78716C]">Placed On:</span>
                          <span className="font-medium text-[#1C1917]">{new Date(selectedOrder.createdAt).toLocaleString('en-IN')}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-[#78716C]">Fulfillment status:</span>
                          <span className="font-semibold">{selectedOrder.orderStatus}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-[#78716C]">Method:</span>
                          <span className="font-medium text-[#1C1917] uppercase">{selectedOrder.paymentMethod}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-[#78716C]">Grand Total:</span>
                          <span className="font-bold text-[#1C1917] tabular-nums">{formatPrice(selectedOrder.totalAmount)}</span>
                        </p>
                      </div>
                    </div>

                    {/* Customer identity card */}
                    <div className="bg-[#FAF8F5] p-4 rounded-xs border border-[#1C1917]/10 space-y-2.5">
                      <h4 className="font-serif text-xs font-semibold text-[#1C1917] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#1C1917]/10 pb-2">
                        <User className="w-3.5 h-3.5 text-[#967029]" />
                        <span>Customer Profile</span>
                      </h4>
                      <div className="space-y-1.5 text-xs text-[#57534E]">
                        <p className="flex justify-between">
                          <span className="text-[#78716C]">Full Name:</span>
                          <span className="font-medium text-[#1C1917]">{selectedOrder.customerName}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-[#78716C]">Email Address:</span>
                          <span className="font-medium text-[#1C1917] hover:underline">{selectedOrder.customerEmail}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-[#78716C]">Mobile:</span>
                          <span className="font-medium text-[#1C1917]">{selectedOrder.customerPhone || 'Not Provided'}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-[#78716C]">Client Class:</span>
                          <span>
                            {selectedOrder.isGuest ? 'Guest Checkout' : `Patron (${selectedOrder.userId || 'N/A'})`}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* COD collections are separate from fulfillment and are updated atomically on the server. */}
                  {selectedOrder.paymentMethod === 'cod' && (
                    <section className="bg-white p-4 rounded-xs border border-[#1C1917]/10 space-y-2.5">
                      <div className="flex items-center justify-between gap-3"><h4 className="font-serif text-sm text-[#1C1917]">Cash on Delivery Reconciliation</h4><span className={getPaymentStatusBadge(selectedOrder.paymentStatus)}>{String(selectedOrder.paymentStatus || 'pending').replaceAll('_', ' ')}</span></div>
                      <p className="text-[11px] text-[#57534E]">Record cash received only after delivery. Mark it settled after reconciling the courier/runner cash with your store accounts.</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedOrder.orderStatus === 'delivered' && ['pending','cod_pending'].includes(String(selectedOrder.paymentStatus || 'pending')) && <button type="button" disabled={isUpdatingPaymentStatus} onClick={() => void handleCodPaymentUpdate('cod_collected')} className="px-3 py-2 bg-emerald-700 text-white rounded-xs text-[10px] font-semibold uppercase disabled:opacity-50">{isUpdatingPaymentStatus ? 'Saving…' : 'Record COD collected'}</button>}
                        {selectedOrder.paymentStatus === 'cod_collected' && <button type="button" disabled={isUpdatingPaymentStatus} onClick={() => void handleCodPaymentUpdate('cod_settled')} className="px-3 py-2 bg-[#1C1917] text-white rounded-xs text-[10px] font-semibold uppercase disabled:opacity-50">{isUpdatingPaymentStatus ? 'Saving…' : 'Mark COD settled'}</button>}
                        {selectedOrder.refundStatus === 'pending' && <p className="self-center text-[11px] font-semibold text-rose-700">Refund review pending — the order cancellation did not issue a refund automatically.</p>}
                      </div>
                    </section>
                  )}

                  {selectedOrder.refundStatus && selectedOrder.refundStatus !== 'not_applicable' && (
                    <section className="bg-rose-50/70 p-4 rounded-xs border border-rose-200 space-y-3">
                      <div className="flex items-center justify-between gap-3"><h4 className="font-serif text-sm text-[#1C1917]">Refund Reconciliation</h4><span className="px-2 py-1 border border-rose-200 bg-white text-rose-800 rounded-xs text-[10px] uppercase font-bold">{selectedOrder.refundStatus}</span></div>
                      <p className="text-[11px] text-[#57534E]">Use this ledger only after performing or attempting the refund through your payment provider or manual process. It does not initiate a transfer.</p>
                      <div className="flex flex-wrap gap-2">
                        {['pending','failed'].includes(selectedOrder.refundStatus) && <button type="button" disabled={isUpdatingPaymentStatus} onClick={() => void handleRefundStatusUpdate('processing')} className="px-3 py-2 bg-[#1C1917] text-white rounded-xs text-[10px] font-semibold uppercase disabled:opacity-50">Start / retry refund</button>}
                        {['pending','processing'].includes(selectedOrder.refundStatus) && <button type="button" disabled={isUpdatingPaymentStatus} onClick={() => void handleRefundStatusUpdate('completed')} className="px-3 py-2 bg-emerald-700 text-white rounded-xs text-[10px] font-semibold uppercase disabled:opacity-50">Record refund completed</button>}
                        {['pending','processing'].includes(selectedOrder.refundStatus) && <button type="button" disabled={isUpdatingPaymentStatus} onClick={() => void handleRefundStatusUpdate('failed')} className="px-3 py-2 border border-rose-300 text-rose-800 rounded-xs text-[10px] font-semibold uppercase disabled:opacity-50">Record failed</button>}
                      </div>
                    </section>
                  )}

                  {/* 2. STATE MACHINE FULFILLMENT LIFECYCLE CONTROLLER */}
                  <div className="bg-[#F4EFE6] p-4 rounded-xs border border-[#1C1917]/15 space-y-3.5">
                    <div className="flex items-center gap-1.5 text-[#967029] font-bold text-xs uppercase tracking-wider">
                      <Package className="w-4 h-4 text-[#967029]" />
                      <span>Fulfillment Status transitions Control</span>
                    </div>

                    {/* Transition actions */}
                    <div className="space-y-3 text-xs">
                      <p className="text-[11px] text-[#57534E] leading-relaxed">
                        Transition the order status according to official business processes. The state machine enforces sequential transitions:
                        <span className="font-semibold block mt-0.5 text-[#1C1917]">Pending ➔ Confirmed ➔ Packed ➔ Shipped ➔ Out for Delivery ➔ Delivered</span>
                      </p>

                      <div className="flex flex-wrap items-center gap-2 pt-1.5">
                        {/* pending -> confirmed */}
                        {selectedOrder.orderStatus === 'pending' && (
                          <button
                            disabled={isUpdatingStatus}
                            onClick={() => handleStatusTransition('confirmed')}
                            className="px-3 py-1.5 bg-[#1C1917] hover:bg-[#2E2926] text-[#FAF8F5] rounded-xs font-semibold cursor-pointer tracking-wider uppercase text-[10px] flex items-center gap-1"
                          >
                            <span>Confirm Order</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}

                        {/* confirmed -> packed */}
                        {selectedOrder.orderStatus === 'confirmed' && (
                          <button
                            disabled={isUpdatingStatus}
                            onClick={() => handleStatusTransition('packed')}
                            className="px-3 py-1.5 bg-[#1C1917] hover:bg-[#2E2926] text-[#FAF8F5] rounded-xs font-semibold cursor-pointer tracking-wider uppercase text-[10px] flex items-center gap-1"
                          >
                            <span>Mark as Packed</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}

                        {/* packed -> shipped */}
                        {(selectedOrder.orderStatus === 'packed' || selectedOrder.orderStatus === 'processing') && (
                          <button
                            disabled={isUpdatingStatus}
                            onClick={() => handleStatusTransition('shipped')}
                            className="px-3 py-1.5 bg-[#1C1917] hover:bg-[#2E2926] text-[#FAF8F5] rounded-xs font-semibold cursor-pointer tracking-wider uppercase text-[10px] flex items-center gap-1"
                          >
                            <span>Mark as Shipped</span>
                            <Truck className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* shipped -> out_for_delivery */}
                        {selectedOrder.orderStatus === 'shipped' && (
                          <button
                            disabled={isUpdatingStatus}
                            onClick={() => handleStatusTransition('out_for_delivery')}
                            className="px-3 py-1.5 bg-[#1C1917] hover:bg-[#2E2926] text-[#FAF8F5] rounded-xs font-semibold cursor-pointer tracking-wider uppercase text-[10px] flex items-center gap-1"
                          >
                            <span>Dispatch Out for Delivery</span>
                            <Truck className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* out_for_delivery -> delivered */}
                        {selectedOrder.orderStatus === 'out_for_delivery' && (
                          <button
                            disabled={isUpdatingStatus}
                            onClick={() => handleStatusTransition('delivered')}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-[#FAF8F5] rounded-xs font-semibold cursor-pointer tracking-wider uppercase text-[10px] flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Mark as Delivered</span>
                          </button>
                        )}

                        {/* delivered -> return_requested */}
                        {selectedOrder.orderStatus === 'delivered' && (
                          <button
                            disabled={isUpdatingStatus}
                            onClick={() => handleStatusTransition('return_requested')}
                            className="px-3 py-1.5 bg-rose-50 text-rose-800 border border-rose-300 rounded-xs font-semibold cursor-pointer tracking-wider uppercase text-[10px] flex items-center gap-1"
                          >
                            <CornerDownLeft className="w-3.5 h-3.5" />
                            <span>Log Return Request</span>
                          </button>
                        )}

                        {/* return_requested -> returned */}
                        {selectedOrder.orderStatus === 'return_requested' && (
                          <button
                            disabled={isUpdatingStatus}
                            onClick={() => handleStatusTransition('returned')}
                            className="px-3 py-1.5 bg-rose-100 text-rose-900 border border-rose-300 rounded-xs font-semibold cursor-pointer tracking-wider uppercase text-[10px] flex items-center gap-1"
                          >
                            <CornerDownLeft className="w-3.5 h-3.5" />
                            <span>Process Return Receipt</span>
                          </button>
                        )}

                        {/* Order Cancellation (Only allowed before shipped) */}
                        {canCancel(selectedOrder.orderStatus) && (
                          <button
                            disabled={isUpdatingStatus}
                            onClick={() => setShowCancelConfirm(true)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-[#FAF8F5] rounded-xs font-semibold cursor-pointer tracking-wider uppercase text-[10px] flex items-center gap-1 ml-auto"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Cancel Order</span>
                          </button>
                        )}
                      </div>

                      {/* Transition Notes input */}
                      <div className="pt-2 border-t border-[#1C1917]/10 flex flex-col gap-1.5">
                        <label className="block text-[11px] font-semibold text-[#1C1917]">
                          Fulfillment / Transition Remarks (logged in timeline)
                        </label>
                        <input
                          type="text"
                          value={transitionNotes}
                          onChange={(e) => setTransitionNotes(e.target.value)}
                          placeholder="e.g. Package dispatched via local courier partner..."
                          className="w-full bg-[#FAF8F5] text-xs px-3 py-2 rounded-xs border border-[#1C1917]/20 focus:border-[#967029] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. IMMUTABLE ADDRESS SNAPSHOT REVIEW */}
                  {selectedOrder.shippingAddressSnapshot && (
                    <div className="bg-[#FAF8F5] p-4 rounded-xs border border-[#1C1917]/10 space-y-2">
                      <div className="flex items-center gap-1.5 text-[#967029] font-bold text-xs uppercase tracking-wider">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Immutable Shipping Snapshot</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#57534E] leading-relaxed pt-1">
                        <div>
                          <p className="font-semibold text-[#1C1917]">{isStorePickup(selectedOrder.shippingAddressSnapshot) ? 'Store Pickup (buy from shop, no delivery)' : 'Delivery Destination'}</p>
                          <p className="mt-0.5">{selectedOrder.shippingAddressSnapshot.recipientName}</p>
                          <p>{selectedOrder.shippingAddressSnapshot.addressLine1}</p>
                          {selectedOrder.shippingAddressSnapshot.addressLine2 && <p>{selectedOrder.shippingAddressSnapshot.addressLine2}</p>}
                          {selectedOrder.shippingAddressSnapshot.landmark && <p className="italic text-[#78716C]">Landmark: {selectedOrder.shippingAddressSnapshot.landmark}</p>}
                          <p>{formatCityLine(selectedOrder.shippingAddressSnapshot)}</p>
                          <p className="mt-1 font-medium text-[#1C1917]">Phone: {selectedOrder.shippingAddressSnapshot.phone}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-[#1C1917]">Billing Destination</p>
                          {selectedOrder.billingAddressSnapshot ? (
                            <>
                              <p className="mt-0.5">{selectedOrder.billingAddressSnapshot.recipientName}</p>
                              <p>{selectedOrder.billingAddressSnapshot.addressLine1}</p>
                              {selectedOrder.billingAddressSnapshot.addressLine2 && <p>{selectedOrder.billingAddressSnapshot.addressLine2}</p>}
                              <p>{formatCityLine(selectedOrder.billingAddressSnapshot)}</p>
                              <p className="mt-1 font-medium text-[#1C1917]">Phone: {selectedOrder.billingAddressSnapshot.phone}</p>
                            </>
                          ) : (
                            <p className="mt-0.5 text-[#78716C] italic">Same as delivery destination snapshot.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Manual courier / tracking configuration */}
                  <section className="bg-[#FAF8F5] p-4 rounded-xs border border-[#1C1917]/10 space-y-3">
                    <h4 className="font-serif text-xs font-semibold text-[#1C1917] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#1C1917]/10 pb-2"><Truck className="w-3.5 h-3.5 text-[#967029]"/> Courier & Tracking</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <label className="text-[11px] text-[#57534E]">Courier partner<input value={courierName} onChange={e=>setCourierName(e.target.value)} placeholder="e.g. Delhivery / India Post" className="mt-1 w-full p-2 bg-white border border-[#1C1917]/15 rounded-xs"/></label>
                      <label className="text-[11px] text-[#57534E]">AWB / tracking number<input value={trackingNumber} onChange={e=>setTrackingNumber(e.target.value)} placeholder="Shipment reference" className="mt-1 w-full p-2 bg-white border border-[#1C1917]/15 rounded-xs"/></label>
                      <label className="text-[11px] text-[#57534E]">Tracking URL<input type="url" value={trackingUrl} onChange={e=>setTrackingUrl(e.target.value)} placeholder="https://..." className="mt-1 w-full p-2 bg-white border border-[#1C1917]/15 rounded-xs"/></label>
                    </div>
                    <div className="flex items-center justify-between gap-3"><p className="text-[10px] text-[#78716C]">Manual entry only; courier API integration is not enabled.</p><button type="button" disabled={isSavingShipment} onClick={handleSaveShipment} className="px-3 py-2 bg-[#1C1917] text-white rounded-xs text-[10px] font-semibold uppercase tracking-wider disabled:opacity-50">{isSavingShipment?'Saving…':'Save Tracking'}</button></div>
                    {selectedOrder.trackingUrl && <a href={selectedOrder.trackingUrl} target="_blank" rel="noreferrer" className="inline-block text-xs text-[#78281F] underline">Open customer tracking page</a>}
                  </section>

                  {/* 4. HISTORICAL ORDER ITEMS snapshot DISPLAY */}
                  <div className="bg-[#FAF8F5] p-4 rounded-xs border border-[#1C1917]/10 space-y-3">
                    <h4 className="font-serif text-xs font-semibold text-[#1C1917] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#1C1917]/10 pb-2">
                      <ShoppingBag className="w-4 h-4 text-[#967029]" />
                      <span>Purchased Handloom Line Items</span>
                    </h4>

                    <div className="divide-y divide-[#1C1917]/10 text-xs">
                      {(selectedOrder.items || []).map((item: any, idx: number) => (
                        <div key={idx} className="py-3 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-16 bg-[#F4EFE6] rounded-xs border border-[#1C1917]/10 overflow-hidden shrink-0">
                              <img
                                src={normalizeImageUrl(item.primaryImage || '/src/assets/images/hero_vastram_saree_1791192126882.jpg')}
                                alt={item.productName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="space-y-0.5">
                              <p className="font-medium text-[#1C1917] text-xs">
                                {item.productName}
                              </p>
                              <p className="text-[10px] text-[#78716C] font-mono tracking-wider">
                                SKU: {item.sku}
                              </p>
                              <p className="text-[10px] text-[#967029] font-medium uppercase tracking-wider">
                                {item.productMetadata?.color && `Color: ${item.productMetadata.color}`}
                                {item.productMetadata?.size && ` · Size: ${item.productMetadata.size}`}
                                {item.productMetadata?.category && ` · Category: ${item.productMetadata.category}`}
                              </p>
                              {item.productMetadata?.includeFallPico === true && <p className="text-[10px] font-semibold text-[#78281F]">Fall & Pico finishing — included in saved line price</p>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-[#1C1917] tracking-wide font-bold">
                              {item.quantity} × {formatPrice(item.price)}
                            </p>
                            <p className="text-[10px] text-[#78716C] mt-0.5">
                              Snapshot line total: <span className="font-semibold text-[#1C1917]">{formatPrice(item.price * item.quantity)}</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 5. PAYMENTS & FINANCIAL SUMMARY LEDGER */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Financial stats */}
                    <div className="bg-[#FAF8F5] p-4 rounded-xs border border-[#1C1917]/10 space-y-2.5">
                      <h4 className="font-serif text-xs font-semibold text-[#1C1917] uppercase tracking-wider border-b border-[#1C1917]/10 pb-2">
                        Financial Summary
                      </h4>
                      <div className="space-y-1.5 text-xs text-[#57534E]">
                        <p className="flex justify-between">
                          <span className="text-[#78716C]">Subtotal:</span>
                          <span className="font-medium text-[#1C1917] font-mono">{formatPrice(selectedOrder.subtotal)}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-[#78716C]">Discounts:</span>
                          <span className="font-medium text-rose-700 font-mono">- {formatPrice(selectedOrder.discountAmount || 0)}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-[#78716C]">Shipping Charge:</span>
                          <span className="font-medium text-[#1C1917] font-mono">{formatPrice(selectedOrder.shippingAmount || 0)}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-[#78716C]">Tax / GST:</span>
                          <span className="font-medium text-[#1C1917] font-mono">{formatPrice(selectedOrder.taxAmount || 0)}</span>
                        </p>
                        <div className="border-t border-[#1C1917]/10 pt-2 flex justify-between font-bold text-[#1C1917]">
                          <span>Grand Total:</span>
                          <span className="font-serif text-sm tabular-nums">{formatPrice(selectedOrder.totalAmount)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Verified Payment status */}
                    <div className="bg-[#FAF8F5] p-4 rounded-xs border border-[#1C1917]/10 space-y-2.5">
                      <h4 className="font-serif text-xs font-semibold text-[#1C1917] uppercase tracking-wider flex items-center gap-1 border-b border-[#1C1917]/10 pb-2">
                        <CreditCard className="w-4 h-4 text-[#967029]" />
                        <span>Payment Verification</span>
                      </h4>
                      <div className="space-y-1.5 text-xs text-[#57534E]">
                        <p className="flex justify-between items-center">
                          <span className="text-[#78716C]">Current Payment Status:</span>
                          <span className={getPaymentStatusBadge(selectedOrder.paymentStatus)}>
                            {selectedOrder.paymentStatus}
                          </span>
                        </p>
                        {selectedOrder.payment?.providerOrderId && (
                          <p className="flex justify-between">
                            <span className="text-[#78716C]">Razorpay Order ID:</span>
                            <span className="font-mono font-medium text-[#1C1917] tracking-tight">{selectedOrder.payment.providerOrderId}</span>
                          </p>
                        )}
                        {selectedOrder.payment?.providerPaymentId && (
                          <p className="flex justify-between">
                            <span className="text-[#78716C]">Razorpay Payment ID:</span>
                            <span className="font-mono font-medium text-[#1C1917] tracking-tight">{selectedOrder.payment.providerPaymentId}</span>
                          </p>
                        )}
                        {selectedOrder.payment?.verifiedAt && (
                          <p className="flex justify-between">
                            <span className="text-[#78716C]">Server Verified At:</span>
                            <span className="font-medium text-[#1C1917]">{new Date(selectedOrder.payment.verifiedAt).toLocaleString('en-IN')}</span>
                          </p>
                        )}
                        <p className="flex justify-between">
                          <span className="text-[#78716C]">Captured Timestamp:</span>
                          <span className="font-medium text-[#1C1917]">
                            {selectedOrder.payment?.createdAt ? new Date(selectedOrder.payment.createdAt).toLocaleString('en-IN') : 'N/A'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 6. INTERNAL ORDER NOTES SECTION (ADMIN ONLY) */}
                  <div className="bg-[#FAF8F5] p-4 rounded-xs border border-[#1C1917]/10 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-[#1C1917]/10 pb-2">
                      <div className="flex items-center gap-1 text-stone-800 font-bold text-xs uppercase tracking-wider">
                        <ShieldCheck className="w-4 h-4 text-[#967029]" />
                        <span>Internal Order Notes (Admin Only)</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-rose-800 bg-rose-50 border border-rose-200/50 px-1.5 py-0.5 rounded-xs">
                        Confidential
                      </span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <p className="text-[11px] text-[#78716C] leading-relaxed">
                        Add confidential reminders, courier notes, packing instructions, or logistics updates. These records are strictly invisible to customers on the storefront.
                      </p>
                      <textarea
                        rows={3}
                        value={adminNotesText}
                        onChange={(e) => setAdminNotesText(e.target.value)}
                        placeholder="Type packing instructions or operational notes here..."
                        className="w-full bg-[#F4EFE6] text-xs px-3.5 py-2.5 rounded-xs border border-[#1C1917]/20 focus:border-[#967029] focus:outline-none"
                      />
                      <div className="flex justify-end">
                        <button
                          disabled={isUpdatingNotes}
                          onClick={handleSaveAdminNotes}
                          className="px-4 py-1.5 bg-[#1C1917] hover:bg-[#2E2926] text-[#FAF8F5] rounded-xs font-semibold cursor-pointer text-xs uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isUpdatingNotes ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>Save Confidential Notes</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 7. SECURE AUDIT TIMELINE HISTORY */}
                  <div className="bg-[#FAF8F5] p-4 rounded-xs border border-[#1C1917]/10 space-y-3">
                    <div className="flex items-center gap-1.5 text-stone-800 font-bold text-xs uppercase tracking-wider border-b border-[#1C1917]/10 pb-2">
                      <History className="w-4 h-4 text-[#967029]" />
                      <span>Order history & event Audit Timeline</span>
                    </div>

                    <div className="space-y-4 relative pl-3.5 border-l border-[#1C1917]/15 py-1.5 text-xs">
                      {selectedOrder.timeline && selectedOrder.timeline.length > 0 ? (
                        selectedOrder.timeline.map((event: any, idx: number) => (
                          <div key={idx} className="relative space-y-1">
                            {/* Dot indicator */}
                            <span className="absolute -left-[19.5px] top-1.5 w-2 h-2 rounded-full bg-[#967029] border border-[#FAF8F5] outline-4 outline-[#F4EFE6]" />
                            <div className="flex items-center justify-between text-[11px] font-semibold text-[#1C1917]">
                              <p className="text-[#1C1917] font-serif uppercase tracking-wider">{event.status}</p>
                              <p className="text-[#78716C] font-mono tracking-tight">{new Date(event.createdAt || event.created_at).toLocaleString('en-IN')}</p>
                            </div>
                            <p className="text-[11px] text-[#57534E]">
                              Actor: <span className="font-semibold text-[#1C1917]">{event.actor}</span>
                            </p>
                            {event.notes && (
                              <p className="text-[11px] text-[#78716C] italic bg-[#F4EFE6]/50 p-1.5 rounded-xs mt-1 leading-relaxed">
                                &quot;{event.notes}&quot;
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-[#78716C] italic">No timeline history recorded in database.</p>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#F4EFE6] border-t border-[#1C1917]/10 flex justify-end">
              <button
                onClick={() => setShowDetailsDrawer(false)}
                className="px-5 py-2 border border-[#1C1917]/20 rounded-xs text-[#1C1917] hover:bg-[#FAF8F5] font-semibold cursor-pointer text-xs uppercase tracking-wider transition-all"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelConfirm && selectedOrder && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1C1917]/65 p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-order-title">
          <div className="w-full max-w-lg bg-[#FAF8F5] border border-rose-200 rounded-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3"><AlertCircle className="w-6 h-6 text-rose-600 shrink-0"/><div><h2 id="cancel-order-title" className="font-serif text-xl text-[#1C1917]">Cancel order {selectedOrder.orderNumber}?</h2><p className="mt-1 text-sm text-[#57534E]">This action will update the customer-visible order status and reconcile inventory.</p></div></div>
            <div className="bg-white border border-[#1C1917]/10 p-3 text-sm space-y-1"><p><strong>Order total:</strong> {formatPrice(selectedOrder.totalAmount)}</p><p><strong>Payment:</strong> {selectedOrder.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online'} · {String(selectedOrder.paymentStatus || 'pending').replaceAll('_', ' ')}</p>{['captured','cod_collected','cod_settled'].includes(String(selectedOrder.paymentStatus)) ? <p className="text-rose-700 font-medium">Payment follow-up will be flagged as pending. This action does not automatically refund money.</p> : <p className="text-[#57534E]">No payment refund is recorded for this pending payment.</p>}</div>
            <p className="text-xs text-[#78716C]">Cancellation is only available before dispatch. Once confirmed, stock reconciliation and the audit event are handled by the database transaction.</p>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowCancelConfirm(false)} className="px-4 py-2 border border-[#1C1917]/20 rounded-xs text-sm">Keep order</button><button type="button" disabled={isUpdatingStatus} onClick={() => void handleStatusTransition('cancelled')} className="px-4 py-2 bg-rose-600 text-white rounded-xs text-sm font-semibold disabled:opacity-50">{isUpdatingStatus ? 'Cancelling…' : 'Confirm cancellation'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
