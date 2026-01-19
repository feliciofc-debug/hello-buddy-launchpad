# Script para Rebuild Limpo (Sugestão do Kimi)
# Execute este script no PowerShell

Write-Host "🧹 Limpando tudo..." -ForegroundColor Yellow

# Remove node_modules, .vercel, dist
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force "node_modules"
    Write-Host "✅ node_modules removido" -ForegroundColor Green
}

if (Test-Path ".vercel") {
    Remove-Item -Recurse -Force ".vercel"
    Write-Host "✅ .vercel removido" -ForegroundColor Green
}

if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "✅ dist removido" -ForegroundColor Green
}

Write-Host "📦 Instalando dependências..." -ForegroundColor Yellow
npm install

Write-Host "🔨 Fazendo build..." -ForegroundColor Yellow
npm run build

Write-Host "✅ Rebuild limpo concluído!" -ForegroundColor Green
Write-Host "🚀 Agora faça o deploy no Vercel (ou use: npx vercel --prod -f)" -ForegroundColor Cyan
