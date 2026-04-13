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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          created_at: string
          created_by: string
          id: string
          message: string
          target_audience: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          message: string
          target_audience?: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          message?: string
          target_audience?: string
          title?: string
        }
        Relationships: []
      }
      demand_zones: {
        Row: {
          bonus_amount: number
          created_at: string
          driver_count: number
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          name: string
          order_count: number
          radius_km: number
          updated_at: string
        }
        Insert: {
          bonus_amount?: number
          created_at?: string
          driver_count?: number
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          name: string
          order_count?: number
          radius_km?: number
          updated_at?: string
        }
        Update: {
          bonus_amount?: number
          created_at?: string
          driver_count?: number
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          name?: string
          order_count?: number
          radius_km?: number
          updated_at?: string
        }
        Relationships: []
      }
      driver_locations: {
        Row: {
          driver_id: string
          heading: number | null
          id: string
          latitude: number
          longitude: number
          speed: number | null
          updated_at: string
        }
        Insert: {
          driver_id: string
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          speed?: number | null
          updated_at?: string
        }
        Update: {
          driver_id?: string
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          speed?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      driver_profiles: {
        Row: {
          account_holder: string | null
          bank_name: string | null
          created_at: string
          driver_code: string | null
          iban: string | null
          id: string
          id_document_url: string | null
          is_active: boolean
          layout: string
          license_document_url: string | null
          license_expiry: string | null
          license_number: string | null
          license_plate: string | null
          updated_at: string
          user_id: string
          vehicle_color: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_type: string | null
          vehicle_year: number | null
        }
        Insert: {
          account_holder?: string | null
          bank_name?: string | null
          created_at?: string
          driver_code?: string | null
          iban?: string | null
          id?: string
          id_document_url?: string | null
          is_active?: boolean
          layout?: string
          license_document_url?: string | null
          license_expiry?: string | null
          license_number?: string | null
          license_plate?: string | null
          updated_at?: string
          user_id: string
          vehicle_color?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_type?: string | null
          vehicle_year?: number | null
        }
        Update: {
          account_holder?: string | null
          bank_name?: string | null
          created_at?: string
          driver_code?: string | null
          iban?: string | null
          id?: string
          id_document_url?: string | null
          is_active?: boolean
          layout?: string
          license_document_url?: string | null
          license_expiry?: string | null
          license_number?: string | null
          license_plate?: string | null
          updated_at?: string
          user_id?: string
          vehicle_color?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_type?: string | null
          vehicle_year?: number | null
        }
        Relationships: []
      }
      driver_referrals: {
        Row: {
          bonus_amount: number
          completed_at: string | null
          created_at: string
          id: string
          referral_code: string
          referred_id: string | null
          referrer_id: string
          status: string
        }
        Insert: {
          bonus_amount?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          referral_code: string
          referred_id?: string | null
          referrer_id: string
          status?: string
        }
        Update: {
          bonus_amount?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string | null
          referrer_id?: string
          status?: string
        }
        Relationships: []
      }
      driver_wallets: {
        Row: {
          available_balance: number
          created_at: string
          driver_id: string
          id: string
          pending_balance: number
          total_withdrawn: number
          updated_at: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          driver_id: string
          id?: string
          pending_balance?: number
          total_withdrawn?: number
          updated_at?: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          driver_id?: string
          id?: string
          pending_balance?: number
          total_withdrawn?: number
          updated_at?: string
        }
        Relationships: []
      }
      earnings: {
        Row: {
          base_pay: number
          bonus: number | null
          created_at: string
          driver_id: string
          id: string
          order_id: string | null
          tip: number | null
          total: number | null
        }
        Insert: {
          base_pay?: number
          bonus?: number | null
          created_at?: string
          driver_id: string
          id?: string
          order_id?: string | null
          tip?: number | null
          total?: number | null
        }
        Update: {
          base_pay?: number
          bonus?: number | null
          created_at?: string
          driver_id?: string
          id?: string
          order_id?: string | null
          tip?: number | null
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "earnings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean | null
          is_snoozed: boolean | null
          name: string
          price: number
          store_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_snoozed?: boolean | null
          name: string
          price: number
          store_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_snoozed?: boolean | null
          name?: string
          price?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string | null
          name: string
          order_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id?: string | null
          name: string
          order_id: string
          quantity?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string | null
          name?: string
          order_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string | null
          delivery_address: string | null
          delivery_fee: number | null
          delivery_latitude: number | null
          delivery_longitude: number | null
          driver_id: string | null
          estimated_prep_time: number | null
          id: string
          notes: string | null
          photo_verification_url: string | null
          pickup_checklist: Json | null
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          tip_amount: number | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          driver_id?: string | null
          estimated_prep_time?: number | null
          id?: string
          notes?: string | null
          photo_verification_url?: string | null
          pickup_checklist?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          tip_amount?: number | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          driver_id?: string | null
          estimated_prep_time?: number | null
          id?: string
          notes?: string | null
          photo_verification_url?: string | null
          pickup_checklist?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          tip_amount?: number | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          assignment_mode: string
          id: number
          updated_at: string
        }
        Insert: {
          assignment_mode?: string
          id?: number
          updated_at?: string
        }
        Update: {
          assignment_mode?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          current_uses: number
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_order_amount: number
          store_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_amount?: number
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_amount?: number
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          order_id: string
          rating: number
          store_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id: string
          id?: string
          order_id: string
          rating: number
          store_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          order_id?: string
          rating?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_addresses: {
        Row: {
          address: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          latitude: number | null
          longitude: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          address: string
          busy_mode: boolean | null
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          owner_id: string
          phone: string | null
          prep_buffer_minutes: number | null
          updated_at: string
        }
        Insert: {
          address: string
          busy_mode?: boolean | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          owner_id: string
          phone?: string | null
          prep_buffer_minutes?: number | null
          updated_at?: string
        }
        Update: {
          address?: string
          busy_mode?: boolean | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          owner_id?: string
          phone?: string | null
          prep_buffer_minutes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          description: string | null
          driver_id: string
          id: string
          order_id: string | null
          photo_url: string | null
          resolution_notes: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          driver_id: string
          id?: string
          order_id?: string | null
          photo_url?: string | null
          resolution_notes?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          driver_id?: string
          id?: string
          order_id?: string | null
          photo_url?: string | null
          resolution_notes?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
      wait_time_bonuses: {
        Row: {
          arrived_at: string
          bonus_amount: number | null
          created_at: string
          driver_id: string
          id: string
          is_applied: boolean | null
          order_id: string | null
          picked_up_at: string | null
          wait_minutes: number | null
        }
        Insert: {
          arrived_at?: string
          bonus_amount?: number | null
          created_at?: string
          driver_id: string
          id?: string
          is_applied?: boolean | null
          order_id?: string | null
          picked_up_at?: string | null
          wait_minutes?: number | null
        }
        Update: {
          arrived_at?: string
          bonus_amount?: number | null
          created_at?: string
          driver_id?: string
          id?: string
          is_applied?: boolean | null
          order_id?: string | null
          picked_up_at?: string | null
          wait_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wait_time_bonuses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          driver_id: string
          id: string
          order_id: string | null
          status: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          driver_id: string
          id?: string
          order_id?: string | null
          status?: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          driver_id?: string
          id?: string
          order_id?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_driver_earning: {
        Args: {
          p_base_pay: number
          p_bonus?: number
          p_driver_id: string
          p_order_id: string
          p_tip?: number
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      request_wallet_withdrawal: {
        Args: { p_amount: number; p_driver_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "driver" | "store" | "customer" | "admin"
      discount_type: "percentage" | "fixed"
      order_status:
        | "pending"
        | "placed"
        | "accepted"
        | "preparing"
        | "ready"
        | "arrived"
        | "picked_up"
        | "delivered"
        | "cancelled"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["driver", "store", "customer", "admin"],
      discount_type: ["percentage", "fixed"],
      order_status: [
        "pending",
        "placed",
        "accepted",
        "preparing",
        "ready",
        "arrived",
        "picked_up",
        "delivered",
        "cancelled",
      ],
    },
  },
} as const
