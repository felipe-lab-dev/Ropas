# Provisiona los recursos Azure minimos para Ropas en East US 2.
#
# Recursos creados:
#   - Resource Group           rg-ropas-prod
#   - PostgreSQL Flexible      psql-ropas-prod-eus2 (Burstable B1ms, ~$15 USD/mes)
#   - Database                 ropas
#
# Region: eastus2 (eastus esta restringida para Postgres Flexible en esta subscription).
#
# Pre-requisitos: az login + az account set --subscription "DIH_ERP"
#
# Uso (PowerShell):
#   .\infra\azure\provision.ps1 -AdminPassword "<password seguro>"

param(
    [string]$ResourceGroup = "rg-ropas-prod",
    [string]$Location = "eastus2",
    [string]$ServerName = "psql-ropas-prod-eus2",
    [string]$DatabaseName = "ropas",
    [string]$AdminUser = "ropas_admin",
    [Parameter(Mandatory = $true)][string]$AdminPassword,
    [string]$Sku = "Standard_B1ms",
    [string]$Tier = "Burstable",
    [string]$Version = "16"
)

$ErrorActionPreference = "Stop"

Write-Host "Verificando subscription activa..." -ForegroundColor Cyan
az account show --query "{name:name, id:id}" -o table

Write-Host "Creando Resource Group $ResourceGroup en $Location..." -ForegroundColor Cyan
az group create --name $ResourceGroup --location $Location --tags proyecto=ropas entorno=prod | Out-Null

Write-Host "Creando PostgreSQL Flexible Server $ServerName ($Sku)..." -ForegroundColor Cyan
az postgres flexible-server create `
    --resource-group $ResourceGroup `
    --name $ServerName `
    --location $Location `
    --admin-user $AdminUser `
    --admin-password $AdminPassword `
    --sku-name $Sku `
    --tier $Tier `
    --storage-size 32 `
    --version $Version `
    --public-access 0.0.0.0 `
    --tags proyecto=ropas entorno=prod `
    --yes | Out-Null

Write-Host "Creando base de datos $DatabaseName..." -ForegroundColor Cyan
az postgres flexible-server db create `
    --resource-group $ResourceGroup `
    --server-name $ServerName `
    --database-name $DatabaseName | Out-Null

$fqdn = az postgres flexible-server show `
    --resource-group $ResourceGroup `
    --name $ServerName `
    --query "fullyQualifiedDomainName" -o tsv

$connString = "postgresql://${AdminUser}:${AdminPassword}@${fqdn}:5432/${DatabaseName}?sslmode=require&schema=public"

Write-Host ""
Write-Host "Recursos provisionados" -ForegroundColor Green
Write-Host ""
Write-Host "Connection string (copiar a backend/.env como DATABASE_URL):" -ForegroundColor Yellow
Write-Host $connString
Write-Host ""
Write-Host "Recordar:" -ForegroundColor Yellow
Write-Host "  - Agregar tu IP al firewall:"
Write-Host "    az postgres flexible-server firewall-rule create -g $ResourceGroup -n $ServerName -r dev --start-ip-address <tu-ip> --end-ip-address <tu-ip>"
Write-Host "  - Aplicar schema: pnpm --dir backend prisma db push"
Write-Host "  - Crear primer tenant: pnpm --dir backend tenant:crear -- --code mi-tienda --nombre 'Mi Tienda'"
Write-Host ""
Write-Host "Nota sobre pgcrypto:" -ForegroundColor Yellow
Write-Host "  Azure bloquea pgcrypto por allow-list. gen_random_uuid() ya es nativa en PG 13+, asi que el script crear-tenant.ts no la necesita."
Write-Host "  Si una migracion futura la requiere: az postgres flexible-server parameter set -g $ResourceGroup --server-name $ServerName --name azure.extensions --value PGCRYPTO,UUID-OSSP"
