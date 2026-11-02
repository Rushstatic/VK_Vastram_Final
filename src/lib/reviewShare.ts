/** WhatsApp share links for reviews. Customers choose to send them; nothing is posted automatically. */
const storeUrl = (): string => (typeof window !== 'undefined' ? window.location.origin : 'https://vkvastram.in');

export const buildWhatsAppLink = (text: string): string => `https://wa.me/?text=${encodeURIComponent(text)}`;

export const buildReviewShareLink = (rating: number, feedback: string): string => {
  const quote = feedback.trim().length > 160 ? `${feedback.trim().slice(0, 157)}...` : feedback.trim();
  const stars = '★'.repeat(Math.max(1, Math.min(5, rating)));
  return buildWhatsAppLink(`I shared my experience with VK VASTRAM ${stars}\n\n"${quote}"\n\n${storeUrl()}`);
};

export const buildStoreShareLink = (average: number, count: number): string => {
  const rated = count > 0 ? `Our customers rate us ${average.toFixed(1)} out of 5 from ${count} reviews. ` : '';
  return buildWhatsAppLink(`${rated}Handwoven sarees and bedsheets from VK VASTRAM: ${storeUrl()}`);
};
