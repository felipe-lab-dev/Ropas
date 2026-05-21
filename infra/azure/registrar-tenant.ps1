# Registra un tenant nuevo en la infraestructura ROPAS de Azure.
# Patron de URLs (igual a Velarde-Centro-Odontologico):
#   - Frontend: https://<tenant>.tienda.enkihubs.com           -> swa-ropas
#   - Backend:  https://api.<tenant>.tienda.enkihubs.com       -> ca-backend-ropas
#
# El DNS (Squarespace) hay que actualizarlo manualmente con los registros
# que este script imprime al final. Despues de propagar (15-60 min), correr
# el script de nuevo con -Verificar para activar el binding TLS.
#
# Uso:
#   .\registrar-tenant.ps1 -Tenant loremstore
#   .\registrar-tenant.ps1 -Tenant loremstore -Verificar

[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Tenant,
  [switch]$Verificar,
  [string]$ResourceGroup = "rg-ropas",
  [string]$Subscription = "599b47be-0430-4dc8-997d-5526ebbfb1e6",
  [string]$SwaName = "swa-ropas",
  [string]$AcaName = "ca-backend-ropas",
  [string]$DominioBase = "tienda.enkihubs.com"
)

$ErrorActionPreference = "Stop"
$env:PYTHONIOENCODING = "utf-8"

$Tenant = $Tenant.ToLower()
if ($Tenant -notmatch '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$') {
  throw "Tenant invalido: solo a-z, 0-9 y guiones, longitud 3-32."
}

$hostFront = "$Tenant.$DominioBase"
$hostApi   = "api.$Tenant.$DominioBase"

az account set --subscription $Subscription | Out-Null
$swaHostname = az staticwebapp show -g $ResourceGroup -n $SwaName --query defaultHostname -o tsv
$acaFqdn     = az containerapp show  -g $ResourceGroup -n $AcaName --query "properties.configuration.ingress.fqdn" -o tsv
$acaVerifId  = az containerapp show  -g $ResourceGroup -n $AcaName --query "properties.customDomainVerificationId" -o tsv

if (-not $Verificar) {
  Write-Host ""
  Write-Host "=== Paso 1: agrega estos registros en Squarespace DNS de enkihubs.com ===" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "  Tipo    Host                                   Valor"
  Write-Host "  -----   ------------------------------------   --------------------------------------------------"
  Write-Host "  CNAME   $Tenant.tienda                        $swaHostname"
  Write-Host "  CNAME   api.$Tenant.tienda                    $acaFqdn"
  Write-Host "  TXT     asuid.api.$Tenant.tienda              $acaVerifId"
  Write-Host ""
  Write-Host "Espera 15-60 min para que propague (verifica con: nslookup $hostFront)."
  Write-Host "Luego vuelve a correr: .\registrar-tenant.ps1 -Tenant $Tenant -Verificar"
  Write-Host ""
  exit 0
}

Write-Host "=== Bindeando dominios y emitiendo certificados (managed) ===" -ForegroundColor Cyan

# SWA - frontend del tenant
Write-Host "1. SWA: $hostFront" -ForegroundColor Yellow
az staticwebapp hostname set -g $ResourceGroup -n $SwaName --hostname $hostFront

# ACA - backend del tenant (managed cert)
Write-Host "2. ACA: $hostApi" -ForegroundColor Yellow
az containerapp hostname add -g $ResourceGroup -n $AcaName --hostname $hostApi
az containerapp hostname bind -g $ResourceGroup -n $AcaName --hostname $hostApi --environment cae-ropas --validation-method CNAME

Write-Host ""
Write-Host "Listo. Frontend: https://$hostFront" -ForegroundColor Green
Write-Host "       API:      https://$hostApi" -ForegroundColor Green
