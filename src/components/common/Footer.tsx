import React from 'react';
import { Container } from '../ui/Container';
import { PageView } from '../../types';
import { ShieldCheck, Sparkles, RefreshCw, PackageCheck } from 'lucide-react';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { VKVastramLogo } from './VKVastramLogo';

interface FooterProps {
  onNavigate: (page: PageView) => void;
  categories?: any[];
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, categories }) => {
  const { settings } = useSiteSettings();
  const storeName = settings?.storeName || 'VK VASTRAM';
  const supportEmail = settings?.supportEmail || 'care@vkvastram.com';
  const whatsappNumber = settings?.whatsappNumber || '+91 98234 56789';
  const tagline = settings?.tagline || 'Classical Indian Textiles & Sarees';
  const taglineColor = settings?.taglineColor || '#B88E3E';
  const taglineEmojis = settings?.taglineEmojis || '';
  const studioAddress = settings?.studioAddress || 'VK Vastram Design Pavilion, Jayanagar Heritage Enclave, Bengaluru, Karnataka 560041';

  const dynamicCategoryLinks = (categories && categories.length > 0)
    ? categories.map((cat) => ({
        title: cat.title,
        category: cat.category,
      }))
    : [
        { title: 'Sarees', category: 'sarees' },
        { title: 'Bedsheets', category: 'bedsheets' },
        { title: 'Home Textiles', category: 'home-textiles' },
      ];

  return (
    <footer className="bg-[#1C1917] text-[#FAF8F5] pt-16 pb-12 border-t border-[#2E2926]">
      {/* Restrained Trust & Value Highlights */}
      <div className="border-b border-[#FAF8F5]/10 pb-12 mb-12">
        <Container>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xs bg-[#FAF8F5]/5 border border-[#FAF8F5]/10 flex items-center justify-center text-[#B88E3E] shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-serif text-sm font-medium text-[#FAF8F5]">Pure Materials</h4>
                <p className="text-xs text-[#A8A29E] mt-1 leading-relaxed">
                  Authentic natural fibres including pure mulberry silk, wild tussar, and long-staple cotton.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xs bg-[#FAF8F5]/5 border border-[#FAF8F5]/10 flex items-center justify-center text-[#B88E3E] shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-serif text-sm font-medium text-[#FAF8F5]">Handloom Heritage</h4>
                <p className="text-xs text-[#A8A29E] mt-1 leading-relaxed">
                  Celebrating traditional regional weaving clusters across India.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xs bg-[#FAF8F5]/5 border border-[#FAF8F5]/10 flex items-center justify-center text-[#B88E3E] shrink-0">
                <PackageCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-serif text-sm font-medium text-[#FAF8F5]">Careful Packaging</h4>
                <p className="text-xs text-[#A8A29E] mt-1 leading-relaxed">
                  Every order is individually quality-checked and packaged in protective archival boxes.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xs bg-[#FAF8F5]/5 border border-[#FAF8F5]/10 flex items-center justify-center text-[#B88E3E] shrink-0">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-serif text-sm font-medium text-[#FAF8F5]">{settings?.exchangeWindowDays || 7}-Day Exchange</h4>
                <p className="text-xs text-[#A8A29E] mt-1 leading-relaxed">
                  Straightforward {settings?.exchangeWindowDays || 7}-day exchange window for unused, unstitched textile orders.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* Main Footer Link Matrix */}
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12">
          {/* Brand Philosophy */}
          <div className="md:col-span-4 space-y-4 flex flex-col items-start">
            <VKVastramLogo variant="full" size="sm" animate={true} className="!items-start" />
            <p className="text-xs sm:text-sm text-[#A8A29E] leading-relaxed max-w-sm">
              Classical Indian fashion and artisanal home textiles. Authentic handloom sarees, pure katan silks, and breathable organic cotton bedsheets designed for enduring grace.
            </p>
            <p 
              className="text-xs tracking-wider uppercase font-medium flex items-center gap-1.5"
              style={{ color: taglineColor }}
            >
              <span>{tagline}</span>
              {taglineEmojis && <span className="text-sm">{taglineEmojis}</span>}
            </p>
          </div>

          {/* Shop */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs uppercase tracking-[0.15em] text-[#B88E3E] font-semibold">
              Shop
            </h4>
            <ul className="space-y-2 text-xs text-[#A8A29E]">
              {dynamicCategoryLinks.map((catLink) => (
                <li key={catLink.category}>
                  <button
                    onClick={() => onNavigate({ type: 'collection', category: catLink.category })}
                    className="hover:text-[#FAF8F5] transition-colors cursor-pointer text-left"
                  >
                    {catLink.title}
                  </button>
                </li>
              ))}
              <li>
                <button
                  onClick={() => onNavigate({ type: 'sale' })}
                  className="hover:text-[#FAF8F5] transition-colors cursor-pointer text-left text-[#E5D7B7]"
                >
                  Seasonal Sale
                </button>
              </li>
            </ul>
          </div>

          {/* Customer Care */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs uppercase tracking-[0.15em] text-[#B88E3E] font-semibold">
              Customer Care
            </h4>
            <ul className="space-y-2 text-xs text-[#A8A29E]">
              <li>
                <button
                  onClick={() => onNavigate({ type: 'faq' })}
                  className="hover:text-[#FAF8F5] transition-colors cursor-pointer text-left"
                >
                  Frequently Asked Questions
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate({ type: 'contact' })}
                  className="hover:text-[#FAF8F5] transition-colors cursor-pointer text-left"
                >
                  Contact & Assistance
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate({ type: 'faq' })}
                  className="hover:text-[#FAF8F5] transition-colors cursor-pointer text-left"
                >
                  Shipping & Delivery Information
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate({ type: 'faq' })}
                  className="hover:text-[#FAF8F5] transition-colors cursor-pointer text-left"
                >
                  Exchange & Return Policy
                </button>
              </li>
            </ul>
          </div>

          {/* About & Inquiries */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs uppercase tracking-[0.15em] text-[#B88E3E] font-semibold">
              Client Assistance
            </h4>
            <p className="text-xs text-[#A8A29E] leading-relaxed">
              For custom styling advice, bridal inquiries, or bulk orders, reach out to our client advisory team.
            </p>
            <div className="pt-2 text-xs text-[#E5D7B7] space-y-1">
              <p>Email: <a href={`mailto:${supportEmail}`} className="hover:underline">{supportEmail}</a></p>
              <p>WhatsApp: <a href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{whatsappNumber}</a></p>
              <p className="text-[#A8A29E] text-[11px] pt-1">Mon – Sat: 10:00 AM – 7:00 PM IST</p>
              <div className="pt-2 text-[#A8A29E] text-[11px]">
                <p className="font-medium text-[#B88E3E] mb-1">Studio Address:</p>
                <p>{studioAddress}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Legal */}
        <div className="pt-8 border-t border-[#FAF8F5]/10 flex flex-col sm:flex-row items-center justify-between text-xs text-[#78716C] gap-4">
          <p>© {new Date().getFullYear()} {storeName}. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <button onClick={() => onNavigate({ type: 'faq' })} className="hover:text-[#A8A29E] cursor-pointer">
              Privacy Policy
            </button>
            <span>·</span>
            <button onClick={() => onNavigate({ type: 'faq' })} className="hover:text-[#A8A29E] cursor-pointer">
              Terms of Service
            </button>
            <span>·</span>
            <button onClick={() => onNavigate({ type: 'faq' })} className="hover:text-[#A8A29E] cursor-pointer">
              Refund Policy
            </button>
          </div>
        </div>
      </Container>
    </footer>
  );
};
