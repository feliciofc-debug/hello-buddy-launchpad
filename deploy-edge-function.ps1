# Script PowerShell para fazer deploy da Edge Function no Supabase
# Requer: Access Token do Supabase

param(
    [Parameter(Mandatory=$true)]
    [string]$AccessToken,
    
    [Parameter(Mandatory=$false)]
    [string]$ProjectRef = "jibpvpqgplmahjhswiza",
    
    [Parameter(Mandatory=$false)]
    [string]$FunctionName = "criar-instancia-wuzapi-afiliado"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Iniciando deploy da Edge Function..." -ForegroundColor Cyan

# Caminho do arquivo da função
$functionPath = Join-Path $PSScriptRoot "supabase\functions\$FunctionName\index.ts"

if (-not (Test-Path $functionPath)) {
    Write-Host "❌ Arquivo não encontrado: $functionPath" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Lendo arquivo da função..." -ForegroundColor Yellow
$functionCode = Get-Content $functionPath -Raw -Encoding UTF8

# URL da API do Supabase
$apiUrl = "https://api.supabase.com/v1/projects/$ProjectRef/functions/$FunctionName"

Write-Host "📤 Enviando código para o Supabase..." -ForegroundColor Yellow

try {
    $headers = @{
        "Authorization" = "Bearer $AccessToken"
        "Content-Type" = "application/json"
    }
    
    $body = @{
        body = $functionCode
    } | ConvertTo-Json -Depth 10
    
    $response = Invoke-RestMethod -Uri $apiUrl -Method PUT -Headers $headers -Body $body
    
    Write-Host "✅ Deploy realizado com sucesso!" -ForegroundColor Green
    Write-Host "🔗 Função disponível em: https://$ProjectRef.supabase.co/functions/v1/$FunctionName" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Erro ao fazer deploy:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Resposta do servidor: $responseBody" -ForegroundColor Red
    }
    
    exit 1
}

Write-Host "`n✨ Pronto! Teste no site: https://amzofertas.com.br/afiliado/conectar-celular" -ForegroundColor Green
