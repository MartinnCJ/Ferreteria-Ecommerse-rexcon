export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_activity_log: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          type: Database["public"]["Enums"]["inventory_movement_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          type: Database["public"]["Enums"]["inventory_movement_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          type?: Database["public"]["Enums"]["inventory_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          discount: number
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          sku: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount?: number
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          sku: string
          subtotal?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          discount?: number
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sku?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_data: Json | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_rut: string | null
          discount_total: number
          fulfillment_status: Database["public"]["Enums"]["fulfillment_status"]
          id: string
          idempotency_key: string | null
          notes: string | null
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          reservation_expires_at: string | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_region: string | null
          shipping_total: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          billing_data?: Json | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_rut?: string | null
          discount_total?: number
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          reservation_expires_at?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_region?: string | null
          shipping_total?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          billing_data?: Json | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_rut?: string | null
          discount_total?: number
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          reservation_expires_at?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_region?: string | null
          shipping_total?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          created_at: string
          event_type: string | null
          external_event_id: string
          id: string
          payload: Json | null
          processed: boolean
          provider: string
        }
        Insert: {
          created_at?: string
          event_type?: string | null
          external_event_id: string
          id?: string
          payload?: Json | null
          processed?: boolean
          provider: string
        }
        Update: {
          created_at?: string
          event_type?: string | null
          external_event_id?: string
          id?: string
          payload?: Json | null
          processed?: boolean
          provider?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          image_url: string
          is_primary: boolean
          product_id: string
          sort_order: number
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url: string
          is_primary?: boolean
          product_id: string
          sort_order?: number
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url?: string
          is_primary?: boolean
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_specifications: {
        Row: {
          id: string
          name: string
          product_id: string
          sort_order: number
          unit: string | null
          value: string
        }
        Insert: {
          id?: string
          name: string
          product_id: string
          sort_order?: number
          unit?: string | null
          value: string
        }
        Update: {
          id?: string
          name?: string
          product_id?: string
          sort_order?: number
          unit?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_specifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_specifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          accent: string | null
          available_stock: number | null
          blister_stock: number
          blister_simple_units: number | null
          brand: string
          category_id: string | null
          cost: number | null
          created_at: string
          description: string | null
          distributor_price: number | null
          featured: boolean
          height: number | null
          icon: string | null
          id: string
          length: number | null
          master_box_units: number | null
          master_box_stock: number
          minimum_stock: number
          name: string
          physical_stock: number
          professional_price: number | null
          reserved_stock: number
          retail_price: number
          short_description: string | null
          short_name: string | null
          sku: string
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          updated_at: string
          warranty_months: number
          weight: number | null
          wholesale_price: number | null
          width: number | null
        }
        Insert: {
          accent?: string | null
          available_stock?: number | null
          blister_stock?: number
          blister_simple_units?: number | null
          brand?: string
          category_id?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          distributor_price?: number | null
          featured?: boolean
          height?: number | null
          icon?: string | null
          id?: string
          length?: number | null
          master_box_units?: number | null
          master_box_stock?: number
          minimum_stock?: number
          name: string
          physical_stock?: number
          professional_price?: number | null
          reserved_stock?: number
          retail_price: number
          short_description?: string | null
          short_name?: string | null
          sku: string
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
          warranty_months?: number
          weight?: number | null
          wholesale_price?: number | null
          width?: number | null
        }
        Update: {
          accent?: string | null
          available_stock?: number | null
          blister_stock?: number
          blister_simple_units?: number | null
          brand?: string
          category_id?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          distributor_price?: number | null
          featured?: boolean
          height?: number | null
          icon?: string | null
          id?: string
          length?: number | null
          master_box_units?: number | null
          master_box_stock?: number
          minimum_stock?: number
          name?: string
          physical_stock?: number
          professional_price?: number | null
          reserved_stock?: number
          retail_price?: number
          short_description?: string | null
          short_name?: string | null
          sku?: string
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
          warranty_months?: number
          weight?: number | null
          wholesale_price?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          is_admin: boolean
          b2b_review_note: string | null
          b2b_reviewed_at: string | null
          b2b_reviewed_by: string | null
          b2b_status: Database["public"]["Enums"]["b2b_status"]
          company_name: string | null
          company_rut: string | null
          created_at: string
          customer_type: Database["public"]["Enums"]["customer_type"]
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          rut: string | null
          updated_at: string
        }
        Insert: {
          is_admin?: boolean
          b2b_review_note?: string | null
          b2b_reviewed_at?: string | null
          b2b_reviewed_by?: string | null
          b2b_status?: Database["public"]["Enums"]["b2b_status"]
          company_name?: string | null
          company_rut?: string | null
          created_at?: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          rut?: string | null
          updated_at?: string
        }
        Update: {
          is_admin?: boolean
          b2b_review_note?: string | null
          b2b_reviewed_at?: string | null
          b2b_reviewed_by?: string | null
          b2b_status?: Database["public"]["Enums"]["b2b_status"]
          company_name?: string | null
          company_rut?: string | null
          created_at?: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          rut?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          quote_id: string
          sku: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name: string
          quantity: number
          quote_id: string
          sku: string
          subtotal?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          quote_id?: string
          sku?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          admin_notes: string | null
          created_at: string
          customer_notes: string | null
          discount_total: number
          id: string
          quote_number: string
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
          valid_until: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          customer_notes?: string | null
          discount_total?: number
          id?: string
          quote_number?: string
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
          valid_until?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          customer_notes?: string | null
          discount_total?: number
          id?: string
          quote_number?: string
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      shipping_zones: {
        Row: {
          active: boolean
          base_price: number
          commune: string | null
          created_at: string
          free_shipping_threshold: number | null
          id: string
          region: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_price?: number
          commune?: string | null
          created_at?: string
          free_shipping_threshold?: number | null
          id?: string
          region: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_price?: number
          commune?: string | null
          created_at?: string
          free_shipping_threshold?: number | null
          id?: string
          region?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      volume_price_rules: {
        Row: {
          active: boolean
          created_at: string
          customer_type: Database["public"]["Enums"]["customer_type"] | null
          discount_percentage: number | null
          fixed_unit_price: number | null
          id: string
          max_quantity: number | null
          min_quantity: number
          product_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          customer_type?: Database["public"]["Enums"]["customer_type"] | null
          discount_percentage?: number | null
          fixed_unit_price?: number | null
          id?: string
          max_quantity?: number | null
          min_quantity: number
          product_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          customer_type?: Database["public"]["Enums"]["customer_type"] | null
          discount_percentage?: number | null
          fixed_unit_price?: number | null
          id?: string
          max_quantity?: number | null
          min_quantity?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "volume_price_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volume_price_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      products_public: {
        Row: {
          accent: string | null
          available_stock: number | null
          blister_simple_units: number | null
          brand: string | null
          category_id: string | null
          category_name: string | null
          category_slug: string | null
          created_at: string | null
          description: string | null
          featured: boolean | null
          height: number | null
          icon: string | null
          id: string | null
          length: number | null
          master_box_units: number | null
          name: string | null
          retail_price: number | null
          short_description: string | null
          short_name: string | null
          sku: string | null
          slug: string | null
          status: Database["public"]["Enums"]["product_status"] | null
          warranty_months: number | null
          weight: number | null
          width: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_archive_product: {
        Args: { _product_id: string }
        Returns: undefined
      }
      admin_restore_product: {
        Args: { _product_id: string }
        Returns: undefined
      }
      effective_price_tier: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["customer_type"]
      }
      ensure_my_profile: {
        Args: never
        Returns: Database["public"]["Tables"]["profiles"]["Row"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      product_base_price: {
        Args: {
          _product: Database["public"]["Tables"]["products"]["Row"]
          _tier: Database["public"]["Enums"]["customer_type"]
        }
        Returns: number
      }
      resolve_cart_prices: {
        Args: { _items: Json }
        Returns: {
          available_stock: number
          blister_stock: number
          base_price: number
          discount_percentage: number
          product_id: string
          tier: Database["public"]["Enums"]["customer_type"]
          unit_price: number
        }[]
      }
      resolve_prices: {
        Args: { _product_ids: string[]; _quantity?: number }
        Returns: {
          available_stock: number
          base_price: number
          discount_percentage: number
          product_id: string
          tier: Database["public"]["Enums"]["customer_type"]
          unit_price: number
        }[]
      }
      request_b2b_access: {
        Args: {
          _company_name?: string | null
          _company_rut?: string | null
          _customer_type: Database["public"]["Enums"]["customer_type"]
        }
        Returns: undefined
      }
      review_b2b_access: {
        Args: { _approved: boolean; _note?: string | null; _user_id: string }
        Returns: undefined
      }
      admin_catalog_products: {
        Args: never
        Returns: {
          available_stock: number
          blister_simple_units: number | null
          category_id: string | null
          category_name: string | null
          description: string | null
          id: string
          image_url: string | null
          master_box_units: number | null
          master_box_stock: number
          minimum_stock: number
          name: string
          physical_stock: number
          reserved_stock: number
          retail_price: number
          sku: string
          status: Database["public"]["Enums"]["product_status"]
        }[]
      }
      admin_set_product_stock: {
        Args: {
          _note?: string | null
          _physical_stock: number
          _product_id: string
        }
        Returns: undefined
      }
      admin_set_product_packaging_stock: {
        Args: {
          _blister_stock: number
          _master_box_stock: number
          _note?: string | null
          _product_id: string
        }
        Returns: undefined
      }
      admin_update_product: {
        Args: {
          _blister_simple_units?: number | null
          _category_id: string | null
          _description: string
          _master_box_units?: number | null
          _minimum_stock: number
          _name: string
          _product_id: string
          _retail_price: number
          _sku: string
          _status: Database["public"]["Enums"]["product_status"]
        }
        Returns: undefined
      }
      admin_inventory: {
        Args: never
        Returns: {
          available_stock: number
          minimum_stock: number
          name: string
          physical_stock: number
          product_id: string
          reserved_stock: number
          retail_price: number
          sku: string
          status: Database["public"]["Enums"]["product_status"]
        }[]
      }
      resolve_shipping: {
        Args: { _commune?: string | null; _region: string; _subtotal?: number }
        Returns: {
          free_shipping_threshold: number | null
          shipping_total: number
          zone_id: string
        }[]
      }
      create_quote_request: {
        Args: { _customer_notes?: string | null; _items: Json }
        Returns: { quote_id: string; quote_number: string; total: number }[]
      }
      review_quote_request: {
        Args: { _note?: string | null; _quote_id: string; _reject?: boolean }
        Returns: undefined
      }
      create_bank_transfer_order: {
        Args: { _customer: Json; _idempotency_key: string; _items: Json }
        Returns: {
          order_id: string
          order_number: string
          reservation_expires_at: string | null
          shipping_total: number
          subtotal: number
          total: number
        }[]
      }
      cancel_order: { Args: { _order_id: string }; Returns: undefined }
      confirm_bank_transfer: { Args: { _order_id: string }; Returns: undefined }
      advance_order_fulfillment: {
        Args: {
          _order_id: string
          _target: Database["public"]["Enums"]["fulfillment_status"]
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "staff"
      b2b_status:
        "not_required" | "pending" | "approved" | "rejected" | "suspended"
      customer_type:
        | "retail"
        | "professional"
        | "company"
        | "wholesale"
        | "distributor"
        | "admin"
      fulfillment_status:
        | "unfulfilled"
        | "preparing"
        | "ready"
        | "shipped"
        | "delivered"
        | "returned"
      inventory_movement_type:
        | "purchase"
        | "sale"
        | "reservation"
        | "reservation_release"
        | "adjustment"
        | "return"
        | "cancelation"
      order_status:
        | "pending"
        | "confirmed"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
      payment_method: "bank_transfer" | "mercadopago"
      payment_status:
        | "pending"
        | "awaiting_transfer"
        | "paid"
        | "failed"
        | "refunded"
        | "partially_refunded"
        | "cancelled"
      product_status: "draft" | "active" | "out_of_stock" | "discontinued"
      quote_status:
        | "requested"
        | "reviewing"
        | "sent"
        | "accepted"
        | "rejected"
        | "expired"
        | "converted"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff"],
      b2b_status: [
        "not_required",
        "pending",
        "approved",
        "rejected",
        "suspended",
      ],
      customer_type: [
        "retail",
        "professional",
        "company",
        "wholesale",
        "distributor",
        "admin",
      ],
      fulfillment_status: [
        "unfulfilled",
        "preparing",
        "ready",
        "shipped",
        "delivered",
        "returned",
      ],
      inventory_movement_type: [
        "purchase",
        "sale",
        "reservation",
        "reservation_release",
        "adjustment",
        "return",
        "cancelation",
      ],
      order_status: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      payment_method: ["bank_transfer", "mercadopago"],
      payment_status: [
        "pending",
        "awaiting_transfer",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
        "cancelled",
      ],
      product_status: ["draft", "active", "out_of_stock", "discontinued"],
      quote_status: [
        "requested",
        "reviewing",
        "sent",
        "accepted",
        "rejected",
        "expired",
        "converted",
      ],
    },
  },
} as const
