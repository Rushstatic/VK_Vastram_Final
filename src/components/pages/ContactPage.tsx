import React, { useState } from 'react';
import { Container } from '../ui/Container';
import { Button } from '../ui/Button';
import { PageView } from '../../types';
import { Mail, Phone, MapPin, CheckCircle } from 'lucide-react';
import { useSiteSettings } from '../../hooks/useSiteSettings';

interface ContactPageProps {
  onNavigate: (page: PageView) => void;
}

export const ContactPage: React.FC<ContactPageProps> = ({ onNavigate }) => {
  const [submitted, setSubmitted] = useState(false);
  const { settings } = useSiteSettings();
  const storeName = settings?.storeName || 'VK VASTRAM';
  const supportEmail = settings?.supportEmail || 'care@vkvastram.com';
  const supportPhone = settings?.supportPhone || '+91 98234 56789';
  const studioAddress = settings?.studioAddress || 'VK Vastram Design Pavilion, Jayanagar Heritage Enclave, Bengaluru, Karnataka 560041';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

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
          <span className="text-[#1C1917] font-medium">Contact</span>
        </nav>

        <div className="border-b border-[#1C1917]/10 pb-8 mb-10">
          <span className="text-[11px] uppercase tracking-[0.2em] text-[#967029] font-medium block mb-2">
            Client Advisory & Inquiries
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#1C1917] font-normal leading-tight">
            Connect with {storeName}
          </h1>
          <p className="mt-2 text-sm text-[#57534E]">
            We are here to assist with custom styling, bridal orders, or care recommendations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Details Column */}
          <div className="md:col-span-5 space-y-6 text-xs sm:text-sm text-[#57534E]">
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-[#967029] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#1C1917]">Email Inquiries</p>
                <p className="mt-0.5">
                  <a href={`mailto:${supportEmail}`} className="hover:underline">{supportEmail}</a>
                </p>
                <p className="text-[11px] text-[#78716C] mt-0.5">Typical response within 24 hours</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-[#967029] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#1C1917]">Phone & WhatsApp</p>
                <p className="mt-0.5">
                  <a href={`tel:${supportPhone.replace(/[^0-9+]/g, '')}`} className="hover:underline">{supportPhone}</a>
                </p>
                <p className="text-[11px] text-[#78716C] mt-0.5">Mon–Sat: 10:00 AM – 7:00 PM IST</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-[#967029] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#1C1917]">Textile Studio</p>
                <p className="mt-0.5 leading-relaxed whitespace-pre-line">
                  {studioAddress}
                </p>
              </div>
            </div>
          </div>

          {/* Form Column */}
          <div className="md:col-span-7 bg-[#F4EFE6]/60 p-6 sm:p-8 rounded-xs border border-[#1C1917]/10">
            {submitted ? (
              <div className="text-center py-8 space-y-3">
                <CheckCircle className="w-8 h-8 text-[#1F382B] mx-auto" />
                <h3 className="font-serif text-xl text-[#1C1917]">Message Received</h3>
                <p className="text-xs text-[#57534E] max-w-xs mx-auto">
                  Thank you for writing to us. A member of our client team will be in touch shortly.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSubmitted(false)}
                >
                  Send Another Inquiry
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[#1C1917] font-medium mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your full name"
                    className="w-full bg-[#FAF8F5] border border-[#1C1917]/20 px-3.5 py-2.5 rounded-xs text-[#1C1917] focus:outline-none focus:border-[#B88E3E]"
                  />
                </div>

                <div>
                  <label className="block text-[#1C1917] font-medium mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@domain.com"
                    className="w-full bg-[#FAF8F5] border border-[#1C1917]/20 px-3.5 py-2.5 rounded-xs text-[#1C1917] focus:outline-none focus:border-[#B88E3E]"
                  />
                </div>

                <div>
                  <label className="block text-[#1C1917] font-medium mb-1.5">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98000 00000"
                    className="w-full bg-[#FAF8F5] border border-[#1C1917]/20 px-3.5 py-2.5 rounded-xs text-[#1C1917] focus:outline-none focus:border-[#B88E3E]"
                  />
                </div>

                <div>
                  <label className="block text-[#1C1917] font-medium mb-1.5">
                    Inquiry Details
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Tell us about the textile, weave, or order query..."
                    className="w-full bg-[#FAF8F5] border border-[#1C1917]/20 px-3.5 py-2.5 rounded-xs text-[#1C1917] focus:outline-none focus:border-[#B88E3E]"
                  />
                </div>

                <Button variant="primary" fullWidth size="md" type="submit">
                  Submit Inquiry
                </Button>
              </form>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
};
