/**
 * Universal Data Validation & Sanitization Engine for VK VASTRAM
 */

export const MAX_CART_ITEM_QUANTITY = 99;

/**
 * Sanitize & enforce valid cart item quantity
 */
export function sanitizeQuantity(rawVal: any, maxStock: number = MAX_CART_ITEM_QUANTITY): number {
  if (rawVal === null || rawVal === undefined) return 1;
  const num = typeof rawVal === 'number' ? rawVal : parseInt(String(rawVal).replace(/[^0-9-]/g, ''), 10);
  if (isNaN(num) || !Number.isFinite(num) || num < 1) {
    return 1;
  }
  const effectiveMax = Math.min(MAX_CART_ITEM_QUANTITY, maxStock > 0 ? maxStock : MAX_CART_ITEM_QUANTITY);
  return Math.min(Math.floor(num), effectiveMax);
}

/**
 * Validate Indian Mobile Number (10 digits starting with 6-9)
 */
export function validateIndianMobile(raw: string): { isValid: boolean; normalized: string; error?: string } {
  if (!raw || !raw.trim()) {
    return { isValid: false, normalized: '', error: 'Mobile number is required.' };
  }
  const clean = raw.replace(/\D/g, ''); // strip non-digits
  let digits = clean;
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.length !== 10) {
    return { isValid: false, normalized: digits, error: 'Enter a valid 10-digit mobile number.' };
  }

  if (!/^[6-9]\d{9}$/.test(digits)) {
    return { isValid: false, normalized: digits, error: 'Mobile number must begin with 6, 7, 8, or 9.' };
  }

  return { isValid: true, normalized: digits };
}

/**
 * Validate Email Address
 */
export function validateEmail(raw: string): { isValid: boolean; normalized: string; error?: string } {
  if (!raw || !raw.trim()) {
    return { isValid: false, normalized: '', error: 'Email address is required.' };
  }
  const clean = raw.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(clean)) {
    return { isValid: false, normalized: clean, error: 'Enter a valid email address.' };
  }
  return { isValid: true, normalized: clean };
}

/**
 * Validate Indian Pincode (6 digits, non-zero start)
 */
export function validateIndianPincode(raw: string): { isValid: boolean; normalized: string; error?: string } {
  if (!raw || !raw.trim()) {
    return { isValid: false, normalized: '', error: 'PIN code is required.' };
  }
  const clean = raw.replace(/\D/g, '');
  if (!/^[1-9]\d{5}$/.test(clean)) {
    return { isValid: false, normalized: clean, error: 'Enter a valid 6-digit Indian PIN code.' };
  }
  return { isValid: true, normalized: clean };
}

/**
 * Validate Price and MRP
 */
export function validateMonetaryValue(val: any, label: string = 'Price'): { isValid: boolean; value: number; error?: string } {
  const num = Number(val);
  if (isNaN(num) || !Number.isFinite(num) || num < 0) {
    return { isValid: false, value: 0, error: `${label} must be a valid non-negative number.` };
  }
  return { isValid: true, value: Math.round(num * 100) / 100 };
}
