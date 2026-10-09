import React from 'react';
import { Container } from '../ui/Container';
import { Shield, Truck, RefreshCw, MessageSquare } from 'lucide-react';
import { ScrollReveal } from '../ui/ScrollReveal';

import { useSiteSettings } from '../../hooks/useSiteSettings';

export const TrustGuarantees: React.FC = () => {
  const { settings } = useSiteSettings();
  const announcementText = settings?.announcementBarText || 'Shipping charges calculated at checkout.';
  const exchangeWindow = settings?.exchangeWindowDays || 7;

  const guarantees = [
    {
      icon: <Shield className="w-5 h-5 text-[#967029]" />,
      title: 'Pure Materials',
      description: 'Handpicked natural mulberry silks, wild tussar, and certified long-staple cotton.',
    },
    {
      icon: <Truck className="w-5 h-5 text-[#967029]" />,
      title: 'Careful Packaging',
      description: `Every handloom piece is individually inspected and securely packed. ${announcementText}`,
    },
    {
      icon: <RefreshCw className="w-5 h-5 text-[#967029]" />,
      title: `${exchangeWindow}-Day Easy Exchange`,
      description: `Simple door-to-door exchange policy for unstitched and unworn products within ${exchangeWindow} days.`,
    },
    {
      icon: <MessageSquare className="w-5 h-5 text-[#967029]" />,
      title: 'Client Assistance',
      description: 'Direct support from our textile team for drape advice and care protocols.',
    },
  ];

  return (
    <section className="py-16 sm:py-20 bg-[#F4EFE6] border-t border-[#1C1917]/10">
      <Container>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {guarantees.map((item, idx) => (
            <ScrollReveal key={idx} delay={idx * 75} duration={550} distance={16}>
              <div className="flex flex-col items-start space-y-2.5">
                <div className="w-10 h-10 rounded-xs bg-[#FAF8F5] border border-[#1C1917]/10 flex items-center justify-center shadow-xs">
                  {item.icon}
                </div>
                <h3 className="font-serif text-base text-[#1C1917] font-medium pt-1">
                  {item.title}
                </h3>
                <p className="text-xs text-[#57534E] leading-relaxed">
                  {item.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </Container>
    </section>
  );
};
