import React from 'react';
import { Check, Package, Truck, CircleCheck, XCircle } from 'lucide-react';

interface OrderTrackingTimelineProps {
  status?: string | null;
  createdAt?: string;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  compact?: boolean;
}

const steps = [
  { key: 'confirmed', label: 'Order confirmed', description: 'Your order has been received', icon: Check },
  { key: 'processing', label: 'Preparing order', description: 'Your textiles are being prepared', icon: Package },
  { key: 'packed', label: 'Packed', description: 'Your order is packed and ready to ship', icon: Package },
  { key: 'shipped', label: 'Shipped', description: 'Your parcel is with the courier', icon: Truck },
  { key: 'out_for_delivery', label: 'Out for delivery', description: 'Your parcel is on its way to you', icon: Truck },
  { key: 'delivered', label: 'Delivered', description: 'Your order has been delivered', icon: CircleCheck },
];

const stageFor = (status: string) => {
  if (status === 'pending' || status === 'pending_payment') return -1;
  if (status === 'confirmed') return 0;
  if (status === 'processing') return 1;
  if (status === 'packed') return 2;
  if (status === 'shipped') return 3;
  if (status === 'out_for_delivery') return 4;
  if (status === 'delivered') return 5;
  return 0;
};

export const OrderTrackingTimeline: React.FC<OrderTrackingTimelineProps> = ({
  status = 'pending', createdAt, shippedAt, deliveredAt, courierName, trackingNumber, trackingUrl, compact = false,
}) => {
  const normalized = String(status || 'pending').toLowerCase();
  const cancelled = ['cancelled', 'returned', 'refunded'].includes(normalized);
  const currentStage = stageFor(normalized);
  const dateFor = (stepKey: string) => {
    if (stepKey === 'confirmed' && createdAt) return new Date(createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    if (stepKey === 'shipped' && shippedAt) return new Date(shippedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    if (stepKey === 'delivered' && deliveredAt) return new Date(deliveredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return '';
  };

  return (
    <section className="rounded-xs border border-[#1C1917]/10 bg-white p-4 sm:p-5" aria-label="Order tracking progress">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <h4 className="font-serif text-base text-[#1C1917]">Track your order</h4>
          <p className="text-[11px] text-[#78716C]">Progress updates as the store updates your order status.</p>
        </div>
        {normalized === 'pending' || normalized === 'pending_payment' ? <span className="text-[10px] rounded-full bg-amber-50 text-amber-800 px-2 py-1">Awaiting confirmation</span> : null}
      </div>
      {cancelled ? (
        <div className="flex items-start gap-3 rounded-xs border border-rose-200 bg-rose-50 p-3 text-rose-800">
          <XCircle className="w-5 h-5 shrink-0" />
          <div><p className="text-xs font-semibold">Order {normalized}</p><p className="text-[11px] mt-0.5">Contact the store if you need help with a return or refund.</p></div>
        </div>
      ) : (
        <ol className={`grid ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'} gap-3`}>
          {steps.map((step, index) => {
            const complete = currentStage >= index;
            const current = currentStage === index;
            const Icon = step.icon;
            const date = dateFor(step.key);
            return <li key={step.key} className="relative min-w-0">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border ${complete ? 'bg-[#1F382B] border-[#1F382B] text-white' : 'bg-[#FAF8F5] border-[#D6D0C5] text-[#A8A29E]'}`}>
                {complete && !current ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <p className={`mt-2 text-[11px] font-semibold ${current ? 'text-[#78281F]' : complete ? 'text-[#1C1917]' : 'text-[#78716C]'}`}>{step.label}</p>
              {!compact && <p className="text-[10px] leading-snug text-[#78716C] mt-0.5">{step.description}</p>}
              {date && <p className="text-[10px] text-[#967029] mt-1">{date}</p>}
              {index < steps.length - 1 && <div className={`hidden sm:block absolute top-4 left-9 right-[-0.75rem] h-px ${currentStage > index ? 'bg-[#1F382B]' : 'bg-[#E7E1D7]'}`} />}
            </li>;
          })}
        </ol>
      )}
      {(courierName || trackingNumber || trackingUrl) && !cancelled && <div className="mt-4 pt-3 border-t border-[#1C1917]/10 text-xs space-y-1">
        {courierName && <p className="text-[#57534E]">Courier: <strong className="text-[#1C1917]">{courierName}</strong></p>}
        {trackingNumber && <p className="text-[#57534E]">Tracking ID: <strong className="font-mono text-[#1C1917]">{trackingNumber}</strong></p>}
        {trackingUrl && <a href={trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#78281F] font-semibold underline">Open courier tracking <Truck className="w-3.5 h-3.5" /></a>}
      </div>}
    </section>
  );
};
