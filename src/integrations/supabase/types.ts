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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      animations: {
        Row: {
          asset_id: string
          created_at: string
          fps: number
          frame_data: Json
          id: string
          name: string
          user_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          fps?: number
          frame_data?: Json
          id?: string
          name?: string
          user_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          fps?: number
          frame_data?: Json
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "animations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          credits_used: number
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          prefix: string
          request_count: number
          revoked_at: string | null
          rotated_from: string | null
          scopes: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_used?: number
          id?: string
          key_hash: string
          last_used_at?: string | null
          name?: string
          prefix: string
          request_count?: number
          revoked_at?: string | null
          rotated_from?: string | null
          scopes?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          credits_used?: number
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
          request_count?: number
          revoked_at?: string | null
          rotated_from?: string | null
          scopes?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_rotated_from_fkey"
            columns: ["rotated_from"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_maps: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          map_type: string
          storage_path: string
          user_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          map_type: string
          storage_path: string
          user_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          map_type?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_maps_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_type: string
          created_at: string
          final_prompt: string | null
          id: string
          metadata: Json
          name: string
          params: Json
          project_id: string
          prompt: string
          storage_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_type?: string
          created_at?: string
          final_prompt?: string | null
          id?: string
          metadata?: Json
          name?: string
          params?: Json
          project_id: string
          prompt?: string
          storage_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          final_prompt?: string | null
          id?: string
          metadata?: Json
          name?: string
          params?: Json
          project_id?: string
          prompt?: string
          storage_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string
          created_at: string
          details: Json
          id: string
          target_id: string | null
          target_type: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id: string
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      generation_runs: {
        Row: {
          action: string | null
          api_key_id: string | null
          asset_id: string | null
          created_at: string
          credits: number
          duration_ms: number | null
          error: string | null
          id: string
          kind: string
          meta: Json
          mode: string | null
          model: string | null
          project_id: string | null
          prompt: string | null
          size: string | null
          source: string
          status: string
          user_id: string
          view: string | null
        }
        Insert: {
          action?: string | null
          api_key_id?: string | null
          asset_id?: string | null
          created_at?: string
          credits?: number
          duration_ms?: number | null
          error?: string | null
          id?: string
          kind?: string
          meta?: Json
          mode?: string | null
          model?: string | null
          project_id?: string | null
          prompt?: string | null
          size?: string | null
          source?: string
          status?: string
          user_id: string
          view?: string | null
        }
        Update: {
          action?: string | null
          api_key_id?: string | null
          asset_id?: string | null
          created_at?: string
          credits?: number
          duration_ms?: number | null
          error?: string | null
          id?: string
          kind?: string
          meta?: Json
          mode?: string | null
          model?: string | null
          project_id?: string | null
          prompt?: string | null
          size?: string | null
          source?: string
          status?: string
          user_id?: string
          view?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_runs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_runs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          last_seen_at: string | null
          plan: string
          trial_credits: number
          trial_ends_at: string
          trial_started_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          last_seen_at?: string | null
          plan?: string
          trial_credits?: number
          trial_ends_at?: string
          trial_started_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          last_seen_at?: string | null
          plan?: string
          trial_credits?: number
          trial_ends_at?: string
          trial_started_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          credit_budget: number
          description: string | null
          export_preset: Json
          id: string
          name: string
          style_profile: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_budget?: number
          description?: string | null
          export_preset?: Json
          id?: string
          name: string
          style_profile?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credit_budget?: number
          description?: string | null
          export_preset?: Json
          id?: string
          name?: string
          style_profile?: Json
          updated_at?: string
          user_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
