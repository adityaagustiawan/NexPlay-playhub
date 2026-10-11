export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          avatar_url: string | null
          banned_reason: string | null
          bio: string | null
          coins: number
          created_at: string
          display_name: string | null
          devcoins: number
          id: string
          is_banned: boolean
          public_id: string | null
          role: string | null
          creator_tier: string | null
          suspended_reason: string | null
          suspended_until: string | null
          updated_at: string
          user_id: string
          vip_status: string | null
        }
        Insert: {
          avatar_url?: string | null
          banned_reason?: string | null
          bio?: string | null
          coins?: number
          created_at?: string
          display_name?: string | null
          id?: string
          is_banned?: boolean
          public_id?: string | null
          role?: string | null
          creator_tier?: string | null
          suspended_reason?: string | null
          suspended_until?: string | null
          updated_at?: string
          user_id: string
          vip_status?: string | null
        }
        Update: {
          avatar_url?: string | null
          banned_reason?: string | null
          bio?: string | null
          coins?: number
          created_at?: string
          display_name?: string | null
          id?: string
          is_banned?: boolean
          public_id?: string | null
          role?: string | null
          creator_tier?: string | null
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
          created_at: string
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
          created_at?: string
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
          created_at?: string
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
      games: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          image_url: string | null
          plays: number
          likes: number
          favorites: number
          created_at: string
          updated_at: string
          status: string | null
          studio_data: Json
          is_draft: boolean
          engine_type: string | null
          game_url: string | null
          external_id: string | null
          is_external: boolean
          game_key: string | null
          gameplay: Json
          assets: Json
          version: number
          released_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          image_url?: string | null
          plays?: number
          likes?: number
          favorites?: number
          created_at?: string
          updated_at?: string
          status?: string | null
          studio_data?: Json
          is_draft?: boolean
          engine_type?: string | null
          game_url?: string | null
          external_id?: string | null
          is_external?: boolean
          game_key?: string | null
          gameplay?: Json
          assets?: Json
          version?: number
          released_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          image_url?: string | null
          plays?: number
          likes?: number
          favorites?: number
          created_at?: string
          updated_at?: string
          status?: string | null
          studio_data?: Json
          is_draft?: boolean
          engine_type?: string | null
          game_url?: string | null
          external_id?: string | null
          is_external?: boolean
          game_key?: string | null
          gameplay?: Json
          assets?: Json
          version?: number
          released_at?: string | null
        }
        Relationships: []
      }
      player_progress: {
        Row: {
          id: string
          game_id: string
          player_id: string
          data: Json
          updated_at: string
        }
        Insert: {
          id?: string
          game_id: string
          player_id: string
          data?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          player_id?: string
          data?: Json
          updated_at?: string
        }
        Relationships: []
      }
      scores: {
        Row: {
          id: string
          game_id: string
          player_id: string
          score: number
          created_at: string
        }
        Insert: {
          id?: string
          game_id: string
          player_id: string
          score: number
          created_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          player_id?: string
          score?: number
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_game_key: {
        Args: { slug: string; released_at: string }
        Returns: string
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
    Enums: {},
  },
} as const
