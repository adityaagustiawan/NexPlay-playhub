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
      age_verifications: {
        Row: {
          bracket: string
          captcha_passed: boolean
          created_at: string
          declared_age: number
          dev_agreement_accepted: boolean
          device_hash: string
          guardian_acknowledged: boolean
          id: string
          parental_control_notice: boolean
          policy_accepted: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          bracket: string
          captcha_passed?: boolean
          created_at?: string
          declared_age: number
          dev_agreement_accepted?: boolean
          device_hash: string
          guardian_acknowledged?: boolean
          id?: string
          parental_control_notice?: boolean
          policy_accepted?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          bracket?: string
          captcha_passed?: boolean
          created_at?: string
          declared_age?: number
          dev_agreement_accepted?: boolean
          device_hash?: string
          guardian_acknowledged?: boolean
          id?: string
          parental_control_notice?: boolean
          policy_accepted?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_agreements: {
        Row: {
          accepted_at: string
          declared_age: number | null
          device_hash: string | null
          policy_version: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          declared_age?: number | null
          device_hash?: string | null
          policy_version: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          declared_age?: number | null
          device_hash?: string | null
          policy_version?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_purchases: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          status: string
          tier: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          id?: string
          status?: string
          tier: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          status?: string
          tier?: string
          user_id?: string
        }
        Relationships: []
      }
      devcoin_ledger: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          kind: string
          note: string | null
          ref_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          ref_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          ref_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      devcoin_payouts: {
        Row: {
          amount_cents: number
          devcoins: number
          id: string
          method: string | null
          note: string | null
          requested_at: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          devcoins: number
          id?: string
          method?: string | null
          note?: string | null
          requested_at: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          ref_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      device_age_records: {
        Row: {
          bracket: string
          dev_agreement_accepted: boolean
          device_hash: string
          first_seen_at: string
          guardian_acknowledged: boolean
          last_seen_at: string
          parental_control_notice: boolean
        }
        Insert: {
          bracket: string
          dev_agreement_accepted?: boolean
          device_hash: string
          first_seen_at?: string
          guardian_acknowledged?: boolean
          last_seen_at?: string
          parental_control_notice?: boolean
        }
        Update: {
          bracket?: string
          dev_agreement_accepted?: boolean
          device_hash?: string
          first_seen_at?: string
          guardian_acknowledged?: boolean
          last_seen_at?: string
          parental_control_notice?: boolean
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string | null
          friend_id: string
          id: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          friend_id: string
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          friend_id?: string
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      game_analytics: {
        Row: {
          daily_favorites: number | null
          daily_likes: number | null
          daily_plays: number | null
          date: string | null
          game_id: string
          id: string
        }
        Insert: {
          daily_favorites?: number | null
          daily_likes?: number | null
          daily_plays?: number | null
          date?: string | null
          game_id: string
          id?: string
        }
        Update: {
          daily_favorites?: number | null
          daily_likes?: number | null
          daily_plays?: number | null
          date?: string | null
          game_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_analytics_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_items: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          creator_id: string
          description: string | null
          emoji: string | null
          game_id: string
          id: string
          name: string
          price_coins: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          creator_id: string
          description?: string | null
          emoji?: string | null
          game_id: string
          id?: string
          name: string
          price_coins?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          creator_id?: string
          description?: string | null
          emoji?: string | null
          game_id?: string
          id?: string
          name?: string
          price_coins?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_items_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_progress: {
        Row: {
          completed: boolean
          created_at: string
          game_id: string
          game_image: string | null
          game_title: string | null
          id: string
          last_played_at: string
          level: number
          play_seconds: number
          progress: Json
          score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          game_id: string
          game_image?: string | null
          game_title?: string | null
          id?: string
          last_played_at?: string
          level?: number
          play_seconds?: number
          progress?: Json
          score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string
          game_id?: string
          game_image?: string | null
          game_title?: string | null
          id?: string
          last_played_at?: string
          level?: number
          play_seconds?: number
          progress?: Json
          score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          assets: Json
          created_at: string | null
          description: string | null
          engine_type: string | null
          external_id: string | null
          favorites: number | null
          game_key: string | null
          game_url: string | null
          gameplay: Json
          id: string
          image_url: string | null
          is_draft: boolean | null
          is_external: boolean | null
          likes: number | null
          plays: number | null
          released_at: string | null
          status: string | null
          studio_data: Json | null
          title: string
          updated_at: string | null
          user_id: string
          version: number
        }
        Insert: {
          assets?: Json
          created_at?: string | null
          description?: string | null
          engine_type?: string | null
          external_id?: string | null
          favorites?: number | null
          game_key?: string | null
          game_url?: string | null
          gameplay: Json
          id?: string
          image_url?: string | null
          is_draft?: boolean | null
          is_external?: boolean | null
          likes?: number | null
          plays?: number | null
          released_at?: string | null
          status?: string | null
          studio_data?: Json | null
          title: string
          updated_at?: string | null
          user_id: string
          version?: number
        }
        Update: {
          assets?: Json
          created_at?: string | null
          description?: string | null
          engine_type?: string | null
          external_id?: string | null
          favorites?: number | null
          game_key?: string | null
          game_url?: string | null
          gameplay?: Json
          id?: string
          image_url?: string | null
          is_draft?: boolean | null
          is_external?: boolean | null
          likes?: number | null
          plays?: number | null
          released_at?: string | null
          status?: string | null
          studio_data?: Json | null
          title?: string
          updated_at?: string | null
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "games_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      item_purchases: {
        Row: {
          buyer_id: string
          created_at: string
          creator_id: string
          devcoins_credited: number
          game_id: string
          id: string
          item_id: string
          price_coins: number
        }
        Insert: {
          buyer_id: string
          created_at?: string
          creator_id: string
          devcoins_credited: number
          game_id: string
          id?: string
          item_id: string
          price_coins?: number
        }
        Update: {
          buyer_id?: string
          created_at?: string
          creator_id?: string
          devcoins_credited?: number
          game_id?: string
          id?: string
          item_id?: string
          price_coins?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_purchases_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "game_items"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_global: boolean | null
          read: boolean | null
          receiver_id: string | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_global?: boolean | null
          read?: boolean | null
          receiver_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_global?: boolean | null
          read?: boolean | null
          receiver_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          reason: string | null
          target_user_id: string
          until: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          reason?: string | null
          target_user_id: string
          until?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          target_user_id?: string
          until?: string | null
        }
        Relationships: []
      }
      nexcode_learning: {
        Row: {
          config: Json
          created_at: string
          difficulty: string | null
          game_id: string | null
          id: string
          mode: string | null
          prompt: string
          rated_at: string | null
          rating: number | null
          theme: string | null
          user_id: string
        }
        Insert: {
          config: Json
          created_at?: string
          difficulty?: string | null
          game_id?: string | null
          id?: string
          mode?: string | null
          prompt: string
          rated_at?: string | null
          rating?: number | null
          theme?: string | null
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          difficulty?: string | null
          game_id?: string | null
          id?: string
          mode?: string | null
          prompt?: string
          rated_at?: string | null
          rating?: number | null
          theme?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nexcode_learning_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      player_progress: {
        Row: {
          data: Json
          game_id: string
          id: string
          player_id: string
          updated_at: string
        }
        Insert: {
          data: Json
          game_id: string
          id?: string
          player_id: string
          updated_at: string
        }
        Update: {
          data?: Json
          game_id?: string
          id?: string
          player_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_progress_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned_reason: string | null
          banner_url: string | null
          bio: string | null
          coins: number
          created_at: string
          creator_tier: string | null
          devcoins: number
          display_name: string | null
          id: string
          is_banned: boolean | null
          is_online: boolean | null
          last_seen_at: string | null
          last_username_change: string | null
          name_color: string | null
          presence_mode: string | null
          profile_frame: string | null
          public_id: string | null
          role: string | null
          social_discord: string | null
          social_instagram: string | null
          social_tiktok: string | null
          social_twitter: string | null
          social_website: string | null
          social_youtube: string | null
          suspended_reason: string | null
          suspended_until: string | null
          updated_at: string
          user_id: string
          vip_status: string | null
        }
        Insert: {
          avatar_url?: string | null
          banned_reason?: string | null
          banner_url?: string | null
          bio?: string | null
          coins?: number
          created_at?: string
          creator_tier?: string | null
          devcoins?: number
          display_name?: string | null
          id?: string
          is_banned?: boolean | null
          is_online?: boolean | null
          last_seen_at?: string | null
          last_username_change?: string | null
          name_color?: string | null
          presence_mode?: string | null
          profile_frame?: string | null
          public_id?: string | null
          role?: string | null
          social_discord?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          social_website?: string | null
          social_youtube?: string | null
          suspended_reason?: string | null
          suspended_until?: string | null
          updated_at?: string
          user_id: string
          vip_status?: string | null
        }
        Update: {
          avatar_url?: string | null
          banned_reason?: string | null
          banner_url?: string | null
          bio?: string | null
          coins?: number
          created_at?: string
          creator_tier?: string | null
          devcoins?: number
          display_name?: string | null
          id?: string
          is_banned?: boolean | null
          is_online?: boolean | null
          last_seen_at?: string | null
          last_username_change?: string | null
          name_color?: string | null
          presence_mode?: string | null
          profile_frame?: string | null
          public_id?: string | null
          role?: string | null
          social_discord?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          social_website?: string | null
          social_youtube?: string | null
          suspended_reason?: string | null
          suspended_until?: string | null
          updated_at?: string
          user_id?: string
          vip_status?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          action: string | null
          created_at: string | null
          id: string
          reason: string
          reported_user_id: string | null
          reporter_id: string | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          id?: string
          reason: string
          reported_user_id?: string | null
          reporter_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          id?: string
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Relationships: []
      }
      scores: {
        Row: {
          created_at: string
          game_id: string
          id: string
          player_id: string
          score: number
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          player_id: string
          score: number
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          player_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "scores_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      topup_payments: {
        Row: {
          amount_cents: number
          coins: number
          created_at: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          coins: number
          created_at?: string
          id: string
          status?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          coins?: number
          created_at?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_game: {
        Args: { game_status: string; game_user_id: string }
        Returns: boolean
      }
      generate_game_key: {
        Args: { released_at: string; slug: string }
        Returns: string
      }
      generate_unique_public_id_value: { Args: never; Returns: string }
      is_account_blocked: {
        Args: { uid: string }
        Returns: boolean
      }
      is_admin: {
        Args: never
        Returns: boolean
      }
      promote_admin_by_email: {
        Args: { admin_email: string }
        Returns: undefined
      }
      purchase_game_item: {
        Args: { p_buyer: string; p_item_id: string }
        Returns: Json
      }
      rate_generation: {
        Args: { p_id: string; p_rating: number }
        Returns: undefined
      }
      request_devcoin_payout: {
        Args: { p_devcoins: number; p_method: string; p_user: string }
        Returns: Json
      }
      resolve_devcoin_payout: {
        Args: {
          p_admin: string
          p_approve: boolean
          p_note: string
          p_payout_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"]
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Enums"][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
