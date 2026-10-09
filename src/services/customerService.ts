import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CustomerProfile, CustomerAddress } from '../types';

export const customerService = {
  /**
   * Fetch customer profile by user ID
   */
  async getProfile(userId: string): Promise<CustomerProfile | null> {
    if (!isSupabaseConfigured() || !userId) {
      const stored = localStorage.getItem(`vk_profile_${userId}`);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          // ignore
        }
      }
      return {
        id: userId,
        fullName: 'Dev Customer',
        email: 'customer@vkvastram.com',
        phone: '+91 98765 43210',
        city: 'Bengaluru',
        pincode: '560041',
        loyaltyCoins: 150,
      };
    }

    try {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        fullName: data.full_name || '',
        email: data.email || '',
        phone: data.phone || '',
        city: data.city || '',
        pincode: data.pincode || '',
        loyaltyCoins: data.loyalty_coins || 0,
        createdAt: data.created_at,
      };
    } catch {
      return null;
    }
  },

  /**
   * Update customer profile
   */
  async updateProfile(
    userId: string,
    profileData: Partial<CustomerProfile>
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !userId) {
      const current = await this.getProfile(userId);
      const updated = { ...current, ...profileData };
      localStorage.setItem(`vk_profile_${userId}`, JSON.stringify(updated));
      return { success: true };
    }

    try {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({
          full_name: profileData.fullName,
          phone: profileData.phone,
          city: profileData.city,
          pincode: profileData.pincode,
        })
        .eq('id', userId);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update profile' };
    }
  },

  /**
   * Get all addresses for user
   */
  async getAddresses(userId: string): Promise<CustomerAddress[]> {
    if (!isSupabaseConfigured() || !userId) {
      const stored = localStorage.getItem(`vk_addresses_${userId}`);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          // ignore
        }
      }
      return [
        {
          id: 'addr-dev-1',
          userId,
          label: 'Home',
          recipientName: 'Dev Customer',
          phone: '+91 98765 43210',
          addressLine1: 'Flat 402, Heritage Residency, 5th Cross',
          addressLine2: 'Jayanagar 4th Block',
          landmark: 'Near Cosmopolitan Club',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560041',
          isDefault: true,
        },
      ];
    }

    try {
      const { data, error } = await (supabase as any)
        .from('addresses')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map((a: any) => ({
        id: a.id,
        userId: a.user_id,
        label: a.label,
        recipientName: a.recipient_name,
        phone: a.phone,
        addressLine1: a.address_line_1,
        addressLine2: a.address_line_2 || '',
        landmark: a.landmark || '',
        city: a.city,
        state: a.state,
        pincode: a.pincode,
        isDefault: a.is_default,
        createdAt: a.created_at,
      }));
    } catch {
      return [];
    }
  },

  /**
   * Create customer address
   */
  async createAddress(
    userId: string,
    address: Omit<CustomerAddress, 'id' | 'userId'>
  ): Promise<{ success: boolean; addressId?: string; error?: string }> {
    if (!isSupabaseConfigured() || !userId) {
      const current = await this.getAddresses(userId);
      if (address.isDefault) {
        current.forEach((a) => (a.isDefault = false));
      }
      const newAddr: CustomerAddress = {
        ...address,
        id: `addr-${Date.now()}`,
        userId,
      };
      current.push(newAddr);
      localStorage.setItem(`vk_addresses_${userId}`, JSON.stringify(current));
      return { success: true, addressId: newAddr.id };
    }

    try {
      // If marking as default, unset existing defaults first
      if (address.isDefault) {
        await (supabase as any)
          .from('addresses')
          .update({ is_default: false })
          .eq('user_id', userId);
      }

      const { data, error } = await (supabase as any)
        .from('addresses')
        .insert({
          user_id: userId,
          label: address.label,
          recipient_name: address.recipientName,
          phone: address.phone,
          address_line_1: address.addressLine1,
          address_line_2: address.addressLine2 || null,
          landmark: address.landmark || null,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          is_default: address.isDefault,
        })
        .select('id')
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Failed to save address' };
      }
      return { success: true, addressId: data.id };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error saving address' };
    }
  },

  /**
   * Update address
   */
  async updateAddress(
    userId: string,
    addressId: string,
    address: Partial<CustomerAddress>
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !userId) {
      const current = await this.getAddresses(userId);
      const idx = current.findIndex((a) => a.id === addressId);
      if (idx !== -1) {
        if (address.isDefault) {
          current.forEach((a) => (a.isDefault = false));
        }
        current[idx] = { ...current[idx], ...address };
        localStorage.setItem(`vk_addresses_${userId}`, JSON.stringify(current));
      }
      return { success: true };
    }

    try {
      if (address.isDefault) {
        await (supabase as any)
          .from('addresses')
          .update({ is_default: false })
          .eq('user_id', userId);
      }

      const { error } = await (supabase as any)
        .from('addresses')
        .update({
          label: address.label,
          recipient_name: address.recipientName,
          phone: address.phone,
          address_line_1: address.addressLine1,
          address_line_2: address.addressLine2,
          landmark: address.landmark,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          is_default: address.isDefault,
        })
        .eq('id', addressId)
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error updating address' };
    }
  },

  /**
   * Delete address
   */
  async deleteAddress(userId: string, addressId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !userId) {
      const current = await this.getAddresses(userId);
      const filtered = current.filter((a) => a.id !== addressId);
      localStorage.setItem(`vk_addresses_${userId}`, JSON.stringify(filtered));
      return true;
    }

    try {
      const { error } = await (supabase as any)
        .from('addresses')
        .delete()
        .eq('id', addressId)
        .eq('user_id', userId);
      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Set address as default
   */
  async setDefaultAddress(userId: string, addressId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !userId) {
      const current = await this.getAddresses(userId);
      current.forEach((a) => (a.isDefault = a.id === addressId));
      localStorage.setItem(`vk_addresses_${userId}`, JSON.stringify(current));
      return true;
    }

    try {
      await (supabase as any)
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', userId);

      const { error } = await (supabase as any)
        .from('addresses')
        .update({ is_default: true })
        .eq('id', addressId)
        .eq('user_id', userId);

      return !error;
    } catch {
      return false;
    }
  },
};
