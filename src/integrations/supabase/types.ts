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
      biblioteca_campanhas: {
        Row: {
          campanha_id: string | null
          campanha_nome: string
          created_at: string | null
          data_campanha: string | null
          disponivel_remarketing: boolean | null
          enviado_google_ads: boolean | null
          frequencia: string | null
          google_ads_campaign_id: string | null
          id: string
          listas_ids: string[] | null
          mensagem_template: string | null
          produto_categoria: string | null
          produto_descricao: string | null
          produto_id: string | null
          produto_imagem_url: string | null
          produto_imagens: Json | null
          produto_link_marketplace: string | null
          produto_nome: string
          produto_preco: number | null
          status: string | null
          taxa_conversao: number | null
          taxa_resposta: number | null
          total_conversoes: number | null
          total_enviados: number | null
          total_respostas: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          campanha_id?: string | null
          campanha_nome: string
          created_at?: string | null
          data_campanha?: string | null
          disponivel_remarketing?: boolean | null
          enviado_google_ads?: boolean | null
          frequencia?: string | null
          google_ads_campaign_id?: string | null
          id?: string
          listas_ids?: string[] | null
          mensagem_template?: string | null
          produto_categoria?: string | null
          produto_descricao?: string | null
          produto_id?: string | null
          produto_imagem_url?: string | null
          produto_imagens?: Json | null
          produto_link_marketplace?: string | null
          produto_nome: string
          produto_preco?: number | null
          status?: string | null
          taxa_conversao?: number | null
          taxa_resposta?: number | null
          total_conversoes?: number | null
          total_enviados?: number | null
          total_respostas?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          campanha_id?: string | null
          campanha_nome?: string
          created_at?: string | null
          data_campanha?: string | null
          disponivel_remarketing?: boolean | null
          enviado_google_ads?: boolean | null
          frequencia?: string | null
          google_ads_campaign_id?: string | null
          id?: string
          listas_ids?: string[] | null
          mensagem_template?: string | null
          produto_categoria?: string | null
          produto_descricao?: string | null
          produto_id?: string | null
          produto_imagem_url?: string | null
          produto_imagens?: Json | null
          produto_link_marketplace?: string | null
          produto_nome?: string
          produto_preco?: number | null
          status?: string | null
          taxa_conversao?: number | null
          taxa_resposta?: number | null
          total_conversoes?: number | null
          total_enviados?: number | null
          total_respostas?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_campanhas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas_recorrentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biblioteca_campanhas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      call_queue: {
        Row: {
          attempts: number | null
          campanha_id: string
          created_at: string | null
          id: string
          last_attempt_at: string | null
          lead_id: string
          lead_type: string
          priority: number | null
          scheduled_for: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number | null
          campanha_id: string
          created_at?: string | null
          id?: string
          last_attempt_at?: string | null
          lead_id: string
          lead_type: string
          priority?: number | null
          scheduled_for?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number | null
          campanha_id?: string
          created_at?: string | null
          id?: string
          last_attempt_at?: string | null
          lead_id?: string
          lead_type?: string
          priority?: number | null
          scheduled_for?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_queue_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas_prospeccao"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_ai_configs: {
        Row: {
          ai_identity: string | null
          campaign_id: string | null
          company_name: string | null
          conversation_goal: string | null
          created_at: string | null
          custom_rules: string | null
          id: string
          product_or_service: string | null
          target_audience: string | null
          transfer_to_human_keywords: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_identity?: string | null
          campaign_id?: string | null
          company_name?: string | null
          conversation_goal?: string | null
          created_at?: string | null
          custom_rules?: string | null
          id?: string
          product_or_service?: string | null
          target_audience?: string | null
          transfer_to_human_keywords?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_identity?: string | null
          campaign_id?: string | null
          company_name?: string | null
          conversation_goal?: string | null
          created_at?: string | null
          custom_rules?: string | null
          id?: string
          product_or_service?: string | null
          target_audience?: string | null
          transfer_to_human_keywords?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_ai_configs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campanhas_prospeccao"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_execution_logs: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          error: string | null
          id: string
          log_type: string
          message: string | null
          metadata: Json | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          log_type: string
          message?: string | null
          metadata?: Json | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          log_type?: string
          message?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      campanha_execucoes: {
        Row: {
          campanha_id: string | null
          concluida_em: string | null
          erro_mensagem: string | null
          erros: number | null
          id: string
          iniciada_em: string | null
          log: Json | null
          processados: number | null
          status: string | null
          sucesso: number | null
          tipo: string
          total_items: number | null
        }
        Insert: {
          campanha_id?: string | null
          concluida_em?: string | null
          erro_mensagem?: string | null
          erros?: number | null
          id?: string
          iniciada_em?: string | null
          log?: Json | null
          processados?: number | null
          status?: string | null
          sucesso?: number | null
          tipo: string
          total_items?: number | null
        }
        Update: {
          campanha_id?: string | null
          concluida_em?: string | null
          erro_mensagem?: string | null
          erros?: number | null
          id?: string
          iniciada_em?: string | null
          log?: Json | null
          processados?: number | null
          status?: string | null
          sucesso?: number | null
          tipo?: string
          total_items?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campanha_execucoes_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas_prospeccao"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          id: string
          metricas: Json | null
          nome: string
          orcamento: number | null
          plataforma: string
          posts_ids: Json
          publico: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          metricas?: Json | null
          nome: string
          orcamento?: number | null
          plataforma: string
          posts_ids?: Json
          publico?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          metricas?: Json | null
          nome?: string
          orcamento?: number | null
          plataforma?: string
          posts_ids?: Json
          publico?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      campanhas_multiplas_fontes: {
        Row: {
          campanha_id: string | null
          created_at: string | null
          custo_total: number | null
          executada_em: string | null
          fonte: string
          id: string
          leads_descobertos: number | null
          leads_enriquecidos: number | null
          proxima_execucao: string | null
          query_utilizada: string | null
          status: string | null
        }
        Insert: {
          campanha_id?: string | null
          created_at?: string | null
          custo_total?: number | null
          executada_em?: string | null
          fonte: string
          id?: string
          leads_descobertos?: number | null
          leads_enriquecidos?: number | null
          proxima_execucao?: string | null
          query_utilizada?: string | null
          status?: string | null
        }
        Update: {
          campanha_id?: string | null
          created_at?: string | null
          custo_total?: number | null
          executada_em?: string | null
          fonte?: string
          id?: string
          leads_descobertos?: number | null
          leads_enriquecidos?: number | null
          proxima_execucao?: string | null
          query_utilizada?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_multiplas_fontes_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas_prospeccao"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas_prospeccao: {
        Row: {
          automatica: boolean | null
          concluida_em: string | null
          created_at: string | null
          descricao: string | null
          distribuicao: Json | null
          frequencia: string | null
          icp_config_id: string | null
          id: string
          iniciada_em: string | null
          meta_leads_por_dia: number | null
          meta_leads_qualificados: number | null
          meta_leads_total: number | null
          nome: string
          pipeline_config: Json | null
          proxima_execucao: string | null
          stats: Json | null
          status: string | null
          tipo: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          automatica?: boolean | null
          concluida_em?: string | null
          created_at?: string | null
          descricao?: string | null
          distribuicao?: Json | null
          frequencia?: string | null
          icp_config_id?: string | null
          id?: string
          iniciada_em?: string | null
          meta_leads_por_dia?: number | null
          meta_leads_qualificados?: number | null
          meta_leads_total?: number | null
          nome: string
          pipeline_config?: Json | null
          proxima_execucao?: string | null
          stats?: Json | null
          status?: string | null
          tipo: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          automatica?: boolean | null
          concluida_em?: string | null
          created_at?: string | null
          descricao?: string | null
          distribuicao?: Json | null
          frequencia?: string | null
          icp_config_id?: string | null
          id?: string
          iniciada_em?: string | null
          meta_leads_por_dia?: number | null
          meta_leads_qualificados?: number | null
          meta_leads_total?: number | null
          nome?: string
          pipeline_config?: Json | null
          proxima_execucao?: string | null
          stats?: Json | null
          status?: string | null
          tipo?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_prospeccao_icp_config_id_fkey"
            columns: ["icp_config_id"]
            isOneToOne: false
            referencedRelation: "icp_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas_recorrentes: {
        Row: {
          ativa: boolean | null
          created_at: string | null
          data_inicio: string
          dias_semana: number[] | null
          frequencia: string
          horarios: string[]
          id: string
          listas_ids: string[]
          mensagem_template: string
          nome: string
          produto_id: string
          proxima_execucao: string | null
          status: string | null
          total_enviados: number | null
          ultima_execucao: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativa?: boolean | null
          created_at?: string | null
          data_inicio: string
          dias_semana?: number[] | null
          frequencia: string
          horarios?: string[]
          id?: string
          listas_ids: string[]
          mensagem_template: string
          nome: string
          produto_id: string
          proxima_execucao?: string | null
          status?: string | null
          total_enviados?: number | null
          ultima_execucao?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ativa?: boolean | null
          created_at?: string | null
          data_inicio?: string
          dias_semana?: number[] | null
          frequencia?: string
          horarios?: string[]
          id?: string
          listas_ids?: string[]
          mensagem_template?: string
          nome?: string
          produto_id?: string
          proxima_execucao?: string | null
          status?: string | null
          total_enviados?: number | null
          ultima_execucao?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_recorrentes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          ativo: boolean | null
          contato: string | null
          cor_marca: string | null
          created_at: string
          descricao: string | null
          email: string | null
          facebook: string | null
          id: string
          instagram: string | null
          logo_url: string | null
          nome: string
          telefone: string | null
          tipo_negocio: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          contato?: string | null
          cor_marca?: string | null
          created_at?: string
          descricao?: string | null
          email?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          nome: string
          telefone?: string | null
          tipo_negocio?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          contato?: string | null
          cor_marca?: string | null
          created_at?: string
          descricao?: string | null
          email?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          nome?: string
          telefone?: string | null
          tipo_negocio?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deletion_requests: {
        Row: {
          completed_at: string | null
          email: string
          error_message: string | null
          id: string
          reason: string | null
          requested_at: string
          status: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          email: string
          error_message?: string | null
          id?: string
          reason?: string | null
          requested_at?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          email?: string
          error_message?: string | null
          id?: string
          reason?: string | null
          requested_at?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      empresa_config: {
        Row: {
          created_at: string | null
          id: string
          nome_empresa: string | null
          segmento: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome_empresa?: string | null
          segmento?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome_empresa?: string | null
          segmento?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      empresas: {
        Row: {
          atividade_principal: Json | null
          atividades_secundarias: Json | null
          capital_social: number | null
          cnpj: string
          created_at: string | null
          data_abertura: string | null
          email: string | null
          endereco: Json | null
          id: string
          natureza_juridica: string | null
          nome_fantasia: string | null
          porte: string | null
          razao_social: string
          situacao_cadastral: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          atividade_principal?: Json | null
          atividades_secundarias?: Json | null
          capital_social?: number | null
          cnpj: string
          created_at?: string | null
          data_abertura?: string | null
          email?: string | null
          endereco?: Json | null
          id?: string
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          porte?: string | null
          razao_social: string
          situacao_cadastral?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          atividade_principal?: Json | null
          atividades_secundarias?: Json | null
          capital_social?: number | null
          cnpj?: string
          created_at?: string | null
          data_abertura?: string | null
          email?: string | null
          endereco?: Json | null
          id?: string
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          porte?: string | null
          razao_social?: string
          situacao_cadastral?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      enrichment_queue: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          processed_at: string | null
          socio_id: string | null
          status: string | null
          tentativas: number | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          socio_id?: string | null
          status?: string | null
          tentativas?: number | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          socio_id?: string | null
          status?: string | null
          tentativas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_queue_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
        ]
      }
      fontes_dados: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          custo_por_lead: number | null
          id: string
          limite_diario: number | null
          nome: string
          requer_auth: boolean | null
          tipo: string
          url_base: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          custo_por_lead?: number | null
          id?: string
          limite_diario?: number | null
          nome: string
          requer_auth?: boolean | null
          tipo: string
          url_base?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          custo_por_lead?: number | null
          id?: string
          limite_diario?: number | null
          nome?: string
          requer_auth?: boolean | null
          tipo?: string
          url_base?: string | null
        }
        Relationships: []
      }
      icp_configs: {
        Row: {
          ativo: boolean | null
          b2b_config: Json | null
          b2c_config: Json | null
          created_at: string | null
          descricao: string | null
          filtros_avancados: Json | null
          fontes_habilitadas: Json | null
          id: string
          lead_count_b2b: number | null
          lead_count_b2c: number | null
          nome: string
          refinamento_comportamental: string | null
          refinamento_geografico: string | null
          score_minimo: number | null
          tipo: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          b2b_config?: Json | null
          b2c_config?: Json | null
          created_at?: string | null
          descricao?: string | null
          filtros_avancados?: Json | null
          fontes_habilitadas?: Json | null
          id?: string
          lead_count_b2b?: number | null
          lead_count_b2c?: number | null
          nome: string
          refinamento_comportamental?: string | null
          refinamento_geografico?: string | null
          score_minimo?: number | null
          tipo: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          b2b_config?: Json | null
          b2c_config?: Json | null
          created_at?: string | null
          descricao?: string | null
          filtros_avancados?: Json | null
          fontes_habilitadas?: Json | null
          id?: string
          lead_count_b2b?: number | null
          lead_count_b2c?: number | null
          nome?: string
          refinamento_comportamental?: string | null
          refinamento_geografico?: string | null
          score_minimo?: number | null
          tipo?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          access_token: string
          created_at: string | null
          id: string
          is_active: boolean | null
          lomadee_affiliate_id: string | null
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
          lomadee_affiliate_id?: string | null
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
          lomadee_affiliate_id?: string | null
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
      lead_history: {
        Row: {
          created_at: string | null
          dados_atualizados: Json | null
          id: string
          lead_id: string
          lead_tipo: string
          motivo: string | null
          status_anterior: string | null
          status_novo: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dados_atualizados?: Json | null
          id?: string
          lead_id: string
          lead_tipo: string
          motivo?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          dados_atualizados?: Json | null
          id?: string
          lead_id?: string
          lead_tipo?: string
          motivo?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lead_notifications: {
        Row: {
          created_at: string | null
          id: string
          mensagem_cliente: string | null
          phone: string
          produto_nome: string | null
          status: string | null
          user_id: string | null
          visualizado: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          mensagem_cliente?: string | null
          phone: string
          produto_nome?: string | null
          status?: string | null
          user_id?: string | null
          visualizado?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          mensagem_cliente?: string | null
          phone?: string
          produto_nome?: string | null
          status?: string | null
          user_id?: string | null
          visualizado?: boolean | null
        }
        Relationships: []
      }
      leads_b2b: {
        Row: {
          campanha_id: string
          capital_social: number | null
          cidade: string
          cnpj: string
          contato_cargo: string | null
          contato_email: string | null
          contato_linkedin: string | null
          contato_nome: string | null
          converteu_em: string | null
          created_at: string | null
          dados_enriquecidos: Json | null
          data_constituicao: string | null
          decisor_cargo: string | null
          decisor_nome: string | null
          email: string | null
          endereco: string | null
          enriched_at: string | null
          enrichment_data: Json | null
          enviado_em: string | null
          enviado_para: string | null
          estado: string
          facebook_url: string | null
          faturamento_estimado: number | null
          fonte: string
          fonte_snippet: string | null
          fonte_url: string | null
          icp_validado: boolean | null
          id: string
          insights: string[] | null
          instagram_username: string | null
          linkedin_url: string | null
          mensagem_selecionada: string | null
          mensagens_geradas: Json | null
          natureza_juridica: string | null
          nome_fantasia: string | null
          num_funcionarios: number | null
          pipeline_status: string
          porte: string | null
          qualificacao_motivo: string | null
          qualified_at: string | null
          query_usada: string | null
          razao_social: string
          recomendacao: string | null
          respondeu_em: string | null
          score: number | null
          score_breakdown: Json | null
          setor: string | null
          site_url: string | null
          situacao: string | null
          socios: Json | null
          telefone: string | null
          updated_at: string | null
          user_id: string
          validacao_icp: Json | null
          website: string | null
        }
        Insert: {
          campanha_id: string
          capital_social?: number | null
          cidade: string
          cnpj: string
          contato_cargo?: string | null
          contato_email?: string | null
          contato_linkedin?: string | null
          contato_nome?: string | null
          converteu_em?: string | null
          created_at?: string | null
          dados_enriquecidos?: Json | null
          data_constituicao?: string | null
          decisor_cargo?: string | null
          decisor_nome?: string | null
          email?: string | null
          endereco?: string | null
          enriched_at?: string | null
          enrichment_data?: Json | null
          enviado_em?: string | null
          enviado_para?: string | null
          estado: string
          facebook_url?: string | null
          faturamento_estimado?: number | null
          fonte: string
          fonte_snippet?: string | null
          fonte_url?: string | null
          icp_validado?: boolean | null
          id?: string
          insights?: string[] | null
          instagram_username?: string | null
          linkedin_url?: string | null
          mensagem_selecionada?: string | null
          mensagens_geradas?: Json | null
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          num_funcionarios?: number | null
          pipeline_status?: string
          porte?: string | null
          qualificacao_motivo?: string | null
          qualified_at?: string | null
          query_usada?: string | null
          razao_social: string
          recomendacao?: string | null
          respondeu_em?: string | null
          score?: number | null
          score_breakdown?: Json | null
          setor?: string | null
          site_url?: string | null
          situacao?: string | null
          socios?: Json | null
          telefone?: string | null
          updated_at?: string | null
          user_id: string
          validacao_icp?: Json | null
          website?: string | null
        }
        Update: {
          campanha_id?: string
          capital_social?: number | null
          cidade?: string
          cnpj?: string
          contato_cargo?: string | null
          contato_email?: string | null
          contato_linkedin?: string | null
          contato_nome?: string | null
          converteu_em?: string | null
          created_at?: string | null
          dados_enriquecidos?: Json | null
          data_constituicao?: string | null
          decisor_cargo?: string | null
          decisor_nome?: string | null
          email?: string | null
          endereco?: string | null
          enriched_at?: string | null
          enrichment_data?: Json | null
          enviado_em?: string | null
          enviado_para?: string | null
          estado?: string
          facebook_url?: string | null
          faturamento_estimado?: number | null
          fonte?: string
          fonte_snippet?: string | null
          fonte_url?: string | null
          icp_validado?: boolean | null
          id?: string
          insights?: string[] | null
          instagram_username?: string | null
          linkedin_url?: string | null
          mensagem_selecionada?: string | null
          mensagens_geradas?: Json | null
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          num_funcionarios?: number | null
          pipeline_status?: string
          porte?: string | null
          qualificacao_motivo?: string | null
          qualified_at?: string | null
          query_usada?: string | null
          razao_social?: string
          recomendacao?: string | null
          respondeu_em?: string | null
          score?: number | null
          score_breakdown?: Json | null
          setor?: string | null
          site_url?: string | null
          situacao?: string | null
          socios?: Json | null
          telefone?: string | null
          updated_at?: string | null
          user_id?: string
          validacao_icp?: Json | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_b2b_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas_prospeccao"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_b2c: {
        Row: {
          anos_formado: number | null
          bairro: string | null
          campanha_id: string
          cidade: string
          converteu_em: string | null
          crea: string | null
          created_at: string | null
          crm: string | null
          dados_enriquecidos: Json | null
          email: string | null
          endereco: string | null
          enriched_at: string | null
          enrichment_data: Json | null
          enviado_em: string | null
          enviado_para: string | null
          especialidade: string | null
          estado: string
          facebook_id: string | null
          facebook_url: string | null
          fonte: string
          fonte_snippet: string | null
          fonte_url: string | null
          id: string
          insights: string[] | null
          instagram_seguidores: number | null
          instagram_username: string | null
          linkedin_id: string | null
          linkedin_url: string | null
          mensagem_selecionada: string | null
          mensagens_geradas: Json | null
          nome_completo: string
          oab: string | null
          pipeline_status: string
          profissao: string
          qualificacao_motivo: string | null
          qualified_at: string | null
          query_usada: string | null
          recomendacao: string | null
          respondeu_em: string | null
          score: number | null
          score_breakdown: Json | null
          sinais_poder_aquisitivo: string[] | null
          site_url: string | null
          telefone: string | null
          tem_consultorio: boolean | null
          tipo_validado: boolean | null
          updated_at: string | null
          user_id: string
          validacao_resultado: Json | null
          whatsapp: string | null
          whatsapp_status: string | null
        }
        Insert: {
          anos_formado?: number | null
          bairro?: string | null
          campanha_id: string
          cidade: string
          converteu_em?: string | null
          crea?: string | null
          created_at?: string | null
          crm?: string | null
          dados_enriquecidos?: Json | null
          email?: string | null
          endereco?: string | null
          enriched_at?: string | null
          enrichment_data?: Json | null
          enviado_em?: string | null
          enviado_para?: string | null
          especialidade?: string | null
          estado: string
          facebook_id?: string | null
          facebook_url?: string | null
          fonte: string
          fonte_snippet?: string | null
          fonte_url?: string | null
          id?: string
          insights?: string[] | null
          instagram_seguidores?: number | null
          instagram_username?: string | null
          linkedin_id?: string | null
          linkedin_url?: string | null
          mensagem_selecionada?: string | null
          mensagens_geradas?: Json | null
          nome_completo: string
          oab?: string | null
          pipeline_status?: string
          profissao: string
          qualificacao_motivo?: string | null
          qualified_at?: string | null
          query_usada?: string | null
          recomendacao?: string | null
          respondeu_em?: string | null
          score?: number | null
          score_breakdown?: Json | null
          sinais_poder_aquisitivo?: string[] | null
          site_url?: string | null
          telefone?: string | null
          tem_consultorio?: boolean | null
          tipo_validado?: boolean | null
          updated_at?: string | null
          user_id: string
          validacao_resultado?: Json | null
          whatsapp?: string | null
          whatsapp_status?: string | null
        }
        Update: {
          anos_formado?: number | null
          bairro?: string | null
          campanha_id?: string
          cidade?: string
          converteu_em?: string | null
          crea?: string | null
          created_at?: string | null
          crm?: string | null
          dados_enriquecidos?: Json | null
          email?: string | null
          endereco?: string | null
          enriched_at?: string | null
          enrichment_data?: Json | null
          enviado_em?: string | null
          enviado_para?: string | null
          especialidade?: string | null
          estado?: string
          facebook_id?: string | null
          facebook_url?: string | null
          fonte?: string
          fonte_snippet?: string | null
          fonte_url?: string | null
          id?: string
          insights?: string[] | null
          instagram_seguidores?: number | null
          instagram_username?: string | null
          linkedin_id?: string | null
          linkedin_url?: string | null
          mensagem_selecionada?: string | null
          mensagens_geradas?: Json | null
          nome_completo?: string
          oab?: string | null
          pipeline_status?: string
          profissao?: string
          qualificacao_motivo?: string | null
          qualified_at?: string | null
          query_usada?: string | null
          recomendacao?: string | null
          respondeu_em?: string | null
          score?: number | null
          score_breakdown?: Json | null
          sinais_poder_aquisitivo?: string[] | null
          site_url?: string | null
          telefone?: string | null
          tem_consultorio?: boolean | null
          tipo_validado?: boolean | null
          updated_at?: string | null
          user_id?: string
          validacao_resultado?: Json | null
          whatsapp?: string | null
          whatsapp_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_b2c_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas_prospeccao"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_descobertos: {
        Row: {
          campanha_id: string | null
          cidade: string | null
          cnpj: string | null
          converteu_em: string | null
          created_at: string | null
          email: string | null
          enriched_at: string | null
          enrichment_data: Json | null
          enviado_em: string | null
          enviado_para: string | null
          especialidade: string | null
          estado: string | null
          facebook_url: string | null
          fonte: string | null
          fonte_snippet: string | null
          fonte_url: string | null
          id: string
          insights: string[] | null
          instagram_username: string | null
          justificativa: string | null
          linkedin_url: string | null
          mensagem_selecionada: string | null
          mensagens_geradas: Json | null
          messages_generated_at: string | null
          nome_fantasia: string | null
          nome_profissional: string | null
          profissao: string | null
          qualified_at: string | null
          query_usada: string | null
          razao_social: string | null
          recomendacao: string | null
          respondeu_em: string | null
          score: number | null
          score_breakdown: Json | null
          status: string | null
          telefone: string | null
          tipo: string
          user_id: string
          whatsapp_status: string | null
        }
        Insert: {
          campanha_id?: string | null
          cidade?: string | null
          cnpj?: string | null
          converteu_em?: string | null
          created_at?: string | null
          email?: string | null
          enriched_at?: string | null
          enrichment_data?: Json | null
          enviado_em?: string | null
          enviado_para?: string | null
          especialidade?: string | null
          estado?: string | null
          facebook_url?: string | null
          fonte?: string | null
          fonte_snippet?: string | null
          fonte_url?: string | null
          id?: string
          insights?: string[] | null
          instagram_username?: string | null
          justificativa?: string | null
          linkedin_url?: string | null
          mensagem_selecionada?: string | null
          mensagens_geradas?: Json | null
          messages_generated_at?: string | null
          nome_fantasia?: string | null
          nome_profissional?: string | null
          profissao?: string | null
          qualified_at?: string | null
          query_usada?: string | null
          razao_social?: string | null
          recomendacao?: string | null
          respondeu_em?: string | null
          score?: number | null
          score_breakdown?: Json | null
          status?: string | null
          telefone?: string | null
          tipo: string
          user_id: string
          whatsapp_status?: string | null
        }
        Update: {
          campanha_id?: string | null
          cidade?: string | null
          cnpj?: string | null
          converteu_em?: string | null
          created_at?: string | null
          email?: string | null
          enriched_at?: string | null
          enrichment_data?: Json | null
          enviado_em?: string | null
          enviado_para?: string | null
          especialidade?: string | null
          estado?: string | null
          facebook_url?: string | null
          fonte?: string | null
          fonte_snippet?: string | null
          fonte_url?: string | null
          id?: string
          insights?: string[] | null
          instagram_username?: string | null
          justificativa?: string | null
          linkedin_url?: string | null
          mensagem_selecionada?: string | null
          mensagens_geradas?: Json | null
          messages_generated_at?: string | null
          nome_fantasia?: string | null
          nome_profissional?: string | null
          profissao?: string | null
          qualified_at?: string | null
          query_usada?: string | null
          razao_social?: string | null
          recomendacao?: string | null
          respondeu_em?: string | null
          score?: number | null
          score_breakdown?: Json | null
          status?: string | null
          telefone?: string | null
          tipo?: string
          user_id?: string
          whatsapp_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_descobertos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas_prospeccao"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_analise_ia: {
        Row: {
          confianca: number | null
          created_at: string | null
          dados_extraidos: Json | null
          erro: string | null
          id: string
          tempo_processamento: number | null
          tipo: string
          whatsapp_cliente: string | null
        }
        Insert: {
          confianca?: number | null
          created_at?: string | null
          dados_extraidos?: Json | null
          erro?: string | null
          id?: string
          tempo_processamento?: number | null
          tipo: string
          whatsapp_cliente?: string | null
        }
        Update: {
          confianca?: number | null
          created_at?: string | null
          dados_extraidos?: Json | null
          erro?: string | null
          id?: string
          tempo_processamento?: number | null
          tipo?: string
          whatsapp_cliente?: string | null
        }
        Relationships: []
      }
      meetings: {
        Row: {
          campanha_id: string
          confirmation_sent: boolean | null
          created_at: string | null
          duration: number | null
          google_event_id: string | null
          google_meet_link: string | null
          id: string
          lead_id: string
          lead_type: string
          meeting_datetime: string
          notes: string | null
          reminder_sent: boolean | null
          scheduled_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          campanha_id: string
          confirmation_sent?: boolean | null
          created_at?: string | null
          duration?: number | null
          google_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          lead_id: string
          lead_type: string
          meeting_datetime: string
          notes?: string | null
          reminder_sent?: boolean | null
          scheduled_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          campanha_id?: string
          confirmation_sent?: boolean | null
          created_at?: string | null
          duration?: number | null
          google_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          lead_id?: string
          lead_type?: string
          meeting_datetime?: string
          notes?: string | null
          reminder_sent?: boolean | null
          scheduled_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas_prospeccao"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          created_at: string | null
          descricao: string | null
          fase: string
          id: string
          nome: string
          ordem: number
          requer_enriquecimento: boolean | null
          requer_score: boolean | null
          score_minimo: number | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          fase: string
          id?: string
          nome: string
          ordem: number
          requer_enriquecimento?: boolean | null
          requer_score?: boolean | null
          score_minimo?: number | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          fase?: string
          id?: string
          nome?: string
          ordem?: number
          requer_enriquecimento?: boolean | null
          requer_score?: boolean | null
          score_minimo?: number | null
        }
        Relationships: []
      }
      posts: {
        Row: {
          created_at: string
          id: string
          imagem_url: string | null
          link_afiliado: string | null
          link_produto: string | null
          status: string
          texto_facebook: string | null
          texto_instagram: string | null
          texto_story: string | null
          texto_whatsapp: string | null
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          imagem_url?: string | null
          link_afiliado?: string | null
          link_produto?: string | null
          status?: string
          texto_facebook?: string | null
          texto_instagram?: string | null
          texto_story?: string | null
          texto_whatsapp?: string | null
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          imagem_url?: string | null
          link_afiliado?: string | null
          link_produto?: string | null
          status?: string
          texto_facebook?: string | null
          texto_instagram?: string | null
          texto_story?: string | null
          texto_whatsapp?: string | null
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products_stock: {
        Row: {
          active: boolean | null
          category: string
          cost: number | null
          created_at: string | null
          description_long: string | null
          description_short: string | null
          id: string
          img_url: string | null
          name: string
          objection_handler: Json | null
          price: number
          qty: number | null
          sku: string
          specs: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          category: string
          cost?: number | null
          created_at?: string | null
          description_long?: string | null
          description_short?: string | null
          id?: string
          img_url?: string | null
          name: string
          objection_handler?: Json | null
          price: number
          qty?: number | null
          sku: string
          specs?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          category?: string
          cost?: number | null
          created_at?: string | null
          description_long?: string | null
          description_short?: string | null
          id?: string
          img_url?: string | null
          name?: string
          objection_handler?: Json | null
          price?: number
          qty?: number | null
          sku?: string
          specs?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          ativo: boolean | null
          categoria: string
          cliente_id: string | null
          created_at: string
          descricao: string | null
          especificacoes: string | null
          estoque: number | null
          id: string
          imagem_url: string | null
          imagens: Json | null
          link: string | null
          link_marketplace: string | null
          nome: string
          preco: number | null
          publicar_marketplace: boolean | null
          sku: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          categoria: string
          cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          especificacoes?: string | null
          estoque?: number | null
          id?: string
          imagem_url?: string | null
          imagens?: Json | null
          link?: string | null
          link_marketplace?: string | null
          nome: string
          preco?: number | null
          publicar_marketplace?: boolean | null
          sku?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          categoria?: string
          cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          especificacoes?: string | null
          estoque?: number | null
          id?: string
          imagem_url?: string | null
          imagens?: Json | null
          link?: string | null
          link_marketplace?: string | null
          nome?: string
          preco?: number | null
          publicar_marketplace?: boolean | null
          sku?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos_marketplace: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          cliques_afiliado: number | null
          cliques_whatsapp: number | null
          created_at: string | null
          descricao: string | null
          ebook_bonus: string | null
          id: string
          imagens: Json | null
          link_afiliado: string
          plataforma: string | null
          preco: number
          preco_original: number | null
          slug: string | null
          titulo: string
          updated_at: string | null
          user_id: string | null
          visualizacoes: number | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          cliques_afiliado?: number | null
          cliques_whatsapp?: number | null
          created_at?: string | null
          descricao?: string | null
          ebook_bonus?: string | null
          id?: string
          imagens?: Json | null
          link_afiliado: string
          plataforma?: string | null
          preco: number
          preco_original?: number | null
          slug?: string | null
          titulo: string
          updated_at?: string | null
          user_id?: string | null
          visualizacoes?: number | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          cliques_afiliado?: number | null
          cliques_whatsapp?: number | null
          created_at?: string | null
          descricao?: string | null
          ebook_bonus?: string | null
          id?: string
          imagens?: Json | null
          link_afiliado?: string
          plataforma?: string | null
          preco?: number
          preco_original?: number | null
          slug?: string | null
          titulo?: string
          updated_at?: string | null
          user_id?: string | null
          visualizacoes?: number | null
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
      prospects_qualificados: {
        Row: {
          created_at: string | null
          enviado_em: string | null
          enviado_whatsapp: boolean | null
          id: string
          insights: Json | null
          justificativa: string | null
          mensagem_selecionada: string | null
          mensagens_geradas: Json | null
          score: number
          socio_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          enviado_em?: string | null
          enviado_whatsapp?: boolean | null
          id?: string
          insights?: Json | null
          justificativa?: string | null
          mensagem_selecionada?: string | null
          mensagens_geradas?: Json | null
          score?: number
          socio_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          enviado_em?: string | null
          enviado_whatsapp?: boolean | null
          id?: string
          insights?: Json | null
          justificativa?: string | null
          mensagem_selecionada?: string | null
          mensagens_geradas?: Json | null
          score?: number
          socio_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_qualificados_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
        ]
      }
      qualification_queue: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          processed_at: string | null
          socio_id: string | null
          status: string | null
          tentativas: number | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          socio_id?: string | null
          status?: string | null
          tentativas?: number | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          socio_id?: string | null
          status?: string | null
          tentativas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qualification_queue_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_posts: {
        Row: {
          created_at: string
          data: string
          hora: string
          id: string
          post_id: string
          redes: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: string
          hora: string
          id?: string
          post_id: string
          redes?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          hora?: string
          id?: string
          post_id?: string
          redes?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      security_reports: {
        Row: {
          created_at: string | null
          description: string
          disclosed_publicly: boolean | null
          id: string
          notes: string | null
          reporter_email: string
          reporter_name: string | null
          resolved_at: string | null
          severity: string
          status: string | null
          steps_to_reproduce: string | null
          vulnerability_type: string
        }
        Insert: {
          created_at?: string | null
          description: string
          disclosed_publicly?: boolean | null
          id?: string
          notes?: string | null
          reporter_email: string
          reporter_name?: string | null
          resolved_at?: string | null
          severity: string
          status?: string | null
          steps_to_reproduce?: string | null
          vulnerability_type: string
        }
        Update: {
          created_at?: string | null
          description?: string
          disclosed_publicly?: boolean | null
          id?: string
          notes?: string | null
          reporter_email?: string
          reporter_name?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string | null
          steps_to_reproduce?: string | null
          vulnerability_type?: string
        }
        Relationships: []
      }
      socios: {
        Row: {
          cpf: string | null
          created_at: string | null
          data_entrada: string | null
          empresa_id: string
          enrichment_data: Json | null
          id: string
          nome: string
          patrimonio_estimado: number | null
          percentual_capital: number | null
          qualificacao: string | null
          updated_at: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string | null
          data_entrada?: string | null
          empresa_id: string
          enrichment_data?: Json | null
          id?: string
          nome: string
          patrimonio_estimado?: number | null
          percentual_capital?: number | null
          qualificacao?: string | null
          updated_at?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string | null
          data_entrada?: string | null
          empresa_id?: string
          enrichment_data?: Json | null
          id?: string
          nome?: string
          patrimonio_estimado?: number | null
          percentual_capital?: number | null
          qualificacao?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "socios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
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
      user_market_config: {
        Row: {
          base_prompt: string | null
          created_at: string | null
          descricao: string | null
          faixa_preco_max: number | null
          faixa_preco_min: number | null
          formas_pagamento: string[] | null
          ia_active: boolean | null
          id: string
          mercado: string
          nichos: string[] | null
          prazo_entrega_dias: number | null
          regioes: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          base_prompt?: string | null
          created_at?: string | null
          descricao?: string | null
          faixa_preco_max?: number | null
          faixa_preco_min?: number | null
          formas_pagamento?: string[] | null
          ia_active?: boolean | null
          id?: string
          mercado: string
          nichos?: string[] | null
          prazo_entrega_dias?: number | null
          regioes?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          base_prompt?: string | null
          created_at?: string | null
          descricao?: string | null
          faixa_preco_max?: number | null
          faixa_preco_min?: number | null
          formas_pagamento?: string[] | null
          ia_active?: boolean | null
          id?: string
          mercado?: string
          nichos?: string[] | null
          prazo_entrega_dias?: number | null
          regioes?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_onboarding: {
        Row: {
          completed_at: string | null
          created_at: string | null
          onboarding_completed: boolean | null
          user_id: string
          whatsapp_connected: boolean | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          onboarding_completed?: boolean | null
          user_id: string
          whatsapp_connected?: boolean | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          onboarding_completed?: boolean | null
          user_id?: string
          whatsapp_connected?: boolean | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      validacoes_pedidos: {
        Row: {
          confianca_ia: number | null
          created_at: string | null
          dados_ia: Json | null
          data_compra: string | null
          ebook_enviado: boolean | null
          id: string
          imagem_url: string | null
          instance_name: string | null
          message_id: string | null
          nome_cliente: string | null
          numero_pedido: string
          produto_nome: string | null
          status: string
          updated_at: string | null
          validated_at: string | null
          validated_by: string | null
          valor_compra: number | null
          whatsapp_cliente: string
        }
        Insert: {
          confianca_ia?: number | null
          created_at?: string | null
          dados_ia?: Json | null
          data_compra?: string | null
          ebook_enviado?: boolean | null
          id?: string
          imagem_url?: string | null
          instance_name?: string | null
          message_id?: string | null
          nome_cliente?: string | null
          numero_pedido: string
          produto_nome?: string | null
          status?: string
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          valor_compra?: number | null
          whatsapp_cliente: string
        }
        Update: {
          confianca_ia?: number | null
          created_at?: string | null
          dados_ia?: Json | null
          data_compra?: string | null
          ebook_enviado?: boolean | null
          id?: string
          imagem_url?: string | null
          instance_name?: string | null
          message_id?: string | null
          nome_cliente?: string | null
          numero_pedido?: string
          produto_nome?: string | null
          status?: string
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          valor_compra?: number | null
          whatsapp_cliente?: string
        }
        Relationships: []
      }
      voice_calls: {
        Row: {
          ai_analysis: Json | null
          call_sid: string | null
          campanha_id: string
          completed_at: string | null
          created_at: string | null
          duration: number | null
          id: string
          lead_id: string
          lead_qualified: boolean | null
          lead_type: string
          meeting_datetime: string | null
          meeting_google_event_id: string | null
          meeting_scheduled: boolean | null
          next_action: string | null
          objections: string[] | null
          recording_url: string | null
          sentiment_score: number | null
          started_at: string | null
          status: string
          transcription: string | null
          user_id: string
        }
        Insert: {
          ai_analysis?: Json | null
          call_sid?: string | null
          campanha_id: string
          completed_at?: string | null
          created_at?: string | null
          duration?: number | null
          id?: string
          lead_id: string
          lead_qualified?: boolean | null
          lead_type: string
          meeting_datetime?: string | null
          meeting_google_event_id?: string | null
          meeting_scheduled?: boolean | null
          next_action?: string | null
          objections?: string[] | null
          recording_url?: string | null
          sentiment_score?: number | null
          started_at?: string | null
          status?: string
          transcription?: string | null
          user_id: string
        }
        Update: {
          ai_analysis?: Json | null
          call_sid?: string | null
          campanha_id?: string
          completed_at?: string | null
          created_at?: string | null
          duration?: number | null
          id?: string
          lead_id?: string
          lead_qualified?: boolean | null
          lead_type?: string
          meeting_datetime?: string | null
          meeting_google_event_id?: string | null
          meeting_scheduled?: boolean | null
          next_action?: string | null
          objections?: string[] | null
          recording_url?: string | null
          sentiment_score?: number | null
          started_at?: string | null
          status?: string
          transcription?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_calls_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas_prospeccao"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_scripts: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          name: string
          script_agendamento: string
          script_intro: string
          script_objecoes: Json | null
          script_qualificacao: string
          tipo_icp: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name: string
          script_agendamento: string
          script_intro: string
          script_objecoes?: Json | null
          script_qualificacao: string
          tipo_icp: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name?: string
          script_agendamento?: string
          script_intro?: string
          script_objecoes?: Json | null
          script_qualificacao?: string
          tipo_icp?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webhook_debug_logs: {
        Row: {
          extracted_message: string | null
          extracted_phone: string | null
          id: string
          payload: Json | null
          processing_result: string | null
          timestamp: string | null
        }
        Insert: {
          extracted_message?: string | null
          extracted_phone?: string | null
          id?: string
          payload?: Json | null
          processing_result?: string | null
          timestamp?: string | null
        }
        Update: {
          extracted_message?: string | null
          extracted_phone?: string | null
          id?: string
          payload?: Json | null
          processing_result?: string | null
          timestamp?: string | null
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
          aceita_lancamentos: boolean | null
          aceita_marketing: boolean | null
          aceita_promocoes: boolean | null
          created_at: string | null
          email: string | null
          id: string
          last_interaction: string | null
          nome: string | null
          notes: string | null
          origem: string | null
          phone: string
          tags: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          aceita_lancamentos?: boolean | null
          aceita_marketing?: boolean | null
          aceita_promocoes?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_interaction?: string | null
          nome?: string | null
          notes?: string | null
          origem?: string | null
          phone: string
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          aceita_lancamentos?: boolean | null
          aceita_marketing?: boolean | null
          aceita_promocoes?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_interaction?: string | null
          nome?: string | null
          notes?: string | null
          origem?: string | null
          phone?: string
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_conversation_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          wuzapi_message_id: string | null
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          wuzapi_message_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          wuzapi_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          assumido_em: string | null
          assumido_por: string | null
          campaign_id: string | null
          contact_name: string | null
          created_at: string | null
          id: string
          last_message_at: string | null
          lead_id: string | null
          metadata: Json | null
          modo_atendimento: string | null
          origem: string | null
          phone_number: string
          status: string | null
          tipo_contato: string | null
          transferred_at: string | null
          transferred_to_human: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          assumido_em?: string | null
          assumido_por?: string | null
          campaign_id?: string | null
          contact_name?: string | null
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          lead_id?: string | null
          metadata?: Json | null
          modo_atendimento?: string | null
          origem?: string | null
          phone_number: string
          status?: string | null
          tipo_contato?: string | null
          transferred_at?: string | null
          transferred_to_human?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          assumido_em?: string | null
          assumido_por?: string | null
          campaign_id?: string | null
          contact_name?: string | null
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          lead_id?: string | null
          metadata?: Json | null
          modo_atendimento?: string | null
          origem?: string | null
          phone_number?: string
          status?: string | null
          tipo_contato?: string | null
          transferred_at?: string | null
          transferred_to_human?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campanhas_prospeccao"
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
          phone_numbers: string[] | null
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
          phone_numbers?: string[] | null
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
          phone_numbers?: string[] | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          direction: string
          id: string
          message: string | null
          origem: string | null
          phone: string
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          direction: string
          id?: string
          message?: string | null
          origem?: string | null
          phone: string
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          direction?: string
          id?: string
          message?: string | null
          origem?: string | null
          phone?: string
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      whatsapp_messages_received: {
        Row: {
          created_at: string | null
          id: string
          message: string
          message_id: string | null
          phone_number: string
          raw_data: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          message_id?: string | null
          phone_number: string
          raw_data?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          message_id?: string | null
          phone_number?: string
          raw_data?: Json | null
        }
        Relationships: []
      }
      whatsapp_messages_sent: {
        Row: {
          created_at: string | null
          id: string
          in_response_to: string | null
          message: string
          phone_number: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          in_response_to?: string | null
          message: string
          phone_number: string
        }
        Update: {
          created_at?: string | null
          id?: string
          in_response_to?: string | null
          message?: string
          phone_number?: string
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
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      process_scheduled_campaigns: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "empresa" | "afiliado"
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
      app_role: ["admin", "empresa", "afiliado"],
    },
  },
} as const
