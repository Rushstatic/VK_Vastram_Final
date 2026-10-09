import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Search } from 'lucide-react';

export interface ParsedAddressComponents {
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  district?: string;
  state: string;
  pincode: string;
  country?: string;
}

interface AddressAutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  onAddressSelect?: (comp: ParsedAddressComponents) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
}

export const AddressAutocompleteInput: React.FC<AddressAutocompleteInputProps> = ({
  value,
  onChange,
  onAddressSelect,
  placeholder = 'e.g. 402, Lotus Heritage, 12th Main Road',
  className = '',
  disabled = false,
  required = false,
  name,
  id,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    if ((window as any).google?.maps?.places) {
      setMapsLoaded(true);
      return;
    }

    const scriptId = 'google-maps-places-script';
    if (document.getElementById(scriptId)) return;

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&client=aistudio-agent`;
    script.async = true;
    script.onload = () => setMapsLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!mapsLoaded || !inputRef.current || !(window as any).google?.maps?.places || !onAddressSelect) {
      return;
    }

    try {
      const autocomplete = new (window as any).google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'in' },
        fields: ['address_components', 'formatted_address', 'name'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place || !place.address_components) return;

        let streetNumber = '';
        let route = '';
        let premise = '';
        let subpremise = '';
        let sublocality = '';
        let locality = '';
        let district = '';
        let state = '';
        let pincode = '';
        let country = 'India';

        for (const comp of place.address_components) {
          const types = comp.types || [];
          if (types.includes('street_number')) streetNumber = comp.long_name;
          if (types.includes('route')) route = comp.long_name;
          if (types.includes('premise')) premise = comp.long_name;
          if (types.includes('subpremise')) subpremise = comp.long_name;
          if (types.includes('sublocality') || types.includes('sublocality_level_1') || types.includes('sublocality_level_2')) {
            if (!sublocality) sublocality = comp.long_name;
          }
          if (types.includes('locality')) locality = comp.long_name;
          if (types.includes('administrative_area_level_2')) district = comp.long_name;
          if (types.includes('administrative_area_level_1')) state = comp.long_name;
          if (types.includes('postal_code')) pincode = comp.long_name;
          if (types.includes('country')) country = comp.long_name;
        }

        const placeName = place.name && place.name !== locality && place.name !== state ? place.name : '';
        const streetParts = [placeName, subpremise, premise, streetNumber, route, sublocality].filter(Boolean);
        const uniqueStreet = Array.from(new Set(streetParts)).join(', ') || place.formatted_address || value;

        onChange(uniqueStreet);

        onAddressSelect({
          addressLine1: uniqueStreet,
          city: locality || district || 'Bengaluru',
          district: district || locality || '',
          state: state || 'Karnataka',
          pincode: pincode || '',
          country: country || 'India',
        });
      });
    } catch (e) {
      console.warn('Google Maps Places Autocomplete init warning:', e);
    }
  }, [mapsLoaded]);

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        id={id}
        name={name}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
    </div>
  );
};
