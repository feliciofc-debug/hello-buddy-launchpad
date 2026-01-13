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
      afiliado_analytics_ebooks: {
        Row: {
          categoria: string | null
          cliente_phone: string | null
          confianca: number | null
          ebook_id: string | null
          evento: string
          id: string
          loja: string | null
          metadata: Json | null
          motivo: string | null
          produto: string | null
          timestamp: string | null
          user_id: string | null
          valor: number | null
        }
        Insert: {
          categoria?: string | null
          cliente_phone?: string | null
          confianca?: number | null
          ebook_id?: string | null
          evento: string
          id?: string
          loja?: string | null
          metadata?: Json | null
          motivo?: string | null
          produto?: string | null
          timestamp?: string | null
          user_id?: string | null
          valor?: number | null
        }
        Update: {
          categoria?: string | null
          cliente_phone?: string | null
          confianca?: number | null
          ebook_id?: string | null
          evento?: string
          id?: string
          loja?: string | null
          metadata?: Json | null
          motivo?: string | null
          produto?: string | null
          timestamp?: string | null
          user_id?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      afiliado_blacklist_ebooks: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          motivo: string
          phone: string
          tentativas_fraude: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          motivo: string
          phone: string
          tentativas_fraude?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          motivo?: string
          phone?: string
          tentativas_fraude?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      afiliado_campanhas: {
        Row: {
          ativa: boolean | null
          created_at: string | null
          data_inicio: string
          dias_semana: number[] | null
          frequencia: string
          horarios: string[]
          id: string
          listas_ids: string[] | null
          mensagem_template: string
          nome: string
          produto_id: string | null
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
          frequencia?: string
          horarios?: string[]
          id?: string
          listas_ids?: string[] | null
          mensagem_template: string
          nome: string
          produto_id?: string | null
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
          listas_ids?: string[] | null
          mensagem_template?: string
          nome?: string
          produto_id?: string | null
          proxima_execucao?: string | null
          status?: string | null
          total_enviados?: number | null
          ultima_execucao?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "afiliado_campanhas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "afiliado_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      afiliado_cashback: {
        Row: {
          compras_total: number | null
          created_at: string | null
          id: string
          phone: string
          saldo_atual: number | null
          total_acumulado: number | null
          total_resgatado: number | null
          ultimo_resgate_at: string | null
          updated_at: string | null
          valor_compras_total: number | null
        }
        Insert: {
          compras_total?: number | null
          created_at?: string | null
          id?: string
          phone: string
          saldo_atual?: number | null
          total_acumulado?: number | null
          total_resgatado?: number | null
          ultimo_resgate_at?: string | null
          updated_at?: string | null
          valor_compras_total?: number | null
        }
        Update: {
          compras_total?: number | null
          created_at?: string | null
          id?: string
          phone?: string
          saldo_atual?: number | null
          total_acumulado?: number | null
          total_resgatado?: number | null
          ultimo_resgate_at?: string | null
          updated_at?: string | null
          valor_compras_total?: number | null
        }
        Relationships: []
      }
      afiliado_cashback_historico: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          metadata: Json | null
          phone: string
          saldo_anterior: number | null
          saldo_novo: number | null
          tipo: string
          valor: number
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          metadata?: Json | null
          phone: string
          saldo_anterior?: number | null
          saldo_novo?: number | null
          tipo: string
          valor: number
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          metadata?: Json | null
          phone?: string
          saldo_anterior?: number | null
          saldo_novo?: number | null
          tipo?: string
          valor?: number
        }
        Relationships: []
      }
      afiliado_cliente_preferencias: {
        Row: {
          categorias_ativas: Json | null
          categorias_bloqueadas: Json | null
          created_at: string | null
          freq_ofertas: string | null
          id: string
          phone: string
          ultima_oferta_enviada_at: string | null
          updated_at: string | null
        }
        Insert: {
          categorias_ativas?: Json | null
          categorias_bloqueadas?: Json | null
          created_at?: string | null
          freq_ofertas?: string | null
          id?: string
          phone: string
          ultima_oferta_enviada_at?: string | null
          updated_at?: string | null
        }
        Update: {
          categorias_ativas?: Json | null
          categorias_bloqueadas?: Json | null
          created_at?: string | null
          freq_ofertas?: string | null
          id?: string
          phone?: string
          ultima_oferta_enviada_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      afiliado_clientes_ebooks: {
        Row: {
          categorias_preferidas: Json | null
          created_at: string | null
          id: string
          nome: string | null
          phone: string
          primeira_compra_at: string | null
          total_compras: number | null
          total_ebooks: number | null
          ultima_compra_at: string | null
          updated_at: string | null
          user_id: string | null
          valor_total_compras: number | null
          vip: boolean | null
        }
        Insert: {
          categorias_preferidas?: Json | null
          created_at?: string | null
          id?: string
          nome?: string | null
          phone: string
          primeira_compra_at?: string | null
          total_compras?: number | null
          total_ebooks?: number | null
          ultima_compra_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          valor_total_compras?: number | null
          vip?: boolean | null
        }
        Update: {
          categorias_preferidas?: Json | null
          created_at?: string | null
          id?: string
          nome?: string | null
          phone?: string
          primeira_compra_at?: string | null
          total_compras?: number | null
          total_ebooks?: number | null
          ultima_compra_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          valor_total_compras?: number | null
          vip?: boolean | null
        }
        Relationships: []
      }
      afiliado_conversas: {
        Row: {
          content: string
          created_at: string
          id: string
          phone: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          phone: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          phone?: string
          role?: string
        }
        Relationships: []
      }
      afiliado_disparos: {
        Row: {
          created_at: string | null
          data_agendada: string
          data_envio: string | null
          destinatarios: string[] | null
          id: string
          mensagem: string | null
          produto_id: string | null
          status: string | null
          tipo_envio: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data_agendada: string
          data_envio?: string | null
          destinatarios?: string[] | null
          id?: string
          mensagem?: string | null
          produto_id?: string | null
          status?: string | null
          tipo_envio?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data_agendada?: string
          data_envio?: string | null
          destinatarios?: string[] | null
          id?: string
          mensagem?: string | null
          produto_id?: string | null
          status?: string | null
          tipo_envio?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "afiliado_disparos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "afiliado_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      afiliado_ebook_deliveries: {
        Row: {
          categoria: string | null
          comprovante_url: string | null
          created_at: string | null
          ebook_filename: string
          ebook_id: string | null
          ebook_titulo: string
          id: string
          loja: string | null
          phone: string
          produto: string | null
          user_id: string | null
          valor_compra: number | null
        }
        Insert: {
          categoria?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          ebook_filename: string
          ebook_id?: string | null
          ebook_titulo: string
          id?: string
          loja?: string | null
          phone: string
          produto?: string | null
          user_id?: string | null
          valor_compra?: number | null
        }
        Update: {
          categoria?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          ebook_filename?: string
          ebook_id?: string | null
          ebook_titulo?: string
          id?: string
          loja?: string | null
          phone?: string
          produto?: string | null
          user_id?: string | null
          valor_compra?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "afiliado_ebook_deliveries_ebook_id_fkey"
            columns: ["ebook_id"]
            isOneToOne: false
            referencedRelation: "afiliado_ebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      afiliado_ebooks: {
        Row: {
          arquivo_url: string
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          id: string
          titulo: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          arquivo_url: string
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          titulo: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          arquivo_url?: string
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          titulo?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      afiliado_lista_membros: {
        Row: {
          adicionado_em: string | null
          id: string
          lead_id: string
          lista_id: string
        }
        Insert: {
          adicionado_em?: string | null
          id?: string
          lead_id: string
          lista_id: string
        }
        Update: {
          adicionado_em?: string | null
          id?: string
          lead_id?: string
          lista_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "afiliado_lista_membros_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_ebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afiliado_lista_membros_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "afiliado_listas_categoria"
            referencedColumns: ["id"]
          },
        ]
      }
      afiliado_listas_categoria: {
        Row: {
          ativa: boolean | null
          cor: string | null
          created_at: string | null
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          total_membros: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ativa?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          total_membros?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ativa?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          total_membros?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      afiliado_ofertas: {
        Row: {
          ativa: boolean | null
          categoria: string
          created_at: string | null
          desconto_percent: number | null
          descricao: string | null
          id: string
          imagem_url: string | null
          loja: string
          marca: string | null
          preco_oferta: number
          preco_original: number
          produto: string | null
          titulo: string
          total_cliques: number | null
          total_enviados: number | null
          total_vendas: number | null
          updated_at: string | null
          url_afiliado: string
          validade_fim: string | null
          validade_inicio: string | null
        }
        Insert: {
          ativa?: boolean | null
          categoria: string
          created_at?: string | null
          desconto_percent?: number | null
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          loja: string
          marca?: string | null
          preco_oferta: number
          preco_original: number
          produto?: string | null
          titulo: string
          total_cliques?: number | null
          total_enviados?: number | null
          total_vendas?: number | null
          updated_at?: string | null
          url_afiliado: string
          validade_fim?: string | null
          validade_inicio?: string | null
        }
        Update: {
          ativa?: boolean | null
          categoria?: string
          created_at?: string | null
          desconto_percent?: number | null
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          loja?: string
          marca?: string | null
          preco_oferta?: number
          preco_original?: number
          produto?: string | null
          titulo?: string
          total_cliques?: number | null
          total_enviados?: number | null
          total_vendas?: number | null
          updated_at?: string | null
          url_afiliado?: string
          validade_fim?: string | null
          validade_inicio?: string | null
        }
        Relationships: []
      }
      afiliado_ofertas_enviadas: {
        Row: {
          clicou: boolean | null
          clicou_at: string | null
          comprou: boolean | null
          comprou_at: string | null
          enviado_at: string | null
          feedback: string | null
          id: string
          oferta_id: string | null
          phone: string
          valor_compra: number | null
        }
        Insert: {
          clicou?: boolean | null
          clicou_at?: string | null
          comprou?: boolean | null
          comprou_at?: string | null
          enviado_at?: string | null
          feedback?: string | null
          id?: string
          oferta_id?: string | null
          phone: string
          valor_compra?: number | null
        }
        Update: {
          clicou?: boolean | null
          clicou_at?: string | null
          comprou?: boolean | null
          comprou_at?: string | null
          enviado_at?: string | null
          feedback?: string | null
          id?: string
          oferta_id?: string | null
          phone?: string
          valor_compra?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "afiliado_ofertas_enviadas_oferta_id_fkey"
            columns: ["oferta_id"]
            isOneToOne: false
            referencedRelation: "afiliado_ofertas"
            referencedColumns: ["id"]
          },
        ]
      }
      afiliado_produtos: {
        Row: {
          categoria: string | null
          created_at: string | null
          descricao: string | null
          id: string
          imagem_url: string | null
          link_afiliado: string
          marketplace: string
          preco: number | null
          status: string | null
          titulo: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          link_afiliado: string
          marketplace: string
          preco?: number | null
          status?: string | null
          titulo: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          link_afiliado?: string
          marketplace?: string
          preco?: number | null
          status?: string | null
          titulo?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      afiliado_user_states: {
        Row: {
          created_at: string | null
          id: string
          phone: string
          state: Json
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          phone: string
          state?: Json
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          phone?: string
          state?: Json
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      afiliado_vendas: {
        Row: {
          comprovante_url: string | null
          created_at: string | null
          data_venda: string | null
          estimativa_comissao: number | null
          id: string
          marketplace: string
          observacao: string | null
          produto_id: string | null
          user_id: string
          valor: number
        }
        Insert: {
          comprovante_url?: string | null
          created_at?: string | null
          data_venda?: string | null
          estimativa_comissao?: number | null
          id?: string
          marketplace: string
          observacao?: string | null
          produto_id?: string | null
          user_id: string
          valor: number
        }
        Update: {
          comprovante_url?: string | null
          created_at?: string | null
          data_venda?: string | null
          estimativa_comissao?: number | null
          id?: string
          marketplace?: string
          observacao?: string | null
          produto_id?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "afiliado_vendas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "afiliado_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      afiliado_webhook_dedup: {
        Row: {
          created_at: string
          id: string
          instance_name: string
          message_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_name?: string
          message_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_name?: string
          message_id?: string
        }
        Relationships: []
      }
      afiliados: {
        Row: {
          codigo_referencia: string
          conta_bancaria: Json | null
          created_at: string | null
          email: string
          id: string
          nome: string
          status: string | null
          taxa_comissao: number | null
          total_comissoes: number | null
          total_indicacoes: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          codigo_referencia: string
          conta_bancaria?: Json | null
          created_at?: string | null
          email: string
          id?: string
          nome: string
          status?: string | null
          taxa_comissao?: number | null
          total_comissoes?: number | null
          total_indicacoes?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          codigo_referencia?: string
          conta_bancaria?: Json | null
          created_at?: string | null
          email?: string
          id?: string
          nome?: string
          status?: string | null
          taxa_comissao?: number | null
          total_comissoes?: number | null
          total_indicacoes?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_logs: {
        Row: {
          arquivo_path: string | null
          created_at: string
          duracao_ms: number | null
          erro: string | null
          id: string
          status: string
          tabelas_backup: string[] | null
          tamanho_bytes: number | null
        }
        Insert: {
          arquivo_path?: string | null
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          id?: string
          status?: string
          tabelas_backup?: string[] | null
          tamanho_bytes?: number | null
        }
        Update: {
          arquivo_path?: string | null
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          id?: string
          status?: string
          tabelas_backup?: string[] | null
          tamanho_bytes?: number | null
        }
        Relationships: []
      }
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
      cadastros: {
        Row: {
          bloqueou: boolean | null
          created_at: string | null
          email: string | null
          empresa: string | null
          id: string
          nome: string
          notas: string | null
          opt_in: boolean | null
          opt_in_id: string | null
          origem: string | null
          respondeu_alguma_vez: boolean | null
          tags: string[] | null
          total_mensagens_enviadas: number | null
          total_mensagens_recebidas: number | null
          ultima_interacao: string | null
          updated_at: string | null
          user_id: string | null
          whatsapp: string
          whatsapp_validado: boolean | null
        }
        Insert: {
          bloqueou?: boolean | null
          created_at?: string | null
          email?: string | null
          empresa?: string | null
          id?: string
          nome: string
          notas?: string | null
          opt_in?: boolean | null
          opt_in_id?: string | null
          origem?: string | null
          respondeu_alguma_vez?: boolean | null
          tags?: string[] | null
          total_mensagens_enviadas?: number | null
          total_mensagens_recebidas?: number | null
          ultima_interacao?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp: string
          whatsapp_validado?: boolean | null
        }
        Update: {
          bloqueou?: boolean | null
          created_at?: string | null
          email?: string | null
          empresa?: string | null
          id?: string
          nome?: string
          notas?: string | null
          opt_in?: boolean | null
          opt_in_id?: string | null
          origem?: string | null
          respondeu_alguma_vez?: boolean | null
          tags?: string[] | null
          total_mensagens_enviadas?: number | null
          total_mensagens_recebidas?: number | null
          ultima_interacao?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp?: string
          whatsapp_validado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "cadastros_opt_in_id_fkey"
            columns: ["opt_in_id"]
            isOneToOne: false
            referencedRelation: "opt_ins"
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
      campanhas_ativas: {
        Row: {
          aguardando_resposta: boolean | null
          cliente_id: string | null
          created_at: string | null
          enviado_em: string | null
          id: string
          mensagem: string | null
          pausado: boolean | null
          respondeu: boolean | null
          tipo: string | null
          whatsapp: string
        }
        Insert: {
          aguardando_resposta?: boolean | null
          cliente_id?: string | null
          created_at?: string | null
          enviado_em?: string | null
          id?: string
          mensagem?: string | null
          pausado?: boolean | null
          respondeu?: boolean | null
          tipo?: string | null
          whatsapp: string
        }
        Update: {
          aguardando_resposta?: boolean | null
          cliente_id?: string | null
          created_at?: string | null
          enviado_em?: string | null
          id?: string
          mensagem?: string | null
          pausado?: boolean | null
          respondeu?: boolean | null
          tipo?: string | null
          whatsapp?: string
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
          vendedor_id: string | null
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
          vendedor_id?: string | null
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
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_prospeccao_icp_config_id_fkey"
            columns: ["icp_config_id"]
            isOneToOne: false
            referencedRelation: "icp_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanhas_prospeccao_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
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
          vendedor_id: string | null
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
          vendedor_id?: string | null
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
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_recorrentes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanhas_recorrentes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      client_menu_config: {
        Row: {
          created_at: string | null
          empresa_nome: string | null
          id: string
          menus_permitidos: string[]
          tipo_cliente: string
        }
        Insert: {
          created_at?: string | null
          empresa_nome?: string | null
          id?: string
          menus_permitidos: string[]
          tipo_cliente: string
        }
        Update: {
          created_at?: string | null
          empresa_nome?: string | null
          id?: string
          menus_permitidos?: string[]
          tipo_cliente?: string
        }
        Relationships: []
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
      clientes_afiliados: {
        Row: {
          afiliado_id: string | null
          amazon_affiliate_tag: string | null
          assistente_personalidade: string | null
          created_at: string | null
          data_cadastro: string | null
          data_conexao_whatsapp: string | null
          email: string
          id: string
          nome: string
          nome_assistente: string | null
          plano: string | null
          status: string | null
          telefone: string
          updated_at: string | null
          user_id: string | null
          wuzapi_instance_id: string | null
          wuzapi_jid: string | null
          wuzapi_token: string | null
        }
        Insert: {
          afiliado_id?: string | null
          amazon_affiliate_tag?: string | null
          assistente_personalidade?: string | null
          created_at?: string | null
          data_cadastro?: string | null
          data_conexao_whatsapp?: string | null
          email: string
          id?: string
          nome: string
          nome_assistente?: string | null
          plano?: string | null
          status?: string | null
          telefone: string
          updated_at?: string | null
          user_id?: string | null
          wuzapi_instance_id?: string | null
          wuzapi_jid?: string | null
          wuzapi_token?: string | null
        }
        Update: {
          afiliado_id?: string | null
          amazon_affiliate_tag?: string | null
          assistente_personalidade?: string | null
          created_at?: string | null
          data_cadastro?: string | null
          data_conexao_whatsapp?: string | null
          email?: string
          id?: string
          nome?: string
          nome_assistente?: string | null
          plano?: string | null
          status?: string | null
          telefone?: string
          updated_at?: string | null
          user_id?: string | null
          wuzapi_instance_id?: string | null
          wuzapi_jid?: string | null
          wuzapi_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_afiliados_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes: {
        Row: {
          afiliado_id: string | null
          cliente_id: string | null
          created_at: string | null
          data_pagamento: string | null
          id: string
          mes_referencia: string
          status: string | null
          valor: number
        }
        Insert: {
          afiliado_id?: string | null
          cliente_id?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          id?: string
          mes_referencia: string
          status?: string | null
          valor: number
        }
        Update: {
          afiliado_id?: string | null
          cliente_id?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          id?: string
          mes_referencia?: string
          status?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes_afiliados"
            referencedColumns: ["id"]
          },
        ]
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
      fila_atendimento_afiliado: {
        Row: {
          conversa_id: string | null
          created_at: string | null
          erro: string | null
          id: string
          imagem_url: string | null
          instance_name: string | null
          lead_name: string | null
          lead_phone: string
          max_tentativas: number | null
          mensagem_recebida: string
          metadata: Json | null
          origem: string | null
          prioridade: number | null
          processing_started_at: string | null
          resposta_ia: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          tentativas: number | null
          tipo_mensagem: string | null
          user_id: string | null
          wuzapi_token: string | null
        }
        Insert: {
          conversa_id?: string | null
          created_at?: string | null
          erro?: string | null
          id?: string
          imagem_url?: string | null
          instance_name?: string | null
          lead_name?: string | null
          lead_phone: string
          max_tentativas?: number | null
          mensagem_recebida: string
          metadata?: Json | null
          origem?: string | null
          prioridade?: number | null
          processing_started_at?: string | null
          resposta_ia?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          tentativas?: number | null
          tipo_mensagem?: string | null
          user_id?: string | null
          wuzapi_token?: string | null
        }
        Update: {
          conversa_id?: string | null
          created_at?: string | null
          erro?: string | null
          id?: string
          imagem_url?: string | null
          instance_name?: string | null
          lead_name?: string | null
          lead_phone?: string
          max_tentativas?: number | null
          mensagem_recebida?: string
          metadata?: Json | null
          origem?: string | null
          prioridade?: number | null
          processing_started_at?: string | null
          resposta_ia?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          tentativas?: number | null
          tipo_mensagem?: string | null
          user_id?: string | null
          wuzapi_token?: string | null
        }
        Relationships: []
      }
      fila_prospeccao_pietro: {
        Row: {
          created_at: string
          enviado_em: string | null
          erro: string | null
          id: string
          lead_id: string | null
          lote: number
          nome: string | null
          phone: string
          respondeu: boolean | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          lead_id?: string | null
          lote?: number
          nome?: string | null
          phone: string
          respondeu?: boolean | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          lead_id?: string | null
          lote?: number
          nome?: string | null
          phone?: string
          respondeu?: boolean | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      google_ads_campaigns: {
        Row: {
          ad_type: string | null
          biblioteca_campanha_id: string | null
          budget_daily: number | null
          budget_total: number | null
          campaign_id: string
          created_at: string | null
          end_date: string | null
          id: string
          keywords: string[] | null
          metrics: Json | null
          name: string
          produto_id: string | null
          start_date: string | null
          status: string | null
          targeting: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ad_type?: string | null
          biblioteca_campanha_id?: string | null
          budget_daily?: number | null
          budget_total?: number | null
          campaign_id: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          keywords?: string[] | null
          metrics?: Json | null
          name: string
          produto_id?: string | null
          start_date?: string | null
          status?: string | null
          targeting?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ad_type?: string | null
          biblioteca_campanha_id?: string | null
          budget_daily?: number | null
          budget_total?: number | null
          campaign_id?: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          keywords?: string[] | null
          metrics?: Json | null
          name?: string
          produto_id?: string | null
          start_date?: string | null
          status?: string | null
          targeting?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_ads_campaigns_biblioteca_campanha_id_fkey"
            columns: ["biblioteca_campanha_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_ads_campaigns_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ads_config: {
        Row: {
          access_token: string | null
          account_email: string | null
          client_id: string | null
          client_secret: string | null
          connected_at: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token?: string | null
          account_email?: string | null
          client_id?: string | null
          client_secret?: string | null
          connected_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string | null
          account_email?: string | null
          client_id?: string | null
          client_secret?: string | null
          connected_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      grupo_membros: {
        Row: {
          adicionado_em: string | null
          cadastro_id: string
          grupo_id: string
          id: string
        }
        Insert: {
          adicionado_em?: string | null
          cadastro_id: string
          grupo_id: string
          id?: string
        }
        Update: {
          adicionado_em?: string | null
          cadastro_id?: string
          grupo_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupo_membros_cadastro_id_fkey"
            columns: ["cadastro_id"]
            isOneToOne: false
            referencedRelation: "cadastros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupo_membros_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos_transmissao"
            referencedColumns: ["id"]
          },
        ]
      }
      grupos_transmissao: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string | null
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          total_membros: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          total_membros?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          total_membros?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      historico_envio_programado: {
        Row: {
          enviado_at: string | null
          erro: string | null
          grupos_enviados: number | null
          grupos_ids: string[] | null
          id: string
          produto_categoria: string | null
          produto_id: string | null
          produto_imagem: string | null
          produto_link: string | null
          produto_preco: number | null
          produto_titulo: string | null
          programacao_id: string | null
          sucesso: boolean | null
          user_id: string | null
        }
        Insert: {
          enviado_at?: string | null
          erro?: string | null
          grupos_enviados?: number | null
          grupos_ids?: string[] | null
          id?: string
          produto_categoria?: string | null
          produto_id?: string | null
          produto_imagem?: string | null
          produto_link?: string | null
          produto_preco?: number | null
          produto_titulo?: string | null
          programacao_id?: string | null
          sucesso?: boolean | null
          user_id?: string | null
        }
        Update: {
          enviado_at?: string | null
          erro?: string | null
          grupos_enviados?: number | null
          grupos_ids?: string[] | null
          id?: string
          produto_categoria?: string | null
          produto_id?: string | null
          produto_imagem?: string | null
          produto_link?: string | null
          produto_preco?: number | null
          produto_titulo?: string | null
          programacao_id?: string | null
          sucesso?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_envio_programado_programacao_id_fkey"
            columns: ["programacao_id"]
            isOneToOne: false
            referencedRelation: "programacao_envio_afiliado"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_envios: {
        Row: {
          erro: string | null
          id: string
          mensagem: string | null
          sucesso: boolean | null
          timestamp: string | null
          tipo: string | null
          whatsapp: string
        }
        Insert: {
          erro?: string | null
          id?: string
          mensagem?: string | null
          sucesso?: boolean | null
          timestamp?: string | null
          tipo?: string | null
          whatsapp: string
        }
        Update: {
          erro?: string | null
          id?: string
          mensagem?: string | null
          sucesso?: boolean | null
          timestamp?: string | null
          tipo?: string | null
          whatsapp?: string
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
      importacao_detalhes: {
        Row: {
          created_at: string | null
          email: string | null
          empresa: string | null
          erro_mensagem: string | null
          id: string
          importacao_id: string | null
          linha: number | null
          nome: string | null
          opt_in_id: string | null
          status: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          empresa?: string | null
          erro_mensagem?: string | null
          id?: string
          importacao_id?: string | null
          linha?: number | null
          nome?: string | null
          opt_in_id?: string | null
          status?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          empresa?: string | null
          erro_mensagem?: string | null
          id?: string
          importacao_id?: string | null
          linha?: number | null
          nome?: string | null
          opt_in_id?: string | null
          status?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "importacao_detalhes_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacao_detalhes_opt_in_id_fkey"
            columns: ["opt_in_id"]
            isOneToOne: false
            referencedRelation: "opt_ins"
            referencedColumns: ["id"]
          },
        ]
      }
      importacoes: {
        Row: {
          arquivo_nome: string | null
          completed_at: string | null
          created_at: string | null
          duplicados: number | null
          enviar_boas_vindas: boolean | null
          erros: number | null
          id: string
          origem_opt_in: string | null
          progresso: number | null
          status: string | null
          tempo_decorrido_segundos: number | null
          total_linhas: number | null
          user_id: string
          validos: number | null
          velocidade: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          completed_at?: string | null
          created_at?: string | null
          duplicados?: number | null
          enviar_boas_vindas?: boolean | null
          erros?: number | null
          id?: string
          origem_opt_in?: string | null
          progresso?: number | null
          status?: string | null
          tempo_decorrido_segundos?: number | null
          total_linhas?: number | null
          user_id: string
          validos?: number | null
          velocidade?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          completed_at?: string | null
          created_at?: string | null
          duplicados?: number | null
          enviar_boas_vindas?: boolean | null
          erros?: number | null
          id?: string
          origem_opt_in?: string | null
          progresso?: number | null
          status?: string | null
          tempo_decorrido_segundos?: number | null
          total_linhas?: number | null
          user_id?: string
          validos?: number | null
          velocidade?: string | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string | null
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
          expires_at?: string | null
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
          expires_at?: string | null
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
      interacoes: {
        Row: {
          created_at: string | null
          created_by: string | null
          descricao: string | null
          duracao_segundos: number | null
          id: string
          lead_id: string
          lead_tipo: string
          metadata: Json | null
          resultado: string | null
          tipo: string
          titulo: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          duracao_segundos?: number | null
          id?: string
          lead_id: string
          lead_tipo: string
          metadata?: Json | null
          resultado?: string | null
          tipo: string
          titulo?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          duracao_segundos?: number | null
          id?: string
          lead_id?: string
          lead_tipo?: string
          metadata?: Json | null
          resultado?: string | null
          tipo?: string
          titulo?: string | null
        }
        Relationships: []
      }
      lead_atribuicoes: {
        Row: {
          atribuido_por: string | null
          created_at: string | null
          id: string
          lead_id: string
          lead_tipo: string
          motivo: string | null
          vendedor_id: string | null
        }
        Insert: {
          atribuido_por?: string | null
          created_at?: string | null
          id?: string
          lead_id: string
          lead_tipo: string
          motivo?: string | null
          vendedor_id?: string | null
        }
        Update: {
          atribuido_por?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string
          lead_tipo?: string
          motivo?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_atribuicoes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
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
          endereco_consultorio: string | null
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
          instagram_url: string | null
          instagram_username: string | null
          linkedin_url: string | null
          mensagem_selecionada: string | null
          mensagens_geradas: Json | null
          motivo_invalidacao: string | null
          natureza_juridica: string | null
          nome_fantasia: string | null
          num_funcionarios: number | null
          pipeline_status: string
          porte: string | null
          product_id: string | null
          qualificacao_motivo: string | null
          qualified_at: string | null
          query_usada: string | null
          razao_social: string
          recomendacao: string | null
          respondeu_em: string | null
          score: number | null
          score_breakdown: Json | null
          setor: string | null
          site_consultorio: string | null
          site_url: string | null
          situacao: string | null
          socios: Json | null
          telefone: string | null
          twitter_url: string | null
          updated_at: string | null
          user_id: string
          validacao_icp: Json | null
          validado_em: string | null
          validado_manualmente: boolean | null
          validado_por: string | null
          vendedor_id: string | null
          website: string | null
          whatsapp_business: boolean | null
          whatsapp_verificado: boolean | null
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
          endereco_consultorio?: string | null
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
          instagram_url?: string | null
          instagram_username?: string | null
          linkedin_url?: string | null
          mensagem_selecionada?: string | null
          mensagens_geradas?: Json | null
          motivo_invalidacao?: string | null
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          num_funcionarios?: number | null
          pipeline_status?: string
          porte?: string | null
          product_id?: string | null
          qualificacao_motivo?: string | null
          qualified_at?: string | null
          query_usada?: string | null
          razao_social: string
          recomendacao?: string | null
          respondeu_em?: string | null
          score?: number | null
          score_breakdown?: Json | null
          setor?: string | null
          site_consultorio?: string | null
          site_url?: string | null
          situacao?: string | null
          socios?: Json | null
          telefone?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          user_id: string
          validacao_icp?: Json | null
          validado_em?: string | null
          validado_manualmente?: boolean | null
          validado_por?: string | null
          vendedor_id?: string | null
          website?: string | null
          whatsapp_business?: boolean | null
          whatsapp_verificado?: boolean | null
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
          endereco_consultorio?: string | null
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
          instagram_url?: string | null
          instagram_username?: string | null
          linkedin_url?: string | null
          mensagem_selecionada?: string | null
          mensagens_geradas?: Json | null
          motivo_invalidacao?: string | null
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          num_funcionarios?: number | null
          pipeline_status?: string
          porte?: string | null
          product_id?: string | null
          qualificacao_motivo?: string | null
          qualified_at?: string | null
          query_usada?: string | null
          razao_social?: string
          recomendacao?: string | null
          respondeu_em?: string | null
          score?: number | null
          score_breakdown?: Json | null
          setor?: string | null
          site_consultorio?: string | null
          site_url?: string | null
          situacao?: string | null
          socios?: Json | null
          telefone?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          user_id?: string
          validacao_icp?: Json | null
          validado_em?: string | null
          validado_manualmente?: boolean | null
          validado_por?: string | null
          vendedor_id?: string | null
          website?: string | null
          whatsapp_business?: boolean | null
          whatsapp_verificado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_b2b_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas_prospeccao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_b2b_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_b2b_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
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
          endereco_consultorio: string | null
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
          instagram_url: string | null
          instagram_username: string | null
          linkedin_id: string | null
          linkedin_url: string | null
          mensagem_selecionada: string | null
          mensagens_geradas: Json | null
          motivo_invalidacao: string | null
          nome_completo: string
          oab: string | null
          pipeline_status: string
          product_id: string | null
          profissao: string
          qualificacao_motivo: string | null
          qualified_at: string | null
          query_usada: string | null
          recomendacao: string | null
          respondeu_em: string | null
          score: number | null
          score_breakdown: Json | null
          sinais_poder_aquisitivo: string[] | null
          site_consultorio: string | null
          site_url: string | null
          telefone: string | null
          tem_consultorio: boolean | null
          tipo_validado: boolean | null
          twitter_url: string | null
          updated_at: string | null
          user_id: string
          validacao_resultado: Json | null
          validado_em: string | null
          validado_manualmente: boolean | null
          validado_por: string | null
          vendedor_id: string | null
          whatsapp: string | null
          whatsapp_business: boolean | null
          whatsapp_status: string | null
          whatsapp_verificado: boolean | null
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
          endereco_consultorio?: string | null
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
          instagram_url?: string | null
          instagram_username?: string | null
          linkedin_id?: string | null
          linkedin_url?: string | null
          mensagem_selecionada?: string | null
          mensagens_geradas?: Json | null
          motivo_invalidacao?: string | null
          nome_completo: string
          oab?: string | null
          pipeline_status?: string
          product_id?: string | null
          profissao: string
          qualificacao_motivo?: string | null
          qualified_at?: string | null
          query_usada?: string | null
          recomendacao?: string | null
          respondeu_em?: string | null
          score?: number | null
          score_breakdown?: Json | null
          sinais_poder_aquisitivo?: string[] | null
          site_consultorio?: string | null
          site_url?: string | null
          telefone?: string | null
          tem_consultorio?: boolean | null
          tipo_validado?: boolean | null
          twitter_url?: string | null
          updated_at?: string | null
          user_id: string
          validacao_resultado?: Json | null
          validado_em?: string | null
          validado_manualmente?: boolean | null
          validado_por?: string | null
          vendedor_id?: string | null
          whatsapp?: string | null
          whatsapp_business?: boolean | null
          whatsapp_status?: string | null
          whatsapp_verificado?: boolean | null
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
          endereco_consultorio?: string | null
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
          instagram_url?: string | null
          instagram_username?: string | null
          linkedin_id?: string | null
          linkedin_url?: string | null
          mensagem_selecionada?: string | null
          mensagens_geradas?: Json | null
          motivo_invalidacao?: string | null
          nome_completo?: string
          oab?: string | null
          pipeline_status?: string
          product_id?: string | null
          profissao?: string
          qualificacao_motivo?: string | null
          qualified_at?: string | null
          query_usada?: string | null
          recomendacao?: string | null
          respondeu_em?: string | null
          score?: number | null
          score_breakdown?: Json | null
          sinais_poder_aquisitivo?: string[] | null
          site_consultorio?: string | null
          site_url?: string | null
          telefone?: string | null
          tem_consultorio?: boolean | null
          tipo_validado?: boolean | null
          twitter_url?: string | null
          updated_at?: string | null
          user_id?: string
          validacao_resultado?: Json | null
          validado_em?: string | null
          validado_manualmente?: boolean | null
          validado_por?: string | null
          vendedor_id?: string | null
          whatsapp?: string | null
          whatsapp_business?: boolean | null
          whatsapp_status?: string | null
          whatsapp_verificado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_b2c_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas_prospeccao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_b2c_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_b2c_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
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
      leads_ebooks: {
        Row: {
          cashback_ativo: boolean | null
          categorias: string[] | null
          created_at: string | null
          ebook_recebido: string | null
          id: string
          nome: string | null
          origem: string | null
          origem_detalhe: string | null
          phone: string
          primeiro_contato_at: string | null
          total_interacoes: number | null
          ultimo_contato_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cashback_ativo?: boolean | null
          categorias?: string[] | null
          created_at?: string | null
          ebook_recebido?: string | null
          id?: string
          nome?: string | null
          origem?: string | null
          origem_detalhe?: string | null
          phone: string
          primeiro_contato_at?: string | null
          total_interacoes?: number | null
          ultimo_contato_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cashback_ativo?: boolean | null
          categorias?: string[] | null
          created_at?: string | null
          ebook_recebido?: string | null
          id?: string
          nome?: string | null
          origem?: string | null
          origem_detalhe?: string | null
          phone?: string
          primeiro_contato_at?: string | null
          total_interacoes?: number | null
          ultimo_contato_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      leads_imoveis_enriquecidos: {
        Row: {
          buscas_identificadas: Json | null
          cargo: string | null
          cnpj_empresa: string | null
          confianca_dados: number | null
          contatado_por: string | null
          corretoras_visitadas: Json | null
          cpf_validado: boolean | null
          created_at: string | null
          dados_completos: boolean | null
          data_contato: string | null
          data_enriquecimento: string | null
          data_validacao: string | null
          empresa: string | null
          empresa_validada: boolean | null
          experiencia_anos: number | null
          facebook_cidade: string | null
          facebook_clubes: string[] | null
          facebook_encontrado: boolean | null
          facebook_foto: string | null
          facebook_trabalho: string | null
          facebook_url: string | null
          fontes_encontradas: string[] | null
          formacao: string | null
          foto_google_url: string | null
          foto_url: string | null
          fotos_validadas: boolean | null
          google_profile_url: string | null
          id: string
          imoveis_possui: Json | null
          instagram_bio: string | null
          instagram_encontrado: boolean | null
          instagram_followers: number | null
          instagram_foto: string | null
          instagram_interesses: string[] | null
          instagram_posts: number | null
          instagram_ultima_atividade: string | null
          instagram_url: string | null
          instagram_username: string | null
          linkedin_connections: string | null
          linkedin_encontrado: boolean | null
          linkedin_foto: string | null
          linkedin_url: string | null
          localizacao_desejada: string | null
          log_validacao: Json | null
          nome: string
          objecoes: string[] | null
          observacoes: string | null
          olx_anuncios_ativos: number | null
          olx_anuncios_historico: Json | null
          olx_perfil_url: string | null
          olx_telefone_confirmado: boolean | null
          olx_ultima_atividade: string | null
          orcamento_max: number | null
          orcamento_min: number | null
          patrimonio_estimado: number | null
          probabilidade_compra: number | null
          projeto_id: string | null
          qualificacao: string | null
          quartos_desejado: number | null
          quintoandar_imoveis: Json | null
          quintoandar_perfil_url: string | null
          quintoandar_tipo: string | null
          quintoandar_verificado: boolean | null
          renda_estimada: number | null
          renda_oficial: number | null
          score_atividade: number | null
          score_foto: number | null
          score_localizacao: number | null
          score_nome: number | null
          score_redes_sociais: number | null
          score_telefone: number | null
          score_total: number | null
          setor: string | null
          similaridade_fotos: number | null
          status: string | null
          status_validacao: string | null
          telefone: string | null
          tipo_imovel_desejado: string | null
          total_corretoras: number | null
          ultima_visita_dias: number | null
          updated_at: string | null
          user_id: string
          validado_por: string | null
          vivareal_anuncios: number | null
          vivareal_corretor: boolean | null
          vivareal_perfil_url: string | null
          zap_anuncios: number | null
          zap_email: string | null
          zap_perfil_url: string | null
          zap_telefone: string | null
        }
        Insert: {
          buscas_identificadas?: Json | null
          cargo?: string | null
          cnpj_empresa?: string | null
          confianca_dados?: number | null
          contatado_por?: string | null
          corretoras_visitadas?: Json | null
          cpf_validado?: boolean | null
          created_at?: string | null
          dados_completos?: boolean | null
          data_contato?: string | null
          data_enriquecimento?: string | null
          data_validacao?: string | null
          empresa?: string | null
          empresa_validada?: boolean | null
          experiencia_anos?: number | null
          facebook_cidade?: string | null
          facebook_clubes?: string[] | null
          facebook_encontrado?: boolean | null
          facebook_foto?: string | null
          facebook_trabalho?: string | null
          facebook_url?: string | null
          fontes_encontradas?: string[] | null
          formacao?: string | null
          foto_google_url?: string | null
          foto_url?: string | null
          fotos_validadas?: boolean | null
          google_profile_url?: string | null
          id?: string
          imoveis_possui?: Json | null
          instagram_bio?: string | null
          instagram_encontrado?: boolean | null
          instagram_followers?: number | null
          instagram_foto?: string | null
          instagram_interesses?: string[] | null
          instagram_posts?: number | null
          instagram_ultima_atividade?: string | null
          instagram_url?: string | null
          instagram_username?: string | null
          linkedin_connections?: string | null
          linkedin_encontrado?: boolean | null
          linkedin_foto?: string | null
          linkedin_url?: string | null
          localizacao_desejada?: string | null
          log_validacao?: Json | null
          nome: string
          objecoes?: string[] | null
          observacoes?: string | null
          olx_anuncios_ativos?: number | null
          olx_anuncios_historico?: Json | null
          olx_perfil_url?: string | null
          olx_telefone_confirmado?: boolean | null
          olx_ultima_atividade?: string | null
          orcamento_max?: number | null
          orcamento_min?: number | null
          patrimonio_estimado?: number | null
          probabilidade_compra?: number | null
          projeto_id?: string | null
          qualificacao?: string | null
          quartos_desejado?: number | null
          quintoandar_imoveis?: Json | null
          quintoandar_perfil_url?: string | null
          quintoandar_tipo?: string | null
          quintoandar_verificado?: boolean | null
          renda_estimada?: number | null
          renda_oficial?: number | null
          score_atividade?: number | null
          score_foto?: number | null
          score_localizacao?: number | null
          score_nome?: number | null
          score_redes_sociais?: number | null
          score_telefone?: number | null
          score_total?: number | null
          setor?: string | null
          similaridade_fotos?: number | null
          status?: string | null
          status_validacao?: string | null
          telefone?: string | null
          tipo_imovel_desejado?: string | null
          total_corretoras?: number | null
          ultima_visita_dias?: number | null
          updated_at?: string | null
          user_id: string
          validado_por?: string | null
          vivareal_anuncios?: number | null
          vivareal_corretor?: boolean | null
          vivareal_perfil_url?: string | null
          zap_anuncios?: number | null
          zap_email?: string | null
          zap_perfil_url?: string | null
          zap_telefone?: string | null
        }
        Update: {
          buscas_identificadas?: Json | null
          cargo?: string | null
          cnpj_empresa?: string | null
          confianca_dados?: number | null
          contatado_por?: string | null
          corretoras_visitadas?: Json | null
          cpf_validado?: boolean | null
          created_at?: string | null
          dados_completos?: boolean | null
          data_contato?: string | null
          data_enriquecimento?: string | null
          data_validacao?: string | null
          empresa?: string | null
          empresa_validada?: boolean | null
          experiencia_anos?: number | null
          facebook_cidade?: string | null
          facebook_clubes?: string[] | null
          facebook_encontrado?: boolean | null
          facebook_foto?: string | null
          facebook_trabalho?: string | null
          facebook_url?: string | null
          fontes_encontradas?: string[] | null
          formacao?: string | null
          foto_google_url?: string | null
          foto_url?: string | null
          fotos_validadas?: boolean | null
          google_profile_url?: string | null
          id?: string
          imoveis_possui?: Json | null
          instagram_bio?: string | null
          instagram_encontrado?: boolean | null
          instagram_followers?: number | null
          instagram_foto?: string | null
          instagram_interesses?: string[] | null
          instagram_posts?: number | null
          instagram_ultima_atividade?: string | null
          instagram_url?: string | null
          instagram_username?: string | null
          linkedin_connections?: string | null
          linkedin_encontrado?: boolean | null
          linkedin_foto?: string | null
          linkedin_url?: string | null
          localizacao_desejada?: string | null
          log_validacao?: Json | null
          nome?: string
          objecoes?: string[] | null
          observacoes?: string | null
          olx_anuncios_ativos?: number | null
          olx_anuncios_historico?: Json | null
          olx_perfil_url?: string | null
          olx_telefone_confirmado?: boolean | null
          olx_ultima_atividade?: string | null
          orcamento_max?: number | null
          orcamento_min?: number | null
          patrimonio_estimado?: number | null
          probabilidade_compra?: number | null
          projeto_id?: string | null
          qualificacao?: string | null
          quartos_desejado?: number | null
          quintoandar_imoveis?: Json | null
          quintoandar_perfil_url?: string | null
          quintoandar_tipo?: string | null
          quintoandar_verificado?: boolean | null
          renda_estimada?: number | null
          renda_oficial?: number | null
          score_atividade?: number | null
          score_foto?: number | null
          score_localizacao?: number | null
          score_nome?: number | null
          score_redes_sociais?: number | null
          score_telefone?: number | null
          score_total?: number | null
          setor?: string | null
          similaridade_fotos?: number | null
          status?: string | null
          status_validacao?: string | null
          telefone?: string | null
          tipo_imovel_desejado?: string | null
          total_corretoras?: number | null
          ultima_visita_dias?: number | null
          updated_at?: string | null
          user_id?: string
          validado_por?: string | null
          vivareal_anuncios?: number | null
          vivareal_corretor?: boolean | null
          vivareal_perfil_url?: string | null
          zap_anuncios?: number | null
          zap_email?: string | null
          zap_perfil_url?: string | null
          zap_telefone?: string | null
        }
        Relationships: []
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
      mensagens_enviadas: {
        Row: {
          created_at: string | null
          id: string
          lead_id: string | null
          lead_tipo: string
          message: string
          phone: string
          respondeu: boolean | null
          resposta_texto: string | null
          sent_at: string | null
          strategy: Json | null
          user_id: string | null
          wuzapi_response: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lead_id?: string | null
          lead_tipo?: string
          message: string
          phone: string
          respondeu?: boolean | null
          resposta_texto?: string | null
          sent_at?: string | null
          strategy?: Json | null
          user_id?: string | null
          wuzapi_response?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lead_id?: string | null
          lead_tipo?: string
          message?: string
          phone?: string
          respondeu?: boolean | null
          resposta_texto?: string | null
          sent_at?: string | null
          strategy?: Json | null
          user_id?: string | null
          wuzapi_response?: Json | null
        }
        Relationships: []
      }
      opt_ins: {
        Row: {
          created_at: string | null
          data_cadastro: string | null
          email: string | null
          id: string
          ip_address: string | null
          nome: string
          opt_in_aceito: boolean | null
          origem: string | null
          status: string | null
          termo_aceite: string | null
          updated_at: string | null
          user_agent: string | null
          whatsapp: string
        }
        Insert: {
          created_at?: string | null
          data_cadastro?: string | null
          email?: string | null
          id?: string
          ip_address?: string | null
          nome: string
          opt_in_aceito?: boolean | null
          origem?: string | null
          status?: string | null
          termo_aceite?: string | null
          updated_at?: string | null
          user_agent?: string | null
          whatsapp: string
        }
        Update: {
          created_at?: string | null
          data_cadastro?: string | null
          email?: string | null
          id?: string
          ip_address?: string | null
          nome?: string
          opt_in_aceito?: boolean | null
          origem?: string | null
          status?: string | null
          termo_aceite?: string | null
          updated_at?: string | null
          user_agent?: string | null
          whatsapp?: string
        }
        Relationships: []
      }
      pietro_conversations: {
        Row: {
          created_at: string | null
          id: string
          interest_score: number | null
          private_notes: string | null
          session_id: string
          status: string | null
          updated_at: string | null
          user_agent: string | null
          visitor_company: string | null
          visitor_email: string | null
          visitor_ip: string | null
          visitor_name: string | null
          visitor_phone: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          interest_score?: number | null
          private_notes?: string | null
          session_id: string
          status?: string | null
          updated_at?: string | null
          user_agent?: string | null
          visitor_company?: string | null
          visitor_email?: string | null
          visitor_ip?: string | null
          visitor_name?: string | null
          visitor_phone?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          interest_score?: number | null
          private_notes?: string | null
          session_id?: string
          status?: string | null
          updated_at?: string | null
          user_agent?: string | null
          visitor_company?: string | null
          visitor_email?: string | null
          visitor_ip?: string | null
          visitor_name?: string | null
          visitor_phone?: string | null
        }
        Relationships: []
      }
      pietro_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "pietro_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "pietro_conversations"
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
          attributes: Json | null
          beneficios: string | null
          brand: string | null
          categoria: string
          cliente_id: string | null
          cor: string | null
          created_at: string
          descricao: string | null
          dimensoes: string | null
          especificacoes: string | null
          estoque: number | null
          ficha_tecnica: string | null
          garantia: string | null
          id: string
          imagem_url: string | null
          imagens: Json | null
          informacao_nutricional: string | null
          ingredientes: string | null
          link: string | null
          link_marketplace: string | null
          modo_uso: string | null
          nome: string
          peso: string | null
          preco: number | null
          preparation: string | null
          publicar_marketplace: boolean | null
          sku: string | null
          tags: string[] | null
          tamanhos: string | null
          tipo: string | null
          updated_at: string
          user_id: string
          vendedor_id: string | null
          warranty: string | null
        }
        Insert: {
          ativo?: boolean | null
          attributes?: Json | null
          beneficios?: string | null
          brand?: string | null
          categoria: string
          cliente_id?: string | null
          cor?: string | null
          created_at?: string
          descricao?: string | null
          dimensoes?: string | null
          especificacoes?: string | null
          estoque?: number | null
          ficha_tecnica?: string | null
          garantia?: string | null
          id?: string
          imagem_url?: string | null
          imagens?: Json | null
          informacao_nutricional?: string | null
          ingredientes?: string | null
          link?: string | null
          link_marketplace?: string | null
          modo_uso?: string | null
          nome: string
          peso?: string | null
          preco?: number | null
          preparation?: string | null
          publicar_marketplace?: boolean | null
          sku?: string | null
          tags?: string[] | null
          tamanhos?: string | null
          tipo?: string | null
          updated_at?: string
          user_id: string
          vendedor_id?: string | null
          warranty?: string | null
        }
        Update: {
          ativo?: boolean | null
          attributes?: Json | null
          beneficios?: string | null
          brand?: string | null
          categoria?: string
          cliente_id?: string | null
          cor?: string | null
          created_at?: string
          descricao?: string | null
          dimensoes?: string | null
          especificacoes?: string | null
          estoque?: number | null
          ficha_tecnica?: string | null
          garantia?: string | null
          id?: string
          imagem_url?: string | null
          imagens?: Json | null
          informacao_nutricional?: string | null
          ingredientes?: string | null
          link?: string | null
          link_marketplace?: string | null
          modo_uso?: string | null
          nome?: string
          peso?: string | null
          preco?: number | null
          preparation?: string | null
          publicar_marketplace?: boolean | null
          sku?: string | null
          tags?: string[] | null
          tamanhos?: string | null
          tipo?: string | null
          updated_at?: string
          user_id?: string
          vendedor_id?: string | null
          warranty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos_enviados_programacao: {
        Row: {
          enviado_at: string | null
          id: string
          produto_id: string
          programacao_id: string
        }
        Insert: {
          enviado_at?: string | null
          id?: string
          produto_id: string
          programacao_id: string
        }
        Update: {
          enviado_at?: string | null
          id?: string
          produto_id?: string
          programacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_enviados_programacao_programacao_id_fkey"
            columns: ["programacao_id"]
            isOneToOne: false
            referencedRelation: "programacao_envio_afiliado"
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
      programacao_envio_afiliado: {
        Row: {
          ativo: boolean | null
          categorias: string[]
          created_at: string | null
          descricao: string | null
          dias_mes: number[] | null
          dias_semana: number[] | null
          enviar_para_todos_grupos: boolean | null
          enviar_tiktok: boolean | null
          grupos_ids: string[] | null
          horario_fim: string
          horario_inicio: string
          id: string
          incluir_imagem: boolean | null
          incluir_link: boolean | null
          incluir_preco: boolean | null
          intervalo_minutos: number
          marketplaces_ativos: string[] | null
          modo_selecao: string | null
          nome: string
          prefixo_mensagem: string | null
          produtos_no_marketplace_atual: number | null
          proximo_envio: string | null
          sufixo_mensagem: string | null
          tiktok_post_mode: string | null
          total_enviados: number | null
          total_enviados_hoje: number | null
          ultimo_envio: string | null
          ultimo_marketplace_enviado: string | null
          ultimo_produto_id: string | null
          ultimo_reset_diario: string | null
          updated_at: string | null
          usar_ia_criativa: boolean | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          categorias?: string[]
          created_at?: string | null
          descricao?: string | null
          dias_mes?: number[] | null
          dias_semana?: number[] | null
          enviar_para_todos_grupos?: boolean | null
          enviar_tiktok?: boolean | null
          grupos_ids?: string[] | null
          horario_fim?: string
          horario_inicio?: string
          id?: string
          incluir_imagem?: boolean | null
          incluir_link?: boolean | null
          incluir_preco?: boolean | null
          intervalo_minutos?: number
          marketplaces_ativos?: string[] | null
          modo_selecao?: string | null
          nome?: string
          prefixo_mensagem?: string | null
          produtos_no_marketplace_atual?: number | null
          proximo_envio?: string | null
          sufixo_mensagem?: string | null
          tiktok_post_mode?: string | null
          total_enviados?: number | null
          total_enviados_hoje?: number | null
          ultimo_envio?: string | null
          ultimo_marketplace_enviado?: string | null
          ultimo_produto_id?: string | null
          ultimo_reset_diario?: string | null
          updated_at?: string | null
          usar_ia_criativa?: boolean | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          categorias?: string[]
          created_at?: string | null
          descricao?: string | null
          dias_mes?: number[] | null
          dias_semana?: number[] | null
          enviar_para_todos_grupos?: boolean | null
          enviar_tiktok?: boolean | null
          grupos_ids?: string[] | null
          horario_fim?: string
          horario_inicio?: string
          id?: string
          incluir_imagem?: boolean | null
          incluir_link?: boolean | null
          incluir_preco?: boolean | null
          intervalo_minutos?: number
          marketplaces_ativos?: string[] | null
          modo_selecao?: string | null
          nome?: string
          prefixo_mensagem?: string | null
          produtos_no_marketplace_atual?: number | null
          proximo_envio?: string | null
          sufixo_mensagem?: string | null
          tiktok_post_mode?: string | null
          total_enviados?: number | null
          total_enviados_hoje?: number | null
          ultimo_envio?: string | null
          ultimo_marketplace_enviado?: string | null
          ultimo_produto_id?: string | null
          ultimo_reset_diario?: string | null
          updated_at?: string | null
          usar_ia_criativa?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      prospecao_optin_log: {
        Row: {
          cadastro_id: string | null
          created_at: string | null
          enviado_em: string | null
          id: string
          mensagem_enviada: string | null
          phone: string
          status: string
          user_id: string | null
          wuzapi_response: Json | null
        }
        Insert: {
          cadastro_id?: string | null
          created_at?: string | null
          enviado_em?: string | null
          id?: string
          mensagem_enviada?: string | null
          phone: string
          status?: string
          user_id?: string | null
          wuzapi_response?: Json | null
        }
        Update: {
          cadastro_id?: string | null
          created_at?: string | null
          enviado_em?: string | null
          id?: string
          mensagem_enviada?: string | null
          phone?: string
          status?: string
          user_id?: string | null
          wuzapi_response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "prospecao_optin_log_cadastro_id_fkey"
            columns: ["cadastro_id"]
            isOneToOne: false
            referencedRelation: "cadastros"
            referencedColumns: ["id"]
          },
        ]
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
      rate_limit_afiliado: {
        Row: {
          dia_atual: string | null
          hora_atual: string
          id: string
          minuto_atual: string
          motivo_pausa: string | null
          msgs_na_hora: number | null
          msgs_no_dia: number | null
          msgs_no_minuto: number | null
          pausado: boolean | null
          pausado_ate: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          dia_atual?: string | null
          hora_atual: string
          id?: string
          minuto_atual: string
          motivo_pausa?: string | null
          msgs_na_hora?: number | null
          msgs_no_dia?: number | null
          msgs_no_minuto?: number | null
          pausado?: boolean | null
          pausado_ate?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          dia_atual?: string | null
          hora_atual?: string
          id?: string
          minuto_atual?: string
          motivo_pausa?: string | null
          msgs_na_hora?: number | null
          msgs_no_dia?: number | null
          msgs_no_minuto?: number | null
          pausado?: boolean | null
          pausado_ate?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      seguidores_concorrentes: {
        Row: {
          bio: string | null
          cargo: string | null
          cidade_detectada: string | null
          contatado: boolean | null
          created_at: string | null
          empresa: string | null
          estado_detectado: string | null
          foto_url: string | null
          id: string
          imobiliaria_url: string | null
          instagram_url: string | null
          instagram_username: string
          linkedin_encontrado: boolean | null
          linkedin_url: string | null
          nome_completo: string | null
          qualificacao: string | null
          score_total: number | null
          seguidores: number | null
          seguindo_imobiliaria: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bio?: string | null
          cargo?: string | null
          cidade_detectada?: string | null
          contatado?: boolean | null
          created_at?: string | null
          empresa?: string | null
          estado_detectado?: string | null
          foto_url?: string | null
          id?: string
          imobiliaria_url?: string | null
          instagram_url?: string | null
          instagram_username: string
          linkedin_encontrado?: boolean | null
          linkedin_url?: string | null
          nome_completo?: string | null
          qualificacao?: string | null
          score_total?: number | null
          seguidores?: number | null
          seguindo_imobiliaria?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bio?: string | null
          cargo?: string | null
          cidade_detectada?: string | null
          contatado?: boolean | null
          created_at?: string | null
          empresa?: string | null
          estado_detectado?: string | null
          foto_url?: string | null
          id?: string
          imobiliaria_url?: string | null
          instagram_url?: string | null
          instagram_username?: string
          linkedin_encontrado?: boolean | null
          linkedin_url?: string | null
          nome_completo?: string | null
          qualificacao?: string | null
          score_total?: number | null
          seguidores?: number | null
          seguindo_imobiliaria?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sessoes_ativas: {
        Row: {
          ativa: boolean | null
          created_at: string | null
          dispositivo: string | null
          id: string
          tipo: string | null
          ultima_interacao: string | null
          updated_at: string | null
          whatsapp: string
        }
        Insert: {
          ativa?: boolean | null
          created_at?: string | null
          dispositivo?: string | null
          id?: string
          tipo?: string | null
          ultima_interacao?: string | null
          updated_at?: string | null
          whatsapp: string
        }
        Update: {
          ativa?: boolean | null
          created_at?: string | null
          dispositivo?: string | null
          id?: string
          tipo?: string | null
          ultima_interacao?: string | null
          updated_at?: string | null
          whatsapp?: string
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
      stock_integrations: {
        Row: {
          active: boolean | null
          api_key: string | null
          api_token: string | null
          api_url: string
          auth_type: string | null
          auto_sync: boolean | null
          created_at: string | null
          field_mapping: Json
          id: string
          integration_type: string
          last_error: string | null
          last_sync_at: string | null
          last_sync_status: string | null
          name: string
          products_synced: number | null
          sync_count: number | null
          sync_interval: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          api_key?: string | null
          api_token?: string | null
          api_url: string
          auth_type?: string | null
          auto_sync?: boolean | null
          created_at?: string | null
          field_mapping?: Json
          id?: string
          integration_type: string
          last_error?: string | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          name: string
          products_synced?: number | null
          sync_count?: number | null
          sync_interval?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          api_key?: string | null
          api_token?: string | null
          api_url?: string
          auth_type?: string | null
          auto_sync?: boolean | null
          created_at?: string | null
          field_mapping?: Json
          id?: string
          integration_type?: string
          last_error?: string | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          name?: string
          products_synced?: number | null
          sync_count?: number | null
          sync_interval?: number | null
          updated_at?: string | null
          user_id?: string
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
      tiktok_posts: {
        Row: {
          content_type: string
          content_url: string
          created_at: string
          id: string
          post_mode: string
          publish_id: string | null
          status: string
          tiktok_response: Json | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_type: string
          content_url: string
          created_at?: string
          id?: string
          post_mode?: string
          publish_id?: string | null
          status?: string
          tiktok_response?: Json | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_type?: string
          content_url?: string
          created_at?: string
          id?: string
          post_mode?: string
          publish_id?: string | null
          status?: string
          tiktok_response?: Json | null
          title?: string
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
      user_settings: {
        Row: {
          created_at: string
          id: string
          tiktok_default_post_mode: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tiktok_default_post_mode?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tiktok_default_post_mode?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_video_credits: {
        Row: {
          created_at: string | null
          credits_remaining: number | null
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          credits_remaining?: number | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          credits_remaining?: number | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
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
      vendedor_metas: {
        Row: {
          comissao_gerada: number | null
          created_at: string | null
          id: string
          mes: string
          meta_vendas: number | null
          percentual_atingido: number | null
          vendas_realizadas: number | null
          vendedor_id: string | null
        }
        Insert: {
          comissao_gerada?: number | null
          created_at?: string | null
          id?: string
          mes: string
          meta_vendas?: number | null
          percentual_atingido?: number | null
          vendas_realizadas?: number | null
          vendedor_id?: string | null
        }
        Update: {
          comissao_gerada?: number | null
          created_at?: string | null
          id?: string
          mes?: string
          meta_vendas?: number | null
          percentual_atingido?: number | null
          vendas_realizadas?: number | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendedor_metas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedores: {
        Row: {
          ativo: boolean | null
          comissao_percentual: number | null
          created_at: string | null
          email: string
          especialidade: string | null
          foto_url: string | null
          id: string
          login: string | null
          meta_mensal: number | null
          nome: string
          senha: string | null
          updated_at: string | null
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean | null
          comissao_percentual?: number | null
          created_at?: string | null
          email: string
          especialidade?: string | null
          foto_url?: string | null
          id?: string
          login?: string | null
          meta_mensal?: number | null
          nome: string
          senha?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean | null
          comissao_percentual?: number | null
          created_at?: string | null
          email?: string
          especialidade?: string | null
          foto_url?: string | null
          id?: string
          login?: string | null
          meta_mensal?: number | null
          nome?: string
          senha?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      videos: {
        Row: {
          created_at: string | null
          id: string
          legenda_facebook: string | null
          legenda_instagram: string | null
          legenda_tiktok: string | null
          legenda_whatsapp: string | null
          link_produto: string | null
          status: string | null
          thumbnail_url: string | null
          titulo: string | null
          updated_at: string | null
          user_id: string
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          legenda_facebook?: string | null
          legenda_instagram?: string | null
          legenda_tiktok?: string | null
          legenda_whatsapp?: string | null
          link_produto?: string | null
          status?: string | null
          thumbnail_url?: string | null
          titulo?: string | null
          updated_at?: string | null
          user_id: string
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          legenda_facebook?: string | null
          legenda_instagram?: string | null
          legenda_tiktok?: string | null
          legenda_whatsapp?: string | null
          link_produto?: string | null
          status?: string | null
          thumbnail_url?: string | null
          titulo?: string | null
          updated_at?: string | null
          user_id?: string
          video_url?: string | null
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
          to_number: string | null
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
          to_number?: string | null
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
          to_number?: string | null
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
          vendedor_id: string | null
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
          vendedor_id?: string | null
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
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campanhas_prospeccao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
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
      whatsapp_grupos_afiliado: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          created_at: string | null
          group_jid: string
          group_name: string
          id: string
          invite_link: string | null
          is_announce: boolean | null
          member_count: number | null
          previous_member_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          group_jid: string
          group_name: string
          id?: string
          invite_link?: string | null
          is_announce?: boolean | null
          member_count?: number | null
          previous_member_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          group_jid?: string
          group_name?: string
          id?: string
          invite_link?: string | null
          is_announce?: boolean | null
          member_count?: number | null
          previous_member_count?: number | null
          updated_at?: string | null
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
          wuzapi_message_id: string | null
        }
        Insert: {
          direction: string
          id?: string
          message?: string | null
          origem?: string | null
          phone: string
          timestamp?: string | null
          user_id?: string | null
          wuzapi_message_id?: string | null
        }
        Update: {
          direction?: string
          id?: string
          message?: string | null
          origem?: string | null
          phone?: string
          timestamp?: string | null
          user_id?: string | null
          wuzapi_message_id?: string | null
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
      wuzapi_instances: {
        Row: {
          assigned_to_user: string | null
          connected_at: string | null
          created_at: string | null
          id: string
          instance_name: string
          is_connected: boolean | null
          phone_number: string | null
          port: number
          updated_at: string | null
          wuzapi_token: string
          wuzapi_url: string
        }
        Insert: {
          assigned_to_user?: string | null
          connected_at?: string | null
          created_at?: string | null
          id?: string
          instance_name: string
          is_connected?: boolean | null
          phone_number?: string | null
          port: number
          updated_at?: string | null
          wuzapi_token: string
          wuzapi_url: string
        }
        Update: {
          assigned_to_user?: string | null
          connected_at?: string | null
          created_at?: string | null
          id?: string
          instance_name?: string
          is_connected?: boolean | null
          phone_number?: string | null
          port?: number
          updated_at?: string | null
          wuzapi_token?: string
          wuzapi_url?: string
        }
        Relationships: []
      }
      wuzapi_tokens_afiliados: {
        Row: {
          cliente_afiliado_id: string | null
          created_at: string | null
          em_uso: boolean | null
          id: string
          token: string
        }
        Insert: {
          cliente_afiliado_id?: string | null
          created_at?: string | null
          em_uso?: boolean | null
          id?: string
          token: string
        }
        Update: {
          cliente_afiliado_id?: string | null
          created_at?: string | null
          em_uso?: boolean | null
          id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "wuzapi_tokens_afiliados_cliente_afiliado_id_fkey"
            columns: ["cliente_afiliado_id"]
            isOneToOne: false
            referencedRelation: "clientes_afiliados"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adicionar_blacklist_afiliado: {
        Args: {
          p_created_by?: string
          p_motivo: string
          p_phone: string
          p_user_id?: string
        }
        Returns: undefined
      }
      auto_classificar_produto_afiliado: {
        Args: { p_categoria?: string; p_titulo: string }
        Returns: string
      }
      calcular_proximo_envio: {
        Args: { p_programacao_id: string }
        Returns: string
      }
      claim_prospeccao_pietro_batch: {
        Args: { p_limit?: number; p_lote: number; p_user_id: string }
        Returns: {
          created_at: string
          enviado_em: string | null
          erro: string | null
          id: string
          lead_id: string | null
          lote: number
          nome: string | null
          phone: string
          respondeu: boolean | null
          status: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "fila_prospeccao_pietro"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
      increment_afiliado_indicacoes: {
        Args: { afiliado_uuid: string }
        Returns: undefined
      }
      limpar_estados_antigos_afiliado: { Args: never; Returns: number }
      limpar_webhook_dedup_antigos: { Args: never; Returns: number }
      pegar_proximo_fila_afiliado: {
        Args: { p_limit?: number; p_user_id?: string }
        Returns: {
          conversa_id: string | null
          created_at: string | null
          erro: string | null
          id: string
          imagem_url: string | null
          instance_name: string | null
          lead_name: string | null
          lead_phone: string
          max_tentativas: number | null
          mensagem_recebida: string
          metadata: Json | null
          origem: string | null
          prioridade: number | null
          processing_started_at: string | null
          resposta_ia: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          tentativas: number | null
          tipo_mensagem: string | null
          user_id: string | null
          wuzapi_token: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "fila_atendimento_afiliado"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      pegar_proximo_produto_programacao: {
        Args: { p_programacao_id: string }
        Returns: {
          categoria: string | null
          created_at: string | null
          descricao: string | null
          id: string
          imagem_url: string | null
          link_afiliado: string
          marketplace: string
          preco: number | null
          status: string | null
          titulo: string
          updated_at: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "afiliado_produtos"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      process_scheduled_campaigns: { Args: never; Returns: undefined }
      unaccent: { Args: { "": string }; Returns: string }
      verificar_blacklist_afiliado: {
        Args: { p_phone: string }
        Returns: boolean
      }
      verificar_rate_limit_afiliado: {
        Args: { p_phone: string }
        Returns: number
      }
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
