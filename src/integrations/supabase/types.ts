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
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string
          actor_name: string | null
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id: string
          actor_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          actor_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      admin_permissions: {
        Row: {
          can_manage_finances: boolean
          can_manage_orders: boolean
          can_manage_settings: boolean
          can_manage_users: boolean
          can_view_audit: boolean
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_manage_finances?: boolean
          can_manage_orders?: boolean
          can_manage_settings?: boolean
          can_manage_users?: boolean
          can_view_audit?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          scope?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_manage_finances?: boolean
          can_manage_orders?: boolean
          can_manage_settings?: boolean
          can_manage_users?: boolean
          can_view_audit?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          message: string
          target_audience: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          message: string
          target_audience?: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          message?: string
          target_audience?: string
          title?: string
        }
        Relationships: []
      }
      banned_devices: {
        Row: {
          banned_by: string | null
          created_at: string
          device_fingerprint: string
          id: string
          reason: string | null
          user_id: string | null
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          device_fingerprint: string
          id?: string
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          device_fingerprint?: string
          id?: string
          reason?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      canned_replies: {
        Row: {
          body: string
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      customer_favorites: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string | null
          store_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id?: string | null
          store_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string | null
          store_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      customer_rewards: {
        Row: {
          created_at: string
          id: string
          lifetime_points: number
          points: number
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lifetime_points?: number
          points?: number
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lifetime_points?: number
          points?: number
          tier?: string
          updated_at?: string
          user_id?: string
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
          availability: Json | null
          bank_name: string | null
          created_at: string
          date_of_birth: string | null
          driver_code: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          home_address: string | null
          iban: string | null
          id: string
          id_document_url: string | null
          is_active: boolean
          languages: string[] | null
          layout: string
          license_document_url: string | null
          license_expiry: string | null
          license_number: string | null
          license_plate: string | null
          secondary_phone: string | null
          suspended_at: string | null
          suspension_reason: string | null
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
          availability?: Json | null
          bank_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          driver_code?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          home_address?: string | null
          iban?: string | null
          id?: string
          id_document_url?: string | null
          is_active?: boolean
          languages?: string[] | null
          layout?: string
          license_document_url?: string | null
          license_expiry?: string | null
          license_number?: string | null
          license_plate?: string | null
          secondary_phone?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
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
          availability?: Json | null
          bank_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          driver_code?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          home_address?: string | null
          iban?: string | null
          id?: string
          id_document_url?: string | null
          is_active?: boolean
          languages?: string[] | null
          layout?: string
          license_document_url?: string | null
          license_expiry?: string | null
          license_number?: string | null
          license_plate?: string | null
          secondary_phone?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
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
      driver_state: {
        Row: {
          break_until: string | null
          daily_goal: number
          driver_id: string
          on_break: boolean
          shift_cash_balance: number
          shift_started_at: string | null
          updated_at: string
          weekly_goal: number
        }
        Insert: {
          break_until?: string | null
          daily_goal?: number
          driver_id: string
          on_break?: boolean
          shift_cash_balance?: number
          shift_started_at?: string | null
          updated_at?: string
          weekly_goal?: number
        }
        Update: {
          break_until?: string | null
          daily_goal?: number
          driver_id?: string
          on_break?: boolean
          shift_cash_balance?: number
          shift_started_at?: string | null
          updated_at?: string
          weekly_goal?: number
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
      feature_flags: {
        Row: {
          category: string
          description: string | null
          id: string
          is_enabled: boolean
          key: string
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          key: string
          label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          key?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      fraud_signals: {
        Row: {
          created_at: string
          details: Json
          id: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          signal_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          signal_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          signal_type?: string
          user_id?: string
        }
        Relationships: []
      }
      group_order_participants: {
        Row: {
          display_name: string | null
          group_order_id: string
          id: string
          items: Json
          joined_at: string
          paid: boolean
          subtotal: number
          user_id: string
        }
        Insert: {
          display_name?: string | null
          group_order_id: string
          id?: string
          items?: Json
          joined_at?: string
          paid?: boolean
          subtotal?: number
          user_id: string
        }
        Update: {
          display_name?: string | null
          group_order_id?: string
          id?: string
          items?: Json
          joined_at?: string
          paid?: boolean
          subtotal?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_order_participants_group_order_id_fkey"
            columns: ["group_order_id"]
            isOneToOne: false
            referencedRelation: "group_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      group_orders: {
        Row: {
          closes_at: string | null
          created_at: string
          delivery_address: string | null
          delivery_latitude: number | null
          delivery_longitude: number | null
          host_id: string
          id: string
          notes: string | null
          share_code: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          delivery_address?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          host_id: string
          id?: string
          notes?: string | null
          share_code: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          delivery_address?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          host_id?: string
          id?: string
          notes?: string | null
          share_code?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_item_modifiers: {
        Row: {
          created_at: string
          group_name: string
          id: string
          is_multi: boolean
          is_required: boolean
          menu_item_id: string
          option_name: string
          price_delta: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          group_name: string
          id?: string
          is_multi?: boolean
          is_required?: boolean
          menu_item_id: string
          option_name: string
          price_delta?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          group_name?: string
          id?: string
          is_multi?: boolean
          is_required?: boolean
          menu_item_id?: string
          option_name?: string
          price_delta?: number
          sort_order?: number
        }
        Relationships: []
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
          low_stock_threshold: number | null
          name: string
          price: number
          stock_count: number | null
          store_id: string
          track_inventory: boolean
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
          low_stock_threshold?: number | null
          name: string
          price: number
          stock_count?: number | null
          store_id: string
          track_inventory?: boolean
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
          low_stock_threshold?: number | null
          name?: string
          price?: number
          stock_count?: number | null
          store_id?: string
          track_inventory?: boolean
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
          {
            foreignKeyName: "menu_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_modifiers: {
        Row: {
          group_name: string
          id: string
          option_name: string
          order_item_id: string
          price_delta: number
        }
        Insert: {
          group_name: string
          id?: string
          option_name: string
          order_item_id: string
          price_delta?: number
        }
        Update: {
          group_name?: string
          id?: string
          option_name?: string
          order_item_id?: string
          price_delta?: number
        }
        Relationships: []
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
          cash_received: number | null
          change_due: number | null
          created_at: string
          customer_id: string | null
          delivery_address: string | null
          delivery_fee: number | null
          delivery_latitude: number | null
          delivery_longitude: number | null
          distance_km: number | null
          driver_id: string | null
          driver_payout: number
          estimated_prep_time: number | null
          external_ref: string | null
          group_order_id: string | null
          id: string
          notes: string | null
          payment_method: string
          photo_verification_url: string | null
          pickup_checklist: Json | null
          platform_profit: number
          refund_reason: string | null
          refunded_amount: number
          scheduled_for: string | null
          source: string
          status: Database["public"]["Enums"]["order_status"]
          store_charge: number
          store_id: string
          tip_amount: number | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          cash_received?: number | null
          change_due?: number | null
          created_at?: string
          customer_id?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          distance_km?: number | null
          driver_id?: string | null
          driver_payout?: number
          estimated_prep_time?: number | null
          external_ref?: string | null
          group_order_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          photo_verification_url?: string | null
          pickup_checklist?: Json | null
          platform_profit?: number
          refund_reason?: string | null
          refunded_amount?: number
          scheduled_for?: string | null
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          store_charge?: number
          store_id: string
          tip_amount?: number | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          cash_received?: number | null
          change_due?: number | null
          created_at?: string
          customer_id?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          distance_km?: number | null
          driver_id?: string | null
          driver_payout?: number
          estimated_prep_time?: number | null
          external_ref?: string | null
          group_order_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          photo_verification_url?: string | null
          pickup_checklist?: Json | null
          platform_profit?: number
          refund_reason?: string | null
          refunded_amount?: number
          scheduled_for?: string | null
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          store_charge?: number
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
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          assignment_mode: string
          base_pay: number
          bike_multiplier: number
          car_multiplier: number
          customer_base_fee: number
          customer_per_km_fee: number
          default_commission_pct: number
          dist_bike_max_km: number
          dist_car_min_value: number
          dist_distance_weight: number
          dist_fairness_weight: number
          dist_max_waves: number
          dist_min_acceptance_rate: number
          dist_min_driver_rating: number
          dist_motorcycle_max_km: number
          dist_offer_timeout_seconds: number
          dist_rating_weight: number
          dist_search_radius_km: number
          dist_vehicle_rules_enabled: boolean
          dist_wave_size: number
          distribution_mode: string
          id: number
          maintenance_message: string | null
          maintenance_mode: boolean
          min_pay: number
          motorcycle_multiplier: number
          peak_end_hour: number
          peak_multiplier: number
          peak_start_hour: number
          peak_weekdays: number[]
          per_km_rate: number
          show_stores_on_driver_map: boolean
          sla_agent_scaling: boolean
          sla_breach_seconds: number
          sla_tickets_per_agent: number
          sla_urgent_seconds: number
          sla_warn_seconds: number
          updated_at: string
        }
        Insert: {
          assignment_mode?: string
          base_pay?: number
          bike_multiplier?: number
          car_multiplier?: number
          customer_base_fee?: number
          customer_per_km_fee?: number
          default_commission_pct?: number
          dist_bike_max_km?: number
          dist_car_min_value?: number
          dist_distance_weight?: number
          dist_fairness_weight?: number
          dist_max_waves?: number
          dist_min_acceptance_rate?: number
          dist_min_driver_rating?: number
          dist_motorcycle_max_km?: number
          dist_offer_timeout_seconds?: number
          dist_rating_weight?: number
          dist_search_radius_km?: number
          dist_vehicle_rules_enabled?: boolean
          dist_wave_size?: number
          distribution_mode?: string
          id?: number
          maintenance_message?: string | null
          maintenance_mode?: boolean
          min_pay?: number
          motorcycle_multiplier?: number
          peak_end_hour?: number
          peak_multiplier?: number
          peak_start_hour?: number
          peak_weekdays?: number[]
          per_km_rate?: number
          show_stores_on_driver_map?: boolean
          sla_agent_scaling?: boolean
          sla_breach_seconds?: number
          sla_tickets_per_agent?: number
          sla_urgent_seconds?: number
          sla_warn_seconds?: number
          updated_at?: string
        }
        Update: {
          assignment_mode?: string
          base_pay?: number
          bike_multiplier?: number
          car_multiplier?: number
          customer_base_fee?: number
          customer_per_km_fee?: number
          default_commission_pct?: number
          dist_bike_max_km?: number
          dist_car_min_value?: number
          dist_distance_weight?: number
          dist_fairness_weight?: number
          dist_max_waves?: number
          dist_min_acceptance_rate?: number
          dist_min_driver_rating?: number
          dist_motorcycle_max_km?: number
          dist_offer_timeout_seconds?: number
          dist_rating_weight?: number
          dist_search_radius_km?: number
          dist_vehicle_rules_enabled?: boolean
          dist_wave_size?: number
          distribution_mode?: string
          id?: number
          maintenance_message?: string | null
          maintenance_mode?: boolean
          min_pay?: number
          motorcycle_multiplier?: number
          peak_end_hour?: number
          peak_multiplier?: number
          peak_start_hour?: number
          peak_weekdays?: number[]
          per_km_rate?: number
          show_stores_on_driver_map?: boolean
          sla_agent_scaling?: boolean
          sla_breach_seconds?: number
          sla_tickets_per_agent?: number
          sla_urgent_seconds?: number
          sla_warn_seconds?: number
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
          {
            foreignKeyName: "promo_codes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          customer_id: string | null
          id: string
          issued_by: string
          notes: string | null
          order_id: string
          reason: string | null
          refund_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id?: string | null
          id?: string
          issued_by: string
          notes?: string | null
          order_id: string
          reason?: string | null
          refund_type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          issued_by?: string
          notes?: string | null
          order_id?: string
          reason?: string | null
          refund_type?: string
        }
        Relationships: []
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
      reward_history: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          points_change: number
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          points_change: number
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          points_change?: number
          reason?: string
          user_id?: string
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
      store_auto_accept_rules: {
        Row: {
          default_prep_minutes: number
          enabled: boolean
          max_amount: number
          store_id: string
          updated_at: string
        }
        Insert: {
          default_prep_minutes?: number
          enabled?: boolean
          max_amount?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          default_prep_minutes?: number
          enabled?: boolean
          max_amount?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_daily_summary_log: {
        Row: {
          id: string
          sent_at: string
          store_id: string
          summary_date: string
        }
        Insert: {
          id?: string
          sent_at?: string
          store_id: string
          summary_date: string
        }
        Update: {
          id?: string
          sent_at?: string
          store_id?: string
          summary_date?: string
        }
        Relationships: []
      }
      store_pricing_overrides: {
        Row: {
          base_pay: number | null
          commission_pct: number | null
          min_pay: number | null
          per_km_rate: number | null
          store_id: string
          updated_at: string
        }
        Insert: {
          base_pay?: number | null
          commission_pct?: number | null
          min_pay?: number | null
          per_km_rate?: number | null
          store_id: string
          updated_at?: string
        }
        Update: {
          base_pay?: number | null
          commission_pct?: number | null
          min_pay?: number | null
          per_km_rate?: number | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_pricing_overrides_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_pricing_overrides_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string
          busy_mode: boolean | null
          created_at: string
          ext_billing_mode: string
          ext_commission_pct: number
          ext_flat_fee: number
          ext_margin_pct: number
          holiday_dates: string[] | null
          id: string
          image_url: string | null
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          opening_hours: Json | null
          owner_id: string
          phone: string | null
          prep_buffer_minutes: number | null
          suspended_at: string | null
          suspension_reason: string | null
          updated_at: string
        }
        Insert: {
          address: string
          busy_mode?: boolean | null
          created_at?: string
          ext_billing_mode?: string
          ext_commission_pct?: number
          ext_flat_fee?: number
          ext_margin_pct?: number
          holiday_dates?: string[] | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          opening_hours?: Json | null
          owner_id: string
          phone?: string | null
          prep_buffer_minutes?: number | null
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          busy_mode?: boolean | null
          created_at?: string
          ext_billing_mode?: string
          ext_commission_pct?: number
          ext_flat_fee?: number
          ext_margin_pct?: number
          holiday_dates?: string[] | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          opening_hours?: Json | null
          owner_id?: string
          phone?: string | null
          prep_buffer_minutes?: number | null
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_channel_members: {
        Row: {
          channel_id: string
          id: string
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "support_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      support_channels: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_team_messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          channel_id: string
          created_at: string
          id: string
          message: string | null
          sender_id: string
          sender_role: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          channel_id: string
          created_at?: string
          id?: string
          message?: string | null
          sender_id: string
          sender_role?: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          channel_id?: string
          created_at?: string
          id?: string
          message?: string | null
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_team_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "support_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          description: string | null
          driver_id: string | null
          id: string
          order_id: string | null
          photo_url: string | null
          priority: string
          requester_id: string | null
          requester_role: string
          resolution_notes: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          driver_id?: string | null
          id?: string
          order_id?: string | null
          photo_url?: string | null
          priority?: string
          requester_id?: string | null
          requester_role?: string
          resolution_notes?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          driver_id?: string | null
          id?: string
          order_id?: string | null
          photo_url?: string | null
          priority?: string
          requester_id?: string | null
          requester_role?: string
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
      surge_zones: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          multiplier: number
          name: string
          radius_km: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          multiplier?: number
          name: string
          radius_km?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          multiplier?: number
          name?: string
          radius_km?: number
          updated_at?: string
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          created_at: string
          id: string
          message: string | null
          sender_id: string
          sender_role: string
          ticket_id: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          message?: string | null
          sender_id: string
          sender_role: string
          ticket_id: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          message?: string | null
          sender_id?: string
          sender_role?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
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
      stores_public: {
        Row: {
          address: string | null
          busy_mode: boolean | null
          created_at: string | null
          id: string | null
          image_url: string | null
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          name: string | null
          owner_id: string | null
          phone: string | null
          prep_buffer_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          busy_mode?: boolean | null
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          owner_id?: string | null
          phone?: string | null
          prep_buffer_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          busy_mode?: boolean | null
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          owner_id?: string | null
          phone?: string | null
          prep_buffer_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_adjust_wallet: {
        Args: { p_amount: number; p_description: string; p_driver_id: string }
        Returns: undefined
      }
      count_active_support_agents: { Args: never; Returns: number }
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
      create_external_order: {
        Args: {
          p_customer_name?: string
          p_customer_phone?: string
          p_delivery_address: string
          p_delivery_lat?: number
          p_delivery_lng?: number
          p_distance_km?: number
          p_driver_payout_override?: number
          p_external_ref?: string
          p_items_summary?: string
          p_notes?: string
          p_source: string
          p_store_charge_override?: number
          p_store_id: string
          p_total_amount: number
        }
        Returns: string
      }
      get_public_reviews: {
        Args: { p_store_id?: string }
        Returns: {
          comment: string
          created_at: string
          id: string
          rating: number
          store_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_support_or_admin: { Args: { _user_id: string }; Returns: boolean }
      log_admin_action: {
        Args: {
          p_action: string
          p_description?: string
          p_metadata?: Json
          p_target_id?: string
          p_target_type?: string
        }
        Returns: undefined
      }
      refund_order: {
        Args: {
          p_amount: number
          p_notes?: string
          p_order_id: string
          p_reason: string
          p_refund_type?: string
        }
        Returns: string
      }
      request_wallet_withdrawal: {
        Args: { p_amount: number; p_driver_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "driver" | "store" | "customer" | "admin" | "support"
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
      app_role: ["driver", "store", "customer", "admin", "support"],
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
