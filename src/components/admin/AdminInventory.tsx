import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Boxes,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  PlusCircle,
  MinusCircle,
  Search,
  SlidersHorizontal,
  X,
  History,
  Lock,
  ShoppingBag,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Save,
  Clock,
  User,
  FileText,
} from 'lucide-react';
import { adminService, InventoryItem } from '../../services/adminService';
import { Button } from '../ui/Button';
import { formatPrice } from '../ui/PriceDisplay';

export const AdminInventory: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<{
    totalProducts?: number;
    totalVariants?: number;
    inStockCount?: number;
    lowStockCount?: number;
    outOfStockCount?: number;
    totalReserved?: number;
    totalSold?: number;
    totalPhysical?: number;
  }>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Adjustment Modal State
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove'>('add');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(1);
  const [movementReason, setMovementReason] = useState<'purchase' | 'damage' | 'adjustment' | 'return'>('purchase');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Detail & Historical Movement Drawer State
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);
  const [itemMovements, setItemMovements] = useState<any[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [editableThreshold, setEditableThreshold] = useState<number>(5);
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [thresholdMessage, setThresholdMessage] = useState('');

  const fetchLedger = async () => {
    setLoading(true);
    const data = await adminService.getInventoryLedger();
    setItems(data.items || []);
    if (data.summary) {
      setSummary(data.summary);
    } else {
      const list = data.items || [];
      const uniqueProds = new Set(list.map((i) => i.productId));
      setSummary({
        totalProducts: uniqueProds.size,
        totalVariants: list.length,
        inStockCount: list.filter((i) => i.status === 'in_stock').length,
        lowStockCount: list.filter((i) => i.status === 'low_stock').length,
        outOfStockCount: list.filter((i) => i.status === 'out_of_stock').length,
        totalReserved: list.reduce((s, i) => s + (i.reservedQuantity || 0), 0),
        totalSold: list.reduce((s, i) => s + (i.soldQuantity || 0), 0),
        totalPhysical: list.reduce((s, i) => s + (i.stockQuantity || 0), 0),
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const exportInventoryExcel = () => {
    const rows = items.map((i: any) => ({ 'Product ID': i.productId || '', 'Product': i.productName || i.name || '', 'Variant ID': i.variantId || '', SKU: i.sku || '', Variant: i.variantName || i.variant || '', 'Physical Stock': Number(i.stockQuantity || 0), 'Reserved': Number(i.reservedQuantity || 0), 'Sold': Number(i.soldQuantity || 0), 'Available': Number(i.availableQuantity ?? ((i.stockQuantity || 0) - (i.reservedQuantity || 0))), 'Low Stock Threshold': Number(i.lowStockThreshold || 0), Status: i.status || '' }));
    if (!rows.length) { setFeedback('No inventory rows loaded to export.'); return; }
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Inventory'); XLSX.writeFile(wb, `vk-vastram-inventory-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const openDetailModal = async (item: InventoryItem) => {
    setDetailItem(item);
    setEditableThreshold(item.lowStockThreshold || 5);
    setThresholdMessage('');
    setLoadingMovements(true);
    const moves = await adminService.getInventoryMovements(item.variantId);
    setItemMovements(moves);
    setLoadingMovements(false);
  };

  const handleSaveThreshold = async () => {
    if (!detailItem) return;
    setThresholdSaving(true);
    setThresholdMessage('');
    const success = await adminService.updateLowStockThreshold(detailItem.variantId, editableThreshold);
    setThresholdSaving(false);
    if (success) {
      setThresholdMessage(`Threshold updated to ${editableThreshold} units.`);
      fetchLedger();
    } else {
      setThresholdMessage('Failed to update threshold.');
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem || adjustQuantity <= 0) return;

    if (!notes.trim()) {
      setFeedback('Audit notes / reason are strictly required for inventory movements.');
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    const delta = adjustmentType === 'add' ? adjustQuantity : -adjustQuantity;
    const movementType =
      adjustmentType === 'add'
        ? movementReason
        : movementReason === 'purchase'
        ? 'damage'
        : movementReason;

    const res = await adminService.adjustStock(
      adjustingItem.variantId,
      delta,
      movementType as any,
      notes.trim()
    );

    setSubmitting(false);

    if (res.success) {
      setFeedback(`Stock updated successfully. New count: ${res.newStock} units.`);
      setTimeout(() => {
        setAdjustingItem(null);
        setFeedback(null);
        setAdjustQuantity(1);
        setNotes('');
        fetchLedger();
      }, 1000);
    } else {
      setFeedback(res.error || 'Adjustment failed');
    }
  };

  const filteredItems = items.filter((item) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      item.productName.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      item.variantName.toLowerCase().includes(q) ||
      item.categoryLabel.toLowerCase().includes(q);

    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'reserved') return matchesSearch && item.reservedQuantity > 0;
    return matchesSearch && item.status === statusFilter;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#1C1917] font-normal">
            Inventory & Stock Ledger
          </h1>
          <p className="text-xs text-[#57534E] mt-1">
            Authoritative, audit-tracked variant stock movements, lock reservations, and loom procurement.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button onClick={exportInventoryExcel} className="px-3 py-2.5 border border-[#1C1917]/15 rounded-xs text-xs hover:bg-[#F4EFE6]">Export Excel</button>
          <button
            onClick={fetchLedger}
            title="Refresh ledger"
            className="p-2.5 bg-[#FAF8F5] border border-[#1C1917]/15 rounded-xs hover:bg-[#F4EFE6] text-[#57534E] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Ledger</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#FAF8F5] border border-[#1C1917]/10 p-3.5 rounded-xs shadow-2xs">
          <div className="flex items-center justify-between text-[#78716C] mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider">Total Products</span>
            <Layers className="w-3.5 h-3.5 text-[#967029]" />
          </div>
          <p className="text-xl font-bold font-serif text-[#1C1917] tabular-nums">
            {summary.totalProducts ?? items.length}
          </p>
          <p className="text-[10px] text-[#78716C] mt-0.5">
            {summary.totalVariants ?? items.length} Total Variants
          </p>
        </div>

        <div className="bg-[#FAF8F5] border border-[#1C1917]/10 p-3.5 rounded-xs shadow-2xs">
          <div className="flex items-center justify-between text-[#78716C] mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider">In Stock</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-xl font-bold font-serif text-emerald-800 tabular-nums">
            {summary.inStockCount ?? items.filter((i) => i.status === 'in_stock').length}
          </p>
          <p className="text-[10px] text-emerald-700 mt-0.5">Healthy Sellable Units</p>
        </div>

        <div className="bg-[#FAF8F5] border border-[#1C1917]/10 p-3.5 rounded-xs shadow-2xs">
          <div className="flex items-center justify-between text-[#78716C] mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider">Low Stock Alert</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <p className="text-xl font-bold font-serif text-amber-800 tabular-nums">
            {summary.lowStockCount ?? items.filter((i) => i.status === 'low_stock').length}
          </p>
          <p className="text-[10px] text-amber-700 mt-0.5">Below Threshold (&lt; 5)</p>
        </div>

        <div className="bg-[#FAF8F5] border border-[#1C1917]/10 p-3.5 rounded-xs shadow-2xs">
          <div className="flex items-center justify-between text-[#78716C] mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider">Out of Stock</span>
            <XCircle className="w-3.5 h-3.5 text-red-600" />
          </div>
          <p className="text-xl font-bold font-serif text-red-800 tabular-nums">
            {summary.outOfStockCount ?? items.filter((i) => i.status === 'out_of_stock').length}
          </p>
          <p className="text-[10px] text-red-700 mt-0.5">0 Available Units</p>
        </div>

        <div className="bg-[#FAF8F5] border border-[#1C1917]/10 p-3.5 rounded-xs shadow-2xs">
          <div className="flex items-center justify-between text-[#78716C] mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider">Reserved</span>
            <Lock className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <p className="text-xl font-bold font-serif text-blue-800 tabular-nums">
            {summary.totalReserved ?? items.reduce((s, i) => s + (i.reservedQuantity || 0), 0)}
          </p>
          <p className="text-[10px] text-blue-700 mt-0.5">Pending Order Locks</p>
        </div>

        <div className="bg-[#FAF8F5] border border-[#1C1917]/10 p-3.5 rounded-xs shadow-2xs">
          <div className="flex items-center justify-between text-[#78716C] mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider">Total Sold</span>
            <ShoppingBag className="w-3.5 h-3.5 text-[#967029]" />
          </div>
          <p className="text-xl font-bold font-serif text-[#1C1917] tabular-nums">
            {summary.totalSold ?? items.reduce((s, i) => s + (i.soldQuantity || 0), 0)}
          </p>
          <p className="text-[10px] text-[#78716C] mt-0.5">Fulfilled Orders</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#FAF8F5] p-4 rounded-xs border border-[#1C1917]/10 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search variant, product name, or SKU..."
            className="w-full bg-[#F4EFE6] text-xs text-[#1C1917] placeholder-[#78716C] pl-9 pr-3 py-2 rounded-xs border border-transparent focus:border-[#B88E3E] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 bg-[#F4EFE6] border border-[#1C1917]/10 px-2.5 py-1.5 rounded-xs text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#78716C]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs text-[#1C1917] focus:outline-none cursor-pointer font-medium"
            >
              <option value="all">All Stock Statuses</option>
              <option value="in_stock">Healthy Stock (In Stock)</option>
              <option value="low_stock">Low Stock (Alert)</option>
              <option value="out_of_stock">Out of Stock (0 Available)</option>
              <option value="reserved">Has Active Reserved Stock (&gt; 0)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-[#FAF8F5] rounded-xs border border-[#1C1917]/10 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F4EFE6] text-[#78716C] uppercase text-[10px] tracking-wider border-b border-[#1C1917]/10">
              <tr>
                <th className="px-5 py-3 font-semibold">Product & Variant</th>
                <th className="px-4 py-3 font-semibold">SKU</th>
                <th className="px-4 py-3 font-semibold text-center">Physical Stock</th>
                <th className="px-4 py-3 font-semibold text-center">Reserved</th>
                <th className="px-4 py-3 font-semibold text-center">Sold</th>
                <th className="px-4 py-3 font-semibold text-center">Available Sellable</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C1917]/5">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-[#78716C]">
                    Loading inventory ledger...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-[#78716C]">
                    No matching inventory items found.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.variantId} className="hover:bg-[#F4EFE6]/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.productName}
                            className="w-10 h-12 object-cover rounded-xs bg-[#EFE9DC] shrink-0 border border-[#1C1917]/10"
                          />
                        ) : (
                          <div className="w-10 h-12 rounded-xs bg-[#F4EFE6] flex items-center justify-center text-[#78716C] shrink-0 border border-[#1C1917]/10">
                            <Boxes className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-[#1C1917] font-serif text-sm">
                            {item.productName}
                          </p>
                          <p className="text-[11px] text-[#78716C] mt-0.5">
                            Variant: <span className="text-[#1C1917] font-medium">{item.variantName}</span> · {item.categoryLabel}
                          </p>
                          {Boolean(item.price && item.price > 0) && (
                            <p className="text-[10px] text-[#967029] font-semibold mt-0.5">
                              {formatPrice(item.price || 0)}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 font-mono text-[11px] text-[#57534E]">
                      {item.sku}
                    </td>

                    <td className="px-4 py-3.5 tabular-nums text-sm font-semibold text-center text-[#1C1917]">
                      {item.stockQuantity}
                    </td>

                    <td className="px-4 py-3.5 tabular-nums text-center text-blue-800 font-medium">
                      {item.reservedQuantity > 0 ? (
                        <span className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded-xs font-semibold">
                          {item.reservedQuantity}
                        </span>
                      ) : (
                        '0'
                      )}
                    </td>

                    <td className="px-4 py-3.5 tabular-nums text-center text-[#78716C]">
                      {item.soldQuantity || 0}
                    </td>

                    <td className="px-4 py-3.5 tabular-nums text-sm font-bold text-center text-[#1C1917]">
                      <span className={item.availableQuantity === 0 ? 'text-red-700' : 'text-emerald-800'}>
                        {item.availableQuantity}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      {item.status === 'in_stock' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] uppercase tracking-wider font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>In Stock</span>
                        </span>
                      ) : item.status === 'low_stock' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] uppercase tracking-wider font-semibold bg-amber-100 text-amber-800">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Low Stock ({item.availableQuantity})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] uppercase tracking-wider font-semibold bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3" />
                          <span>Out of Stock</span>
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setAdjustingItem(item);
                            setAdjustmentType('add');
                            setAdjustQuantity(1);
                            setFeedback(null);
                          }}
                          title="Stock-In / Adjust"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#FAF8F5] hover:bg-[#F4EFE6] border border-[#1C1917]/15 rounded-xs text-[11px] font-medium text-[#1C1917] transition-colors cursor-pointer"
                        >
                          <Boxes className="w-3.5 h-3.5 text-[#967029]" />
                          <span>Adjust</span>
                        </button>

                        <button
                          onClick={() => openDetailModal(item)}
                          title="View Ledger & Detail"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#F4EFE6] hover:bg-[#EFE9DC] border border-[#1C1917]/15 rounded-xs text-[11px] font-medium text-[#1C1917] transition-colors cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5 text-[#1C1917]" />
                          <span>Ledger</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Adjustment Ledger Modal */}
      {adjustingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/60 backdrop-blur-xs">
          <div className="bg-[#FAF8F5] border border-[#1C1917]/10 rounded-xs w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1C1917]/10 pb-3">
              <div>
                <h3 className="font-serif text-lg text-[#1C1917] font-medium">
                  Record Inventory Movement
                </h3>
                <p className="text-[11px] text-[#78716C] mt-0.5 font-mono">
                  {adjustingItem.sku} · {adjustingItem.variantName}
                </p>
              </div>
              <button
                onClick={() => setAdjustingItem(null)}
                className="p-1 text-[#78716C] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {feedback && (
              <div
                className={`p-3 text-xs rounded-xs border ${
                  feedback.includes('successfully')
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {feedback}
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
              {/* Type toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#F4EFE6] rounded-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAdjustmentType('add');
                    setMovementReason('purchase');
                  }}
                  className={`py-2 rounded-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                    adjustmentType === 'add'
                      ? 'bg-[#1C1917] text-[#FAF8F5]'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Receive / Add Stock (+ Units)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdjustmentType('remove');
                    setMovementReason('damage');
                  }}
                  className={`py-2 rounded-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                    adjustmentType === 'remove'
                      ? 'bg-red-700 text-[#FAF8F5]'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  <MinusCircle className="w-3.5 h-3.5" />
                  <span>Deduct / Damage (- Units)</span>
                </button>
              </div>

              {/* Quantity */}
              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">
                  Quantity ({adjustmentType === 'add' ? '+ Add' : '- Deduct'}) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs font-semibold text-sm tabular-nums"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">
                  Movement Category *
                </label>
                <select
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value as any)}
                  className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs text-[#1C1917] font-medium"
                >
                  {adjustmentType === 'add' ? (
                    <>
                      <option value="purchase">STOCK_IN · Loom Procurement / Factory Shipment</option>
                      <option value="return">RETURN · Customer Return Restock</option>
                      <option value="adjustment">ADJUSTMENT · Reconciliation Recount</option>
                    </>
                  ) : (
                    <>
                      <option value="damage">DAMAGE · Textile Defect / Weave Damage</option>
                      <option value="adjustment">ADJUSTMENT · Stock Discrepancy Correction</option>
                    </>
                  )}
                </select>
              </div>

              {/* Notes (MANDATORY) */}
              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">
                  Mandatory Audit Notes / Reason *
                </label>
                <input
                  type="text"
                  required
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Received PO-2026-10 Varanasi loom shipment (10 sarees)"
                  className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#1C1917]/10">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setAdjustingItem(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={submitting}
                  leftIcon={<History className="w-3.5 h-3.5" />}
                >
                  {submitting ? 'Recording Movement...' : 'Commit Movement'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product-Level Detail & Historical Ledger Drawer / Modal */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/60 backdrop-blur-xs">
          <div className="bg-[#FAF8F5] border border-[#1C1917]/10 rounded-xs w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#1C1917]/10 flex items-start justify-between bg-[#FAF8F5]">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#967029]">
                  {detailItem.categoryLabel}
                </span>
                <h3 className="font-serif text-xl text-[#1C1917] font-normal mt-0.5">
                  {detailItem.productName}
                </h3>
                <p className="text-xs text-[#78716C] mt-0.5 font-mono">
                  SKU: {detailItem.sku} · Variant: {detailItem.variantName}
                </p>
              </div>
              <button
                onClick={() => setDetailItem(null)}
                className="p-1 text-[#78716C] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#F4EFE6] p-3 rounded-xs border border-[#1C1917]/5">
                  <span className="text-[10px] uppercase font-semibold text-[#78716C]">Physical Stock</span>
                  <p className="text-lg font-bold text-[#1C1917] tabular-nums mt-0.5">
                    {detailItem.stockQuantity}
                  </p>
                  <p className="text-[10px] text-[#78716C]">Total on shelves</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 p-3 rounded-xs">
                  <span className="text-[10px] uppercase font-semibold text-blue-700">Reserved Locks</span>
                  <p className="text-lg font-bold text-blue-900 tabular-nums mt-0.5">
                    {detailItem.reservedQuantity}
                  </p>
                  <p className="text-[10px] text-blue-700">Pending checkout locks</p>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xs">
                  <span className="text-[10px] uppercase font-semibold text-emerald-700">Available Sellable</span>
                  <p className="text-lg font-bold text-emerald-900 tabular-nums mt-0.5">
                    {detailItem.availableQuantity}
                  </p>
                  <p className="text-[10px] text-emerald-700">Ready for purchase</p>
                </div>

                <div className="bg-[#F4EFE6] p-3 rounded-xs border border-[#1C1917]/5">
                  <span className="text-[10px] uppercase font-semibold text-[#78716C]">Confirmed Sales</span>
                  <p className="text-lg font-bold text-[#1C1917] tabular-nums mt-0.5">
                    {detailItem.soldQuantity || 0}
                  </p>
                  <p className="text-[10px] text-[#78716C]">Completed orders</p>
                </div>
              </div>

              {/* Editable Low Stock Alert Threshold */}
              <div className="bg-[#F4EFE6]/60 p-4 rounded-xs border border-[#1C1917]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-[#1C1917]">Low-Stock Alert Threshold</h4>
                  <p className="text-[11px] text-[#78716C]">
                    When sellable stock drops below this number, Admin shows a low-stock signal.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={editableThreshold}
                    onChange={(e) => setEditableThreshold(Math.max(1, Number(e.target.value)))}
                    className="w-20 bg-[#FAF8F5] border border-[#1C1917]/20 p-1.5 rounded-xs text-center font-bold text-xs"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={thresholdSaving}
                    onClick={handleSaveThreshold}
                    leftIcon={<Save className="w-3.5 h-3.5" />}
                  >
                    Save
                  </Button>
                </div>
              </div>

              {thresholdMessage && (
                <p className="text-xs text-emerald-800 font-medium">{thresholdMessage}</p>
              )}

              {/* Movement History Ledger Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif text-sm font-normal text-[#1C1917] flex items-center gap-1.5">
                    <History className="w-4 h-4 text-[#967029]" />
                    <span>Audit-Tracked Movement History Ledger</span>
                  </h4>
                  <span className="text-[11px] text-[#78716C]">
                    {itemMovements.length} {itemMovements.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>

                <div className="border border-[#1C1917]/10 rounded-xs overflow-hidden bg-[#FAF8F5]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F4EFE6] text-[#78716C] uppercase text-[10px] tracking-wider border-b border-[#1C1917]/10">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Date & Time</th>
                        <th className="px-3 py-2.5 font-semibold">Type</th>
                        <th className="px-3 py-2.5 font-semibold text-center">Change</th>
                        <th className="px-4 py-2.5 font-semibold">Reference</th>
                        <th className="px-4 py-2.5 font-semibold">Reason / Audit Notes</th>
                        <th className="px-3 py-2.5 font-semibold">Actor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1C1917]/5">
                      {loadingMovements ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-[#78716C]">
                            Loading historical movement ledger...
                          </td>
                        </tr>
                      ) : itemMovements.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-[#78716C]">
                            No movements recorded yet for this item.
                          </td>
                        </tr>
                      ) : (
                        itemMovements.map((m) => (
                          <tr key={m.id} className="hover:bg-[#F4EFE6]/40">
                            <td className="px-4 py-2.5 font-mono text-[11px] text-[#57534E] whitespace-nowrap">
                              {new Date(m.createdAt).toLocaleString('en-IN', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </td>

                            <td className="px-3 py-2.5">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded-xs text-[10px] font-semibold uppercase tracking-wider ${
                                  m.movementType === 'purchase' || m.movementType === 'STOCK_IN'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : m.movementType === 'sale'
                                    ? 'bg-purple-100 text-purple-800'
                                    : m.movementType === 'reservation'
                                    ? 'bg-blue-100 text-blue-800'
                                    : m.movementType === 'release'
                                    ? 'bg-amber-100 text-amber-800'
                                    : m.movementType === 'damage'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-stone-200 text-stone-800'
                                }`}
                              >
                                {m.movementType}
                              </span>
                            </td>

                            <td
                              className={`px-3 py-2.5 font-bold tabular-nums text-center text-xs ${
                                m.quantity > 0 ? 'text-emerald-700' : 'text-red-700'
                              }`}
                            >
                              {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                            </td>

                            <td className="px-4 py-2.5 font-mono text-[11px] text-[#78716C]">
                              {m.referenceId || m.referenceType || 'Direct'}
                            </td>

                            <td className="px-4 py-2.5 text-[#1C1917] max-w-xs truncate">
                              {m.notes || 'N/A'}
                            </td>

                            <td className="px-3 py-2.5 text-[11px] text-[#78716C] whitespace-nowrap">
                              {m.createdBy || 'System'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#1C1917]/10 bg-[#FAF8F5] flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setDetailItem(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
