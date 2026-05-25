$ErrorActionPreference = "Stop"
$logPath = "$env:TEMP\ropas-pg-reset.log"
function Log($msg) { $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $msg; Add-Content -Path $logPath -Value $line -Encoding utf8; Write-Output $line }

try {
    Set-Content -Path $logPath -Value "" -Encoding utf8
    Log "Inicio reset Postgres local"

    $pgVersion = "16"
    $pgDataDir = "C:\Program Files\PostgreSQL\$pgVersion\data"
    $hba = Join-Path $pgDataDir "pg_hba.conf"
    $psql = "C:\Program Files\PostgreSQL\$pgVersion\bin\psql.exe"
    $serviceName = "postgresql-x64-$pgVersion"
    $backup = Join-Path $pgDataDir "pg_hba.conf.bak-ropas-reset"
    $newPass = "ropas_dev_2026"

    if (-not (Test-Path $hba)) { throw "No existe $hba" }
    if (-not (Test-Path $psql)) { throw "No existe $psql" }

    Log "Backup de pg_hba.conf -> $backup"
    Copy-Item $hba $backup -Force

    Log "Reemplazando auth local por trust temporalmente"
    $trustContent = @"
# TEMPORAL: ropas reset - restaurado luego automaticamente
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
local   replication     all                                     trust
host    replication     all             127.0.0.1/32            trust
host    replication     all             ::1/128                 trust
"@
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($hba, $trustContent, $utf8NoBom)

    Log "Recargando servicio $serviceName"
    Restart-Service -Name $serviceName -Force
    Start-Sleep -Seconds 2

    Log "Verificando/creando rol ropas_admin con password nuevo"
    $sqlRole = @"
DO `$`$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ropas_admin') THEN
      CREATE ROLE ropas_admin WITH LOGIN PASSWORD 'PLACEHOLDER_PASS' CREATEDB;
   ELSE
      ALTER ROLE ropas_admin WITH LOGIN PASSWORD 'PLACEHOLDER_PASS' CREATEDB;
   END IF;
END
`$`$;
"@
    $sqlRole = $sqlRole.Replace('PLACEHOLDER_PASS', $newPass)
    $tmpSql = "$env:TEMP\ropas-role.sql"
    Set-Content -Path $tmpSql -Value $sqlRole -Encoding utf8
    & $psql -U postgres -d postgres -f $tmpSql
    if ($LASTEXITCODE -ne 0) { throw "psql fallo creando/alterando rol (exit $LASTEXITCODE)" }
    Remove-Item $tmpSql -Force

    Log "Verificando existencia de DB 'ropas'"
    $dbExists = & $psql -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='ropas'"
    if ($dbExists -ne "1") {
        Log "Creando DB ropas owned by ropas_admin"
        & $psql -U postgres -d postgres -c "CREATE DATABASE ropas OWNER ropas_admin"
        if ($LASTEXITCODE -ne 0) { throw "psql fallo creando DB ropas (exit $LASTEXITCODE)" }
    } else {
        Log "DB ropas ya existe"
        & $psql -U postgres -d postgres -c "ALTER DATABASE ropas OWNER TO ropas_admin"
    }

    Log "Restaurando pg_hba.conf original"
    Copy-Item $backup $hba -Force

    Log "Recargando servicio $serviceName final"
    Restart-Service -Name $serviceName -Force
    Start-Sleep -Seconds 2

    Log "OK - password de ropas_admin = $newPass | DB ropas lista"
    exit 0
} catch {
    Log "ERROR: $_"
    if ((Test-Path $backup) -and (Test-Path $hba)) {
        Log "Intentando restaurar pg_hba.conf desde backup tras error"
        Copy-Item $backup $hba -Force
        try { Restart-Service -Name $serviceName -Force } catch { Log "No se pudo reiniciar servicio: $_" }
    }
    exit 1
}
