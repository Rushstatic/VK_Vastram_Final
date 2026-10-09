import React, { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  Eye,
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
import { formatPrice } from '../ui/PriceDisplay';

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
  { label: 'Returned', value: 'returned' },
  { label: 'Refunded', value: 'refunded' }
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
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [customerType, setCustomerType] = useState('all');
  const [dateRange, setDateRange] = useState('all');

  // Selected order details state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Operations state
  const [transitionNotes, setTransitionNotes] = useState('');
  const [isUpdatingStatus, setIsTransitioning] = useState(false);
  const [adminNotesText, setAdminNotesText] = useState('');
  const [isUpdatingNotes, setIsUpdatingNotes] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        page,
        limit
      });
      if (res.success) {
        setOrders(res.orders || []);
        setTotalCount(res.totalCount || 0);
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
  }, [search, orderStatus, paymentStatus, customerType, dateRange]);

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
    setIsTransitioning(true);
    clearNotifications();

    try {
      const res = await adminService.updateOrderStatus(
        selectedOrder.id,
        nextStatus,
        // Optional Payment status transitions depending on standard COD lifecycle or cancelled/refunded flows
        nextStatus === 'cancelled' && selectedOrder.paymentStatus === 'captured' ? 'refunded' : undefined,
        transitionNotes
      );

      if (res.success) {
        setSuccessMessage(res.message || `Order successfully transitioned to ${nextStatus}.`);
        setTransitionNotes('');
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

        <button
          onClick={fetchOrdersList}
          title="Refresh real-time data"
          className="p-2.5 bg-[#FAF8F5] border border-[#1C1917]/15 rounded-xs hover:bg-[#F4EFE6] text-[#57534E] transition-colors cursor-pointer self-start sm:self-auto flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Sync List</span>
        </button>
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
                  <tr key={ord.id} className="hover:bg-[#F4EFE6]/30 transition-colors">
                    {/* Actions */}
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => setSelectedOrderId(ord.id)}
                        title="Inspect full transaction details"
                        className="p-1.5 bg-[#FAF8F5] border border-[#1C1917]/15 rounded-xs hover:bg-[#F4EFE6] text-[#967029] transition-colors cursor-pointer flex items-center justify-center mx-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
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
      {selectedOrderId && (
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
              <button
                onClick={() => setSelectedOrderId(null)}
                className="p-1.5 text-[#57534E] hover:text-[#1C1917] rounded-xs border border-transparent hover:border-[#1C1917]/10 cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Workspace */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs sm:text-sm">
              {loadingDetails ? (
                <div className="py-24 text-center text-[#78716C] flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#967029]" />
                  <p className="font-serif italic">Loading detailed order snapshot...</p>
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

                        {/* returned -> refunded */}
                        {selectedOrder.orderStatus === 'returned' && (
                          <button
                            disabled={isUpdatingStatus}
                            onClick={() => handleStatusTransition('refunded')}
                            className="px-3 py-1.5 bg-stone-100 text-stone-800 border border-stone-300 rounded-xs font-semibold cursor-pointer tracking-wider uppercase text-[10px] flex items-center gap-1"
                          >
                            <span>Mark Refund Completed</span>
                          </button>
                        )}

                        {/* Order Cancellation (Only allowed before shipped) */}
                        {canCancel(selectedOrder.orderStatus) && (
                          <button
                            disabled={isUpdatingStatus}
                            onClick={() => handleStatusTransition('cancelled')}
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
                          <p className="font-semibold text-[#1C1917]">Delivery Destination</p>
                          <p className="mt-0.5">{selectedOrder.shippingAddressSnapshot.recipientName}</p>
                          <p>{selectedOrder.shippingAddressSnapshot.addressLine1}</p>
                          {selectedOrder.shippingAddressSnapshot.addressLine2 && <p>{selectedOrder.shippingAddressSnapshot.addressLine2}</p>}
                          {selectedOrder.shippingAddressSnapshot.landmark && <p className="italic text-[#78716C]">Landmark: {selectedOrder.shippingAddressSnapshot.landmark}</p>}
                          <p>{selectedOrder.shippingAddressSnapshot.city}, {selectedOrder.shippingAddressSnapshot.state} — {selectedOrder.shippingAddressSnapshot.pincode}</p>
                          <p className="mt-1 font-medium text-[#1C1917]">Phone: {selectedOrder.shippingAddressSnapshot.phone}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-[#1C1917]">Billing Destination</p>
                          {selectedOrder.billingAddressSnapshot ? (
                            <>
                              <p className="mt-0.5">{selectedOrder.billingAddressSnapshot.recipientName}</p>
                              <p>{selectedOrder.billingAddressSnapshot.addressLine1}</p>
                              {selectedOrder.billingAddressSnapshot.addressLine2 && <p>{selectedOrder.billingAddressSnapshot.addressLine2}</p>}
                              <p>{selectedOrder.billingAddressSnapshot.city}, {selectedOrder.billingAddressSnapshot.state} — {selectedOrder.billingAddressSnapshot.pincode}</p>
                              <p className="mt-1 font-medium text-[#1C1917]">Phone: {selectedOrder.billingAddressSnapshot.phone}</p>
                            </>
                          ) : (
                            <p className="mt-0.5 text-[#78716C] italic">Same as delivery destination snapshot.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

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
                                src={item.primaryImage || '/src/assets/images/hero_vastram_saree_1791192126882.jpg'}
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
                onClick={() => setSelectedOrderId(null)}
                className="px-5 py-2 border border-[#1C1917]/20 rounded-xs text-[#1C1917] hover:bg-[#FAF8F5] font-semibold cursor-pointer text-xs uppercase tracking-wider transition-all"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
