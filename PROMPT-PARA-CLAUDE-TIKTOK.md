# PROMPT PARA CLAUDE — REVIEW TIKTOK DEVELOPERS

## 🎯 OBJETIVO

Nosso app no TikTok Developers foi reprovado com a mensagem:

> **"Your externally facing website must be fully developed and cannot be a landing or login page."**

Já preparamos o site público, mas preciso da sua ajuda para reenviar o app corretamente no portal `developers.tiktok.com` e entender como criar/login de teste para o review.

**NÃO ALTERE NENHUM ARQUIVO DO PROJETO.** Só me oriente no que fazer no portal do TikTok.

---

## 📋 INFORMAÇÕES DO APP

| Item | Valor |
|------|-------|
| Ambiente atual | **SANDBOX** (até o review ser aprovado) |
| Client key (sandbox) | `sbawx08s3trep7gfvg` |
| Client key (produção) | `aw2ouo90dyp4ju9w` |
| Redirect URI | `https://amzofertas.com.br/tiktok/callback` |
| Arquivo de verificação de domínio | `https://amzofertas.com.br/tiktok9jcxiIacSETQGRXH9A4w7VHc7CwD7iPK.txt` |
| Scopes solicitados | `user.info.basic`, `user.info.profile`, `video.upload`, `video.publish` |
| URL pública do callback no app | `https://amzofertas.com.br/tiktok/callback` |

---

## 🏗️ ARQUITETURA DO PROJETO (para você entender o fluxo)

- **`src/config/tiktok.ts`** — ponto único de configuração com switch `sandbox` / `producao`.
- **`src/pages/TikTokCallback.tsx`** — página que recebe o `code` e o `state` do OAuth TikTok.
- **`supabase/functions/tiktok-auth-callback`** — troca o `code` por `access_token` e salva na tabela `integrations`.
- **`supabase/functions/tiktok-post-content`** — publica vídeos no TikTok (modo Direct Post ou rascunho/inbox).
- **`public/tiktok*.txt`** — arquivo de verificação de domínio.

Regras importantes:
- Tokens obtidos em sandbox **NÃO** valem em produção e vice-versa.
- Enquanto o app não for auditado, só é possível publicar como `SELF_ONLY` (privado/rascunho) para contas de teste.
- A troca de ambiente é feita pelo secret `TIKTOK_ENV` (sandbox | producao) no backend e por `VITE_TIKTOK_ENV` no frontend.

---

## ✅ CHECKLIST PARA RESOLVER COMIGO HOJE

1. **Site público**
   - Verificar se `https://amzofertas.com.br` está acessível e completo.
   - Confirmar que não é apenas landing page ou página de login.
   - Validar que Termos de Uso e Política de Privacidade estão publicados e linkados.

2. **Redirect URI**
   - Confirmar que `https://amzofertas.com.br/tiktok/callback` está cadastrada **EXATAMENTE** igual nos dois apps (sandbox e produção).
   - Atenção: **sem barra final**.

3. **Verificação de domínio**
   - Confirmar que o arquivo `tiktok9jcxiIacSETQGRXH9A4w7VHc7CwD7iPK.txt` está acessível em `https://amzofertas.com.br/tiktok9jcxiIacSETQGRXH9A4w7VHc7CwD7iPK.txt`.
   - Confirmar que o domínio está verificado nos dois apps (sandbox e produção).

4. **Contas de teste (Target Users)**
   - Me explicar onde no TikTok Developers adiciono as contas de teste.
   - Qual login/senha devo usar para criar essas contas?
   - Quantas contas de teste são necessárias para o review?

5. **Login e senha de teste para o review**
   - Como gerar as credenciais de teste que o TikTok pede na submissão.
   - Se precisar criar uma conta TikTok de teste, me passe o passo a passo.

6. **Formulário de submissão do review**
   - Revisar comigo cada campo do formulário de submissão no TikTok Developers.
   - Me dizer o que preencher em cada campo de acordo com nosso app.

7. **Vídeo de demonstração / screenshots**
   - Verificar se o TikTok exige vídeo demonstrando o fluxo de OAuth/publicação.
   - Se exigir, me orientar no que gravar.

---

## 🚫 O QUE NÃO PODE ACONTECER

- Não exponha `client_secret` nem nenhuma chave privada no chat.
- Não peça para eu enviar senhas reais de contas do TikTok.
- Não altere código do projeto.

---

## 💬 RESPOSTA ESPERADA

Me responda em português, passo a passo, começando pelo item mais urgente: **como criar/adicionar as contas de teste (Target Users) e qual login/senha usar no review do TikTok Developers.**
