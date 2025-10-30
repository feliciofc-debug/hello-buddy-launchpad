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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      integrations: {
        Row: {
          access_token: string
          created_at: string | null
          id: string
          is_active: boolean | null
          lomadee_app_token: string | null
          lomadee_connected_at: string | null
          lomadee_source_id: string | null
          meta_user_email: string | null
          meta_user_id: string | null
          meta_user_name: string | null
          platform: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          lomadee_app_token?: string | null
          lomadee_connected_at?: string | null
          lomadee_source_id?: string | null
          meta_user_email?: string | null
          meta_user_id?: string | null
          meta_user_name?: string | null
          platform: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          lomadee_app_token?: string | null
          lomadee_connected_at?: string | null
          lomadee_source_id?: string | null
          meta_user_email?: string | null
          meta_user_id?: string | null
          meta_user_name?: string | null
          platform?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          amazon_id: string | null
          cnae: string | null
          cnae_descricao: string | null
          cpf: string
          cpf_cnpj: string | null
          created_at: string
          endereco: Json | null
          hotmart_email: string | null
          id: string
          lomadee_id: string | null
          mercado_livre_id: string | null
          nome: string
          nome_fantasia: string | null
          plano: string | null
          razao_social: string | null
          shopee_id: string | null
          tipo: string | null
          updated_at: string
          valor_plano: number | null
          whatsapp: string
        }
        Insert: {
          amazon_id?: string | null
          cnae?: string | null
          cnae_descricao?: string | null
          cpf: string
          cpf_cnpj?: string | null
          created_at?: string
          endereco?: Json | null
          hotmart_email?: string | null
          id: string
          lomadee_id?: string | null
          mercado_livre_id?: string | null
          nome: string
          nome_fantasia?: string | null
          plano?: string | null
          razao_social?: string | null
          shopee_id?: string | null
          tipo?: string | null
          updated_at?: string
          valor_plano?: number | null
          whatsapp: string
        }
        Update: {
          amazon_id?: string | null
          cnae?: string | null
          cnae_descricao?: string | null
          cpf?: string
          cpf_cnpj?: string | null
          created_at?: string
          endereco?: Json | null
          hotmart_email?: string | null
          id?: string
          lomadee_id?: string | null
          mercado_livre_id?: string | null
          nome?: string
          nome_fantasia?: string | null
          plano?: string | null
          razao_social?: string | null
          shopee_id?: string | null
          tipo?: string | null
          updated_at?: string
          valor_plano?: number | null
          whatsapp?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          created_at: string
          expires_at: string | null
          id: string
          payment_id: string | null
          payment_method: string | null
          plan_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_id?: string | null
          payment_method?: string | null
          plan_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_id?: string | null
          payment_method?: string | null
          plan_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_bulk_sends: {
        Row: {
          campaign_name: string | null
          completed_at: string | null
          created_at: string
          delivered_count: number
          id: string
          message_template: string
          read_count: number
          response_count: number
          scheduled_at: string | null
          sent_count: number
          started_at: string | null
          status: string
          total_contacts: number
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_name?: string | null
          completed_at?: string | null
          created_at?: string
          delivered_count?: number
          id?: string
          message_template: string
          read_count?: number
          response_count?: number
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          total_contacts?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_name?: string | null
          completed_at?: string | null
          created_at?: string
          delivered_count?: number
          id?: string
          message_template?: string
          read_count?: number
          response_count?: number
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          total_contacts?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_contacts: {
        Row: {
          bulk_send_id: string
          created_at: string
          custom_fields: Json | null
          delivered_at: string | null
          error_message: string | null
          id: string
          name: string | null
          phone: string
          read_at: string | null
          responded_at: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          bulk_send_id: string
          created_at?: string
          custom_fields?: Json | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          name?: string | null
          phone: string
          read_at?: string | null
          responded_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          bulk_send_id?: string
          created_at?: string
          custom_fields?: Json | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          name?: string | null
          phone?: string
          read_at?: string | null
          responded_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contacts_bulk_send_id_fkey"
            columns: ["bulk_send_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bulk_sends"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_group_messages: {
        Row: {
          group_id: string
          id: string
          message: string
          sent_at: string
          status: string
        }
        Insert: {
          group_id: string
          id?: string
          message: string
          sent_at?: string
          status?: string
        }
        Update: {
          group_id?: string
          id?: string
          message?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_groups: {
        Row: {
          created_at: string
          group_id: string
          group_name: string
          id: string
          last_message_at: string | null
          member_count: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          group_name: string
          id?: string
          last_message_at?: string | null
          member_count?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          group_name?: string
          id?: string
          last_message_at?: string | null
          member_count?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_notifications: {
        Row: {
          client_phone: string
          created_at: string
          id: string
          message: string
          sent_at: string
          status: string
          user_id: string
        }
        Insert: {
          client_phone: string
          created_at?: string
          id?: string
          message: string
          sent_at?: string
          status?: string
          user_id: string
        }
        Update: {
          client_phone?: string
          created_at?: string
          id?: string
          message?: string
          sent_at?: string
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
      [_ in never]: never
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
