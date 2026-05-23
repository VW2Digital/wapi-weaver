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
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip: string | null
          metadata: Json
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      campaign_messages: {
        Row: {
          attempts: number
          campaign_id: string
          contact_id: string | null
          conversation_id: string | null
          conversation_origin: string | null
          created_at: string
          delivered_at: string | null
          error: Json | null
          failed_at: string | null
          id: string
          pricing_billable: boolean | null
          pricing_category: string | null
          pricing_model: string | null
          read_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["message_status"]
          to_phone: string
          user_id: string
          wa_message_id: string | null
        }
        Insert: {
          attempts?: number
          campaign_id: string
          contact_id?: string | null
          conversation_id?: string | null
          conversation_origin?: string | null
          created_at?: string
          delivered_at?: string | null
          error?: Json | null
          failed_at?: string | null
          id?: string
          pricing_billable?: boolean | null
          pricing_category?: string | null
          pricing_model?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          to_phone: string
          user_id: string
          wa_message_id?: string | null
        }
        Update: {
          attempts?: number
          campaign_id?: string
          contact_id?: string | null
          conversation_id?: string | null
          conversation_origin?: string | null
          created_at?: string
          delivered_at?: string | null
          error?: Json | null
          failed_at?: string | null
          id?: string
          pricing_billable?: boolean | null
          pricing_category?: string | null
          pricing_model?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          to_phone?: string
          user_id?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          list_id: string | null
          message_type: Database["public"]["Enums"]["message_type"]
          name: string
          payload: Json
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          template_id: string | null
          totals: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          list_id?: string | null
          message_type: Database["public"]["Enums"]["message_type"]
          name: string
          payload?: Json
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          template_id?: string | null
          totals?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          list_id?: string | null
          message_type?: Database["public"]["Enums"]["message_type"]
          name?: string
          payload?: Json
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          template_id?: string | null
          totals?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          contact_id: string
          tag_id: string
          user_id: string
        }
        Insert: {
          contact_id: string
          tag_id: string
          user_id: string
        }
        Update: {
          contact_id?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          custom_fields: Json
          email: string | null
          id: string
          name: string | null
          opted_out: boolean
          phone_e164: string
          source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_fields?: Json
          email?: string | null
          id?: string
          name?: string | null
          opted_out?: boolean
          phone_e164: string
          source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_fields?: Json
          email?: string | null
          id?: string
          name?: string | null
          opted_out?: boolean
          phone_e164?: string
          source?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      list_contacts: {
        Row: {
          added_at: string
          contact_id: string
          list_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          contact_id: string
          list_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          contact_id?: string
          list_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_contacts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          body_tags: string | null
          cron_secret: string | null
          head_tags: string | null
          id: number
          meta_app_id: string | null
          meta_app_secret: string | null
          meta_config_id: string | null
          meta_graph_version: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_tags?: string | null
          cron_secret?: string | null
          head_tags?: string | null
          id?: number
          meta_app_id?: string | null
          meta_app_secret?: string | null
          meta_config_id?: string | null
          meta_graph_version?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_tags?: string | null
          cron_secret?: string | null
          head_tags?: string | null
          id?: number
          meta_app_id?: string | null
          meta_app_secret?: string | null
          meta_config_id?: string | null
          meta_graph_version?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          api_key: string
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          rate_limit_per_second: number
          updated_at: string
          whatsapp_access_token: string | null
          whatsapp_app_secret: string | null
          whatsapp_business_phone: string | null
          whatsapp_phone_number_id: string | null
          whatsapp_verify_token: string | null
          whatsapp_waba_id: string | null
        }
        Insert: {
          api_key?: string
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          rate_limit_per_second?: number
          updated_at?: string
          whatsapp_access_token?: string | null
          whatsapp_app_secret?: string | null
          whatsapp_business_phone?: string | null
          whatsapp_phone_number_id?: string | null
          whatsapp_verify_token?: string | null
          whatsapp_waba_id?: string | null
        }
        Update: {
          api_key?: string
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          rate_limit_per_second?: number
          updated_at?: string
          whatsapp_access_token?: string | null
          whatsapp_app_secret?: string | null
          whatsapp_business_phone?: string | null
          whatsapp_phone_number_id?: string | null
          whatsapp_verify_token?: string | null
          whatsapp_waba_id?: string | null
        }
        Relationships: []
      }
      schema_backups: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          size_bytes: number
          source: string
          sql: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          size_bytes?: number
          source?: string
          sql: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          size_bytes?: number
          source?: string
          sql?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          category: string | null
          components: Json
          id: string
          language: string
          meta_template_id: string | null
          name: string
          status: Database["public"]["Enums"]["template_status"]
          synced_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          components?: Json
          id?: string
          language: string
          meta_template_id?: string | null
          name: string
          status?: Database["public"]["Enums"]["template_status"]
          synced_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          components?: Json
          id?: string
          language?: string
          meta_template_id?: string | null
          name?: string
          status?: Database["public"]["Enums"]["template_status"]
          synced_at?: string
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
      webhook_events: {
        Row: {
          id: string
          processed: boolean
          raw: Json
          received_at: string
          source: string
        }
        Insert: {
          id?: string
          processed?: boolean
          raw: Json
          received_at?: string
          source?: string
        }
        Update: {
          id?: string
          processed?: boolean
          raw?: Json
          received_at?: string
          source?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_schema_backup: {
        Args: { _source?: string; _user?: string }
        Returns: string
      }
      cron_create_schema_backup: { Args: never; Returns: undefined }
      export_schema_sql: { Args: never; Returns: string }
      export_schema_sql_internal: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      campaign_status:
        | "draft"
        | "queued"
        | "running"
        | "done"
        | "failed"
        | "cancelled"
      message_status:
        | "pending"
        | "sending"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
      message_type: "template" | "text" | "media" | "interactive"
      template_status:
        | "APPROVED"
        | "PENDING"
        | "REJECTED"
        | "PAUSED"
        | "DISABLED"
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
      app_role: ["admin", "user"],
      campaign_status: [
        "draft",
        "queued",
        "running",
        "done",
        "failed",
        "cancelled",
      ],
      message_status: [
        "pending",
        "sending",
        "sent",
        "delivered",
        "read",
        "failed",
      ],
      message_type: ["template", "text", "media", "interactive"],
      template_status: [
        "APPROVED",
        "PENDING",
        "REJECTED",
        "PAUSED",
        "DISABLED",
      ],
    },
  },
} as const
