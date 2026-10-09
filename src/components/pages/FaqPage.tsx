import React, { useState } from 'react';
import { Container } from '../ui/Container';
import { PageView } from '../../types';
import { ChevronDown } from 'lucide-react';
import { useSiteSettings } from '../../hooks/useSiteSettings';

interface FaqPageProps {
  onNavigate: (page: PageView) => void;
}

interface FaqItem {
  question: string;
  answer: string;
  category: 'Orders & Shipping' | 'Fabrics & Care' | 'Returns & Exchanges';
}

export const FaqPage: React.FC<FaqPageProps> = ({ onNavigate }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const { settings } = useSiteSettings();
  const exchangeWindow = settings?.exchangeWindowDays || 7;
  const codLimit = settings?.codMaxLimit || 15000;
  const currencySymbol = settings?.currencySymbol || '₹';

  const faqs: FaqItem[] = [
    {
      category: 'Orders & Shipping',
      question: 'How are shipping charges and deliveries handled?',
      answer: 'Shipping charges are calculated at checkout based on delivery location. Once dispatched from our studio, shipments are trackable door-to-door.',
    },
    {
      category: 'Orders & Shipping',
      question: 'Do you offer Cash on Delivery (COD)?',
      answer: `Yes, Cash on Delivery is supported for select domestic pin codes up to ${currencySymbol}${codLimit.toLocaleString()}. Prepaid payment via UPI, Credit/Debit cards, and Net Banking is available across all orders.`,
    },
    {
      category: 'Fabrics & Care',
      question: 'How do I care for my pure silk sarees?',
      answer: 'Pure silk sarees should only be dry cleaned. Store folded in soft unbleached cotton or muslin. Air your sarees in the shade twice a year and refold along different lines to avoid creases along zari weaves.',
    },
    {
      category: 'Fabrics & Care',
      question: 'How should I wash hand-block printed cotton bedsheets?',
      answer: 'Machine wash in cold water on gentle cycle with a mild liquid detergent. Always dry in the shade to preserve the depth of natural block-print dyes.',
    },
    {
      category: 'Returns & Exchanges',
      question: 'What is your return or exchange policy?',
      answer: `We offer a straightforward ${exchangeWindow}-day exchange window from the date of delivery for items in their original, unstitched, and unworn condition with all tags intact.`,
    },
    {
      category: 'Returns & Exchanges',
      question: 'Are blouse pieces attached to sarees?',
      answer: 'Yes, all our 5.5m and 6.0m sarees include an unstitched 0.8m running or contrast blouse length included in the drape.',
    },
  ];

  return (
    <div className="bg-[#FAF8F5] py-10 sm:py-16">
      <Container size="narrow">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#78716C] mb-8">
          <button
            onClick={() => onNavigate({ type: 'home' })}
            className="hover:text-[#1C1917] transition-colors cursor-pointer"
          >
            Home
          </button>
          <span>/</span>
          <span className="text-[#1C1917] font-medium">FAQ & Care</span>
        </nav>

        <div className="border-b border-[#1C1917]/10 pb-8 mb-10">
          <span className="text-[11px] uppercase tracking-[0.2em] text-[#967029] font-medium block mb-2">
            Client Assistance
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#1C1917] font-normal leading-tight">
            Frequently Asked Questions
          </h1>
          <p className="mt-2 text-sm text-[#57534E]">
            Guidance on our textile weaves, care protocols, shipping details, and returns.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="bg-[#F4EFE6]/70 rounded-xs border border-[#1C1917]/10 overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#967029] font-medium block mb-1">
                      {faq.category}
                    </span>
                    <h3 className="font-serif text-base sm:text-lg text-[#1C1917] font-normal">
                      {faq.question}
                    </h3>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-[#78716C] shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[#1C1917]' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-5 sm:px-5 text-xs sm:text-sm text-[#57534E] leading-relaxed border-t border-[#1C1917]/5 pt-3">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Container>
    </div>
  );
};
