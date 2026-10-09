import React, { useState, useEffect } from 'react';
import { X, Save, MapPin } from 'lucide-react';
import { CustomerAddress } from '../../types';
import { Button } from '../ui/Button';
import { AddressAutocompleteInput } from '../common/AddressAutocompleteInput';
import { validateIndianMobile, validateIndianPincode } from '../../lib/validation';

interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  addressToEdit?: CustomerAddress | null;
  onSave: (data: Omit<CustomerAddress, 'id' | 'userId'>, addressId?: string) => Promise<boolean>;
}

export const AddressModal: React.FC<AddressModalProps> = ({
  isOpen,
  onClose,
  addressToEdit,
  onSave,
}) => {
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Karnataka');
  const [pincode, setPincode] = useState('');
  const [label, setLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [isDefault, setIsDefault] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (addressToEdit) {
      setRecipientName(addressToEdit.recipientName);
      setPhone(addressToEdit.phone);
      setAddressLine1(addressToEdit.addressLine1);
      setAddressLine2(addressToEdit.addressLine2 || '');
      setLandmark(addressToEdit.landmark || '');
      setCity(addressToEdit.city);
      setState(addressToEdit.state);
      setPincode(addressToEdit.pincode);
      setLabel(addressToEdit.label);
      setIsDefault(addressToEdit.isDefault);
    } else {
      setRecipientName('');
      setPhone('');
      setAddressLine1('');
      setAddressLine2('');
      setLandmark('');
      setCity('');
      setState('Karnataka');
      setPincode('');
      setLabel('Home');
      setIsDefault(false);
    }
    setErrorMessage('');
  }, [addressToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!recipientName.trim()) {
      setErrorMessage('Recipient full name is required.');
      return;
    }

    const phoneVal = validateIndianMobile(phone);
    if (!phoneVal.isValid) {
      setErrorMessage(phoneVal.error || 'Enter a valid 10-digit mobile number.');
      return;
    }

    if (!addressLine1.trim()) {
      setErrorMessage('Address line 1 (House/Flat/Building) is required.');
      return;
    }

    if (!city.trim()) {
      setErrorMessage('City is required.');
      return;
    }

    const pinVal = validateIndianPincode(pincode);
    if (!pinVal.isValid) {
      setErrorMessage(pinVal.error || 'Enter a valid 6-digit Indian PIN code.');
      return;
    }

    setSaving(true);
    const payload: Omit<CustomerAddress, 'id' | 'userId'> = {
      label,
      recipientName: recipientName.trim(),
      phone: phoneVal.normalized,
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || undefined,
      landmark: landmark.trim() || undefined,
      city: city.trim(),
      state: state.trim(),
      pincode: pinVal.normalized,
      isDefault,
    };

    const success = await onSave(payload, addressToEdit?.id);
    setSaving(false);
    if (success) {
      onClose();
    } else {
      setErrorMessage('Failed to save address. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/60 backdrop-blur-xs">
      <div className="bg-[#FAF8F5] border border-[#1C1917]/10 rounded-xs w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#1C1917]/10 pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#967029]" />
            <h3 className="font-serif text-lg text-[#1C1917] font-medium">
              {addressToEdit ? 'Edit Delivery Address' : 'Add New Delivery Address'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#78716C] hover:text-[#1C1917] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Label selector */}
          <div>
            <label className="block font-semibold text-[#1C1917] mb-1">
              Address Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Home', 'Work', 'Other'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setLabel(t)}
                  className={`py-1.5 text-center rounded-xs font-medium cursor-pointer border transition-colors ${
                    label === t
                      ? 'bg-[#1C1917] text-[#FAF8F5] border-[#1C1917]'
                      : 'bg-[#F4EFE6] text-[#57534E] border-[#1C1917]/10 hover:border-[#B88E3E]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">
                Recipient Full Name *
              </label>
              <input
                type="text"
                required
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Smt. Lakshmi Rao"
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">
                Contact Phone *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#1C1917] mb-1">
              Flat, House No., Building, Apartment *
            </label>
            <AddressAutocompleteInput
              value={addressLine1}
              onChange={setAddressLine1}
              onAddressSelect={(comp) => {
                if (comp.addressLine1) setAddressLine1(comp.addressLine1);
                if (comp.city) setCity(comp.city);
                if (comp.state) setState(comp.state);
                if (comp.pincode) setPincode(comp.pincode);
                if (comp.landmark && !landmark) setLandmark(comp.landmark);
              }}
              placeholder="e.g. Flat 402, Heritage Residency, 5th Main"
              className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#1C1917] mb-1">
              Street, Sector, Area, Colony (Optional)
            </label>
            <input
              type="text"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="e.g. 5th Main, 4th Block Jayanagar"
              className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#1C1917] mb-1">
              Landmark (Optional)
            </label>
            <input
              type="text"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="e.g. Near Cosmopolitan Club"
              className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">
                City / Town *
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Bengaluru"
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">
                State *
              </label>
              <input
                type="text"
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Karnataka"
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">
                Pincode * (6 digits)
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="560041"
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs font-mono"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded-xs accent-[#B88E3E] w-4 h-4"
              />
              <span className="text-[#1C1917] font-medium">
                Make this my default delivery address
              </span>
            </label>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[#1C1917]/10">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={saving}
              leftIcon={<Save className="w-3.5 h-3.5" />}
            >
              {saving ? 'Saving Address...' : 'Save Address'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
