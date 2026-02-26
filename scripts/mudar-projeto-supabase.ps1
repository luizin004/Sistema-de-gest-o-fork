# Script PowerShell para mudar de projeto Supabase
# De: wtqhpovjntjbjhobqttk (atual)
# Para: wjsbyahzwdupsmopygkg (MCP)

Write-Host "🔄 Mudando projeto Supabase..." -ForegroundColor Cyan

# Novo projeto MCP
$NOVO_PROJETO_ID = "wjsbyahzwdupsmopygkg"
$NOVA_URL = "https://wjsbyahzwdupsmopygkg.supabase.co"
$NOVA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indqc2J5YWh6d2R1cHNtb3B5Z2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNTA4NDEsImV4cCI6MjA3ODcyNjg0MX0.KwiuX5W-7my-D8ezsy2Xg181FPhGHf3bIN0JywQz0Ts"

# Atualizar .env.production
if (Test-Path ".env.production") {
    (Get-Content ".env.production") | ForEach-Object {
        $_ -replace 'wtqhpovjntjbjhobqttk', $NOVO_PROJETO_ID `
           -replace 'https://wtqhpovjntjbjhobqttk.supabase.co', $NOVA_URL `
           -replace 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.*KwiuX5W-7my-D8ezsy2Xg181FPhGHf3bIN0JywQz0Ts', $NOVA_KEY
    } | Set-Content ".env.production"
    Write-Host "✅ .env.production atualizado" -ForegroundColor Green
}

# Atualizar src/integrations/supabase/client.ts
if (Test-Path "src/integrations/supabase/client.ts") {
    (Get-Content "src/integrations/supabase/client.ts") | ForEach-Object {
        $_ -replace 'https://wtqhpovjntjbjhobqttk.supabase.co', $NOVA_URL `
           -replace 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.*KwiuX5W-7my-D8ezsy2Xg181FPhGHf3bIN0JywQz0Ts', $NOVA_KEY
    } | Set-Content "src/integrations/supabase/client.ts"
    Write-Host "✅ client.ts atualizado" -ForegroundColor Green
}

# Atualizar todos os arquivos .ts/.tsx com URLs hardcoded
Get-ChildItem -Path "src" -Include "*.ts","*.tsx" -Recurse | ForEach-Object {
    $content = Get-Content $_.FullName
    $newContent = $content -replace 'https://wtqhpovjntjbjhobqttk.supabase.co', $NOVA_URL
    if ($content -ne $newContent) {
        Set-Content $_.FullName $newContent
        Write-Host "✅ $($_.Name) atualizado" -ForegroundColor Green
    }
}

Write-Host "`n✅ Projeto atualizado para: $NOVO_PROJETO_ID" -ForegroundColor Green
Write-Host "🌐 Nova URL: $NOVA_URL" -ForegroundColor Green
Write-Host "`n⚠️  ATENÇÃO: Você precisa:" -ForegroundColor Yellow
Write-Host "1. Copiar as Edge Functions do projeto antigo para o novo" -ForegroundColor Yellow
Write-Host "2. Migrar as tabelas (campanhas, tabela_campanha, posts)" -ForegroundColor Yellow
Write-Host "3. Atualizar as variáveis de ambiente no Supabase Dashboard" -ForegroundColor Yellow
Write-Host "4. Testar todas as funcionalidades" -ForegroundColor Yellow
