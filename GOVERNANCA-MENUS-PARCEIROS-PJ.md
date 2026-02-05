# 🔒 GOVERNANÇA: CONFIGURAÇÃO DE MENUS PARCEIROS PJ

## ⚠️ CONFIGURAÇÃO PROTEGIDA - NÃO ALTERAR SEM AUTORIZAÇÃO

### Parceiros Ativos
| Email | Tipo Perfil | Status |
|-------|-------------|--------|
| `rfreitas@teste.com.br` | parceiro | ✅ PROTEGIDO |
| `peixoto@teste.com.br` | parceiro_peixotinho | ✅ PROTEGIDO |
| `carolribeiro@barraworld.com` | barra_world | ✅ PROTEGIDO |

### Menus Permitidos (EXATAMENTE 5 - NÃO ADICIONAR MAIS)
```
1. dashboard
2. produtos
3. whatsapp
4. automacao-grupos
5. ia-marketing
```

### Tabela de Configuração
```sql
-- client_menu_config (NÃO ALTERAR)
tipo_cliente: parceiro         → menus: [dashboard, produtos, whatsapp, automacao-grupos, ia-marketing]
tipo_cliente: parceiro_peixotinho → menus: [dashboard, produtos, whatsapp, automacao-grupos, ia-marketing]
tipo_cliente: barra_world      → menus: [dashboard, produtos, whatsapp, automacao-grupos, ia-marketing]
```

## 🚫 PROIBIDO SEM AUTORIZAÇÃO

1. ❌ Adicionar novos menus aos perfis de parceiros
2. ❌ Remover menus existentes
3. ❌ Alterar tipo de perfil dos usuários listados
4. ❌ Criar novos tipos de cliente sem seguir este padrão
5. ❌ Modificar a tabela `client_menu_config` para estes tipos

## ✅ FRASE DE CONFIRMAÇÃO OBRIGATÓRIA

Para qualquer alteração na estrutura de menus de parceiros:

```
"CONFIRMO ALTERAÇÃO NA ESTRUTURA DE MENUS PARCEIROS PJ"
```

## 📋 Regra para Novos Clientes

**TODO CLIENTE NOVO do tipo parceiro/PJ deve ter APENAS esses 5 menus:**
- dashboard
- produtos  
- whatsapp
- automacao-grupos
- ia-marketing

**Menus premium (Google Ads, Analytics, Vendedores, etc.) são reservados para upgrade futuro.**

## 🔍 Como Verificar

```sql
SELECT tipo_cliente, menus_permitidos 
FROM client_menu_config 
WHERE tipo_cliente IN ('parceiro', 'parceiro_peixotinho', 'barra_world');
```

Deve retornar EXATAMENTE 5 menus para cada tipo.

---
**Última atualização**: 2025-02-05
**Status**: ✅ CONFIGURAÇÃO ESTÁVEL - NÃO MEXER
