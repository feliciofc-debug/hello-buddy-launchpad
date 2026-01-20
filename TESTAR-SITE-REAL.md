# 🌐 TESTAR NO SITE REAL (PRODUÇÃO)

## ✅ O QUE FOI FEITO

1. ✅ Código atualizado com URL correta hardcoded
2. ✅ Código commitado e enviado para o Git
3. ⏳ **AGUARDANDO:** Vercel fazer deploy automático

---

## 🧪 TESTAR NO SITE REAL

### PASSO 1: Verificar Deploy no Vercel

1. Acesse: https://vercel.com
2. Vá no seu projeto
3. Vá em **"Deployments"**
4. Verifique se o **último deploy** está:
   - ✅ **"Ready"** (verde) = Pronto para testar
   - ⏳ **"Building"** = Aguardar terminar
   - ❌ **"Error"** = Tem erro, precisa ver

---

### PASSO 2: Testar no Site Real

1. Abra: **https://amzofertas.com.br**
2. **LIMPE O CACHE:**
   - Pressione **Ctrl + Shift + Delete**
   - Marque **"Imagens e arquivos em cache"**
   - Período: **"Todo o período"**
   - Clique em **"Limpar dados"**
3. **Feche e reabra o navegador**
4. Abra: **https://amzofertas.com.br** novamente
5. Pressione **F12** (abrir Console)
6. Vá na aba **Console**
7. Procure por:
   ```
   🔧 [SUPABASE CLIENT] Inicializando com URL: https://zunuqaidxffuhwmvcwul.supabase.co
   ✅ [SUPABASE CLIENT] Cliente criado
   📍 [SUPABASE CLIENT] URL atual: https://zunuqaidxffuhwmvcwul.supabase.co
   ```

---

### PASSO 3: Testar Criar Instância WhatsApp

1. Faça login no site (com sua conta real)
2. Vá para: **/afiliado/conectar-celular**
3. Clique em **"Criar Instância"**
4. Abra o Console (F12) → aba **Network**
5. Procure pela requisição:
   - Deve ser: `https://zunuqaidxffuhwmvcwul.supabase.co/functions/v1/criar-instancia-wuzapi-afiliado`
   - **NÃO** deve ser: `qbtqjrcfseqcfmcqlngr` ou `gbtqjrcfseqcfmcqlngr`

---

## 🔍 O QUE VERIFICAR

### ✅ Se estiver CORRETO:
- Console mostra URL: `zunuqaidxffuhwmvcwul`
- Requisição vai para: `zunuqaidxffuhwmvcwul.supabase.co`
- Criar instância funciona

### ❌ Se estiver ERRADO:
- Console mostra URL antiga: `qbtqjrcfseqcfmcqlngr`
- Requisição vai para URL antiga
- Erro 500 ou 403

---

## 📋 ME ENVIE

1. **Status do deploy no Vercel** (Ready/Building/Error)
2. **O que aparece no Console** quando abre o site
3. **A URL da requisição** quando clica em "Criar Instância" (aba Network)
4. **Se funcionou ou deu erro**

---

**Vamos testar no site REAL agora! Me diga o que acontece.**
