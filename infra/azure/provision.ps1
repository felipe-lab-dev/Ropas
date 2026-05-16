# Provisiona los recursos Azure mínimos para Ropas en brazilsouth.
#
# Recursos creados:
#   - Resource Group           rg-ropas-prod
#   - PostgreSQL Flexible      psql-ropas-prod-brs (Burstable B1ms, ~$12-15 USD/mes)
#   - Database                 ropas
#
# Pre-requisitos: az login + az account set --subscription "DIH_ERP"
#
# Uso (PowerShell):
#   .\infra\azure\provision.ps1 -AdminPassword "<password seguro>"

param(
    [string]$ResourceGroup = "rg-ropas-prod",
    [string]$Location = "brazilsouth",
    [string]$ServerName = "psql-ropas-prod-brs",
    [string]$DatabaseName = "ropas",
    [string]$AdminUser = "ropas_admin",
    [Parameter(Mandatory = $true)][string]$AdminPassword,
    [string]$Sku = "Standard_B1ms",
    [string]$Tier = "Burstable",
    [string]$Version = "16"
)

$ErrorActionPreference = "Stop"

Write-Host "▶ Verificando subscription activa…" -ForegroundColor Cyan
az account show --query "{name:name, id:id}" -o table

Write-Host "▶ Creando Resource Group $ResourceGroup en $Location…" -ForegroundColor Cyan
az group create --name $ResourceGroup --location $Location --tags proyecto=ropas entorno=prod | Out-Null

Write-Host "▶ Creando PostgreSQL Flexible Server $ServerName ($Sku)…" -ForegroundColor Cyan
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
    --tags proyecto=ropas entorno=prod | Out-Null

Write-Host "▶ Creando base de datos $DatabaseName…" -ForegroundColor Cyan
az postgres flexible-server db create `
    --resource-group $ResourceGroup `
    --server-name $ServerName `
    --database-name $DatabaseName | Out-Null

# Habilitar uuid-ossp/pgcrypto si se necesitan
Write-Host "▶ Habilitando extensiones (pgcrypto, uuid-ossp)…" -ForegroundColor Cyan
az postgres flexible-server parameter set `
    --resource-group $ResourceGroup `
    --server-name $ServerName `
    --name azure.extensions `
    --value "PGCRYPTO,UUID-OSSP" | Out-Null

$fqdn = az postgres flexible-server show `
    --resource-group $ResourceGroup `
    --name $ServerName `
    --query "fullyQualifiedDomainName" -o tsv

$connString = "postgresql://${AdminUser}:${AdminPassword}@${fqdn}:5432/${DatabaseName}?sslmode=require&schema=public"

Write-Host ""
Write-Host "✅ Recursos provisionados" -ForegroundColor Green
Write-Host ""
Write-Host "Connection string (copiá a backend/.env como DATABASE_URL):" -ForegroundColor Yellow
Write-Host $connString
Write-Host ""
Write-Host "Recordá:" -ForegroundColor Yellow
Write-Host "  • Agregar tu IP al firewall:"
Write-Host "    az postgres flexible-server firewall-rule create -g $ResourceGroup -n $ServerName -r dev --start-ip-address <tu-ip> --end-ip-address <tu-ip>"
Write-Host "  • Correr migrations: pnpm --dir backend prisma migrate deploy"
Write-Host "  • Crear primer tenant: pnpm --dir backend tenant:crear -- --code mi-tienda --nombre 'Mi Tienda'"
