# 💻 Como Abrir e Usar o PowerShell

## 🎯 O Que É PowerShell?

PowerShell é o **terminal do Windows** - uma janela preta onde você digita comandos.

É como o "Prompt de Comando" (CMD), mas mais moderno.

---

## ✅ Como Abrir o PowerShell

### Método 1: Pela Pasta do Projeto (MAIS FÁCIL!)

1. Abra o **Explorador de Arquivos** (Windows + E)
2. Navegue até a pasta: `C:\Users\usuario\hello-buddy-launchpad`
3. Clique com o **botão direito** na pasta
4. Selecione **"Abrir no Terminal"** ou **"Abrir no PowerShell"**
5. Uma janela preta vai abrir!

### Método 2: Pelo Menu Iniciar

1. Pressione a tecla **Windows** (tecla com o símbolo do Windows)
2. Digite: **PowerShell**
3. Clique em **"Windows PowerShell"** ou **"PowerShell"**
4. Depois, digite:
   ```
   cd C:\Users\usuario\hello-buddy-launchpad
   ```
5. Pressione **Enter**

### Método 3: Pelo Cursor/VS Code

1. No Cursor, pressione **Ctrl + `** (Ctrl + crase)
2. Ou vá em **Terminal** → **New Terminal**
3. O terminal vai abrir na pasta do projeto!

---

## 🎯 O Que Você Vai Ver

Uma janela preta com algo assim:

```
PS C:\Users\usuario\hello-buddy-launchpad>
```

O `PS` significa PowerShell, e o caminho mostra onde você está.

---

## 📝 Como Usar

1. **Digite o comando** (exemplo: `npm install`)
2. Pressione **Enter**
3. Aguarde o comando executar
4. Quando terminar, você pode digitar o próximo comando

---

## 🚀 Comandos que Você Vai Usar

### Para o Rebuild Limpo:

```powershell
# 1. Limpar tudo
Remove-Item -Recurse -Force node_modules, .vercel, dist -ErrorAction SilentlyContinue

# 2. Instalar dependências
npm install

# 3. Fazer build
npm run build
```

**OU use o script que criei:**

```powershell
.\rebuild-limpo.ps1
```

---

## ⚠️ Se Der Erro de Permissão

Se aparecer erro de "execução de scripts desabilitada":

1. No PowerShell, digite:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
2. Pressione **Enter**
3. Digite **S** (Sim) e pressione **Enter**
4. Tente novamente

---

## 💡 Dica

**O Cursor já tem terminal integrado!** É mais fácil usar o terminal do Cursor (Ctrl + `) do que abrir o PowerShell separado.

---

**Tente abrir o terminal no Cursor primeiro! É mais fácil!** 🚀
