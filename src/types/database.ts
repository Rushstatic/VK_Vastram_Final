export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'customer' | 'admin';
export type ProductStatus = 'draft' | 'active' | 'archived';
export type CartStatus = 'active' | 'converted' | 'abandoned';
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'returned'
  | 'refunded';
export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'failed'
  | 'refunded'
  | 'cod_pending'
  | 'cod_collected'
  | 'cod_settled';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type InventoryMovementType =
  | 'purchase'
  | 'sale'
  | 'return'
  | 'damage'
  | 'adjustment'
  | 'reservation'
  | 'release';
export type DiscountType = 'percentage' | 'fixed_amount';
export type AddressLabel = 'Home' | 'Work' | 'Other';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          city: string | null;
          pincode: string | null;
          role: UserRole;
          loyalty_coins: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          city?: string | null;
          pincode?: string | null;
          role?: UserRole;
          loyalty_coins?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          city?: string | null;
          pincode?: string | null;
          role?: UserRole;
          loyalty_coins?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      addresses: {
        Row: {
          id: string;
          user_id: string;
          label: AddressLabel;
          recipient_name: string;
          phone: string;
          address_line_1: string;
          address_line_2: string | null;
          landmark: string | null;
          city: string;
          state: string;
          pincode: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label?: AddressLabel;
          recipient_name: string;
          phone: string;
          address_line_1: string;
          address_line_2?: string | null;
          landmark?: string | null;
          city: string;
          state: string;
          pincode: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          label?: AddressLabel;
          recipient_name?: string;
          phone?: string;
          address_line_1?: string;
          address_line_2?: string | null;
          landmark?: string | null;
          city?: string;
          state?: string;
          pincode?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          image_url?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      collections: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          banner_image_url: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          banner_image_url?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          image_url?: string | null;
          banner_image_url?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          slug: string;
          name: string;
          short_description: string | null;
          description: string | null;
          category_id: string | null;
          collection_id: string | null;
          sku: string | null;
          price: number;
          mrp: number | null;
          discount_percentage: number | null;
          status: ProductStatus;
          featured: boolean;
          bestseller: boolean;
          new_arrival: boolean;
          fabric: string | null;
          weave: string | null;
          origin: string | null;
          dimensions: string | null;
          care_instructions: string | null;
          metadata: Json | null;
          seo_title: string | null;
          seo_description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          short_description?: string | null;
          description?: string | null;
          category_id?: string | null;
          collection_id?: string | null;
          sku?: string | null;
          price: number;
          mrp?: number | null;
          discount_percentage?: number | null;
          status?: ProductStatus;
          featured?: boolean;
          bestseller?: boolean;
          new_arrival?: boolean;
          fabric?: string | null;
          weave?: string | null;
          origin?: string | null;
          dimensions?: string | null;
          care_instructions?: string | null;
          metadata?: Json | null;
          seo_title?: string | null;
          seo_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          short_description?: string | null;
          description?: string | null;
          category_id?: string | null;
          collection_id?: string | null;
          sku?: string | null;
          price?: number;
          mrp?: number | null;
          discount_percentage?: number | null;
          status?: ProductStatus;
          featured?: boolean;
          bestseller?: boolean;
          new_arrival?: boolean;
          fabric?: string | null;
          weave?: string | null;
          origin?: string | null;
          dimensions?: string | null;
          care_instructions?: string | null;
          metadata?: Json | null;
          seo_title?: string | null;
          seo_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          variant_id: string | null;
          image_url: string;
          storage_path: string | null;
          alt_text: string | null;
          sort_order: number;
          is_primary: boolean;
          role: string | null;
          fit: string | null;
          focal_x: number | null;
          focal_y: number | null;
          scale: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          variant_id?: string | null;
          image_url: string;
          storage_path?: string | null;
          alt_text?: string | null;
          sort_order?: number;
          is_primary?: boolean;
          role?: string | null;
          fit?: string | null;
          focal_x?: number | null;
          focal_y?: number | null;
          scale?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          variant_id?: string | null;
          image_url?: string;
          storage_path?: string | null;
          alt_text?: string | null;
          sort_order?: number;
          is_primary?: boolean;
          role?: string | null;
          fit?: string | null;
          focal_x?: number | null;
          focal_y?: number | null;
          scale?: number | null;
          created_at?: string;
        };
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          sku: string;
          variant_name: string;
          color: string | null;
          size: string | null;
          bed_size: string | null;
          dimensions: string | null;
          price_override: number | null;
          mrp_override: number | null;
          stock_quantity: number;
          reserved_quantity: number;
          is_active: boolean;
          attributes: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          sku: string;
          variant_name: string;
          color?: string | null;
          size?: string | null;
          bed_size?: string | null;
          dimensions?: string | null;
          price_override?: number | null;
          mrp_override?: number | null;
          stock_quantity?: number;
          reserved_quantity?: number;
          is_active?: boolean;
          attributes?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          sku?: string;
          variant_name?: string;
          color?: string | null;
          size?: string | null;
          bed_size?: string | null;
          dimensions?: string | null;
          price_override?: number | null;
          mrp_override?: number | null;
          stock_quantity?: number;
          reserved_quantity?: number;
          is_active?: boolean;
          attributes?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      inventory_movements: {
        Row: {
          id: string;
          product_variant_id: string;
          movement_type: InventoryMovementType;
          quantity: number;
          reference_type: string | null;
          reference_id: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_variant_id: string;
          movement_type: InventoryMovementType;
          quantity: number;
          reference_type?: string | null;
          reference_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_variant_id?: string;
          movement_type?: InventoryMovementType;
          quantity?: number;
          reference_type?: string | null;
          reference_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
      };
      carts: {
        Row: {
          id: string;
          user_id: string | null;
          status: CartStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          status?: CartStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          status?: CartStatus;
          created_at?: string;
          updated_at?: string;
        };
      };
      cart_items: {
        Row: {
          id: string;
          cart_id: string;
          product_variant_id: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cart_id: string;
          product_variant_id: string;
          quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cart_id?: string;
          product_variant_id?: string;
          quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          user_id: string | null;
          customer_email: string | null;
          customer_phone: string | null;
          customer_name: string | null;
          is_guest: boolean;
          guest_access_token: string | null;
          guest_access_token_hash: string | null;
          shipping_address_snapshot: Json;
          billing_address_snapshot: Json | null;
          subtotal: number;
          discount_amount: number;
          shipping_amount: number;
          tax_amount: number;
          total_amount: number;
          currency: string;
          payment_status: PaymentStatus;
          order_status: OrderStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number?: string;
          user_id?: string | null;
          customer_email?: string | null;
          customer_phone?: string | null;
          customer_name?: string | null;
          is_guest?: boolean;
          guest_access_token?: string | null;
          guest_access_token_hash?: string | null;
          shipping_address_snapshot: Json;
          billing_address_snapshot?: Json | null;
          subtotal: number;
          discount_amount?: number;
          shipping_amount?: number;
          tax_amount?: number;
          total_amount: number;
          currency?: string;
          payment_status?: PaymentStatus;
          order_status?: OrderStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          user_id?: string | null;
          customer_email?: string | null;
          customer_phone?: string | null;
          customer_name?: string | null;
          is_guest?: boolean;
          guest_access_token?: string | null;
          guest_access_token_hash?: string | null;
          shipping_address_snapshot?: Json;
          billing_address_snapshot?: Json | null;
          subtotal?: number;
          discount_amount?: number;
          shipping_amount?: number;
          tax_amount?: number;
          total_amount?: number;
          currency?: string;
          payment_status?: PaymentStatus;
          order_status?: OrderStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_variant_id: string | null;
          product_name_snapshot: string;
          sku_snapshot: string;
          price_snapshot: number;
          quantity: number;
          total_amount: number;
          product_metadata_snapshot: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_variant_id?: string | null;
          product_name_snapshot: string;
          sku_snapshot: string;
          price_snapshot: number;
          quantity: number;
          total_amount: number;
          product_metadata_snapshot?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_variant_id?: string | null;
          product_name_snapshot?: string;
          sku_snapshot?: string;
          price_snapshot?: number;
          quantity?: number;
          total_amount?: number;
          product_metadata_snapshot?: Json | null;
          created_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          provider: string;
          provider_order_id: string | null;
          provider_payment_id: string | null;
          provider_signature: string | null;
          amount: number;
          currency: string;
          status: PaymentStatus;
          method: string | null;
          error_reason: string | null;
          metadata: Json | null;
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          provider: string;
          provider_order_id?: string | null;
          provider_payment_id?: string | null;
          provider_signature?: string | null;
          amount: number;
          currency?: string;
          status?: PaymentStatus;
          method?: string | null;
          error_reason?: string | null;
          metadata?: Json | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          provider?: string;
          provider_order_id?: string | null;
          provider_payment_id?: string | null;
          provider_signature?: string | null;
          amount?: number;
          currency?: string;
          status?: PaymentStatus;
          method?: string | null;
          error_reason?: string | null;
          metadata?: Json | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      payment_webhook_events: {
        Row: {
          id: string;
          provider: string;
          event_id: string;
          event_type: string;
          order_id: string | null;
          payment_id: string | null;
          payload: Json;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider?: string;
          event_id: string;
          event_type: string;
          order_id?: string | null;
          payment_id?: string | null;
          payload?: Json;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          provider?: string;
          event_id?: string;
          event_type?: string;
          order_id?: string | null;
          payment_id?: string | null;
          payload?: Json;
          status?: string;
          created_at?: string;
        };
      };
      coupons: {
        Row: {
          id: string;
          code: string;
          description: string | null;
          discount_type: DiscountType;
          discount_value: number;
          minimum_order_value: number | null;
          maximum_discount: number | null;
          usage_limit: number | null;
          per_user_limit: number | null;
          starts_at: string;
          expires_at: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          description?: string | null;
          discount_type?: DiscountType;
          discount_value: number;
          minimum_order_value?: number | null;
          maximum_discount?: number | null;
          usage_limit?: number | null;
          per_user_limit?: number | null;
          starts_at?: string;
          expires_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          description?: string | null;
          discount_type?: DiscountType;
          discount_value?: number;
          minimum_order_value?: number | null;
          maximum_discount?: number | null;
          usage_limit?: number | null;
          per_user_limit?: number | null;
          starts_at?: string;
          expires_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      coupon_usage: {
        Row: {
          id: string;
          coupon_id: string;
          user_id: string;
          order_id: string;
          used_at: string;
        };
        Insert: {
          id?: string;
          coupon_id: string;
          user_id: string;
          order_id: string;
          used_at?: string;
        };
        Update: {
          id?: string;
          coupon_id?: string;
          user_id?: string;
          order_id?: string;
          used_at?: string;
        };
      };
      reviews: {
        Row: {
          id: string;
          product_id: string;
          user_id: string;
          order_id: string | null;
          rating: number;
          title: string | null;
          body: string | null;
          status: ReviewStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          user_id: string;
          order_id?: string | null;
          rating: number;
          title?: string | null;
          body?: string | null;
          status?: ReviewStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          user_id?: string;
          order_id?: string | null;
          rating?: number;
          title?: string | null;
          body?: string | null;
          status?: ReviewStatus;
          created_at?: string;
          updated_at?: string;
        };
      };
      homepage_sections: {
        Row: {
          id: string;
          section_type: string;
          title: string;
          subtitle: string | null;
          content: Json | null;
          image_url: string | null;
          mobile_image_url: string | null;
          button_text: string | null;
          button_url: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          section_type: string;
          title: string;
          subtitle?: string | null;
          content?: Json | null;
          image_url?: string | null;
          mobile_image_url?: string | null;
          button_text?: string | null;
          button_url?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          section_type?: string;
          title?: string;
          subtitle?: string | null;
          content?: Json | null;
          image_url?: string | null;
          mobile_image_url?: string | null;
          button_text?: string | null;
          button_url?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      site_settings: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          description?: string | null;
          updated_at?: string;
        };
      };
    };
  };
}
