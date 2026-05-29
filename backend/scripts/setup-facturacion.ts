/**
 * Setup facturación electrónica de un tenant existente.
 *
 * Configura en una sola pasada:
 *   1. ConfiguracionFacturacion (singleton) — token Mifact cifrado, RUC, razón social, etc.
 *   2. SerieCpe factura (F001 por defecto)
 *   3. SerieCpe boleta  (B001 por defecto)
 *
 * Uso típico (demo Mifact):
 *   pnpm setup:facturacion \
 *     --tenant mi-tienda \
 *     --ruc 20100100100 \
 *     --razon-social "Empresa Demo SAC" \
 *     --direccion-fiscal "Av. Demo 123, Lima" \
 *     --ubigeo 150101 \
 *     --mifact-token "gN8zNRBV+/FVxTLwdaZx0w=="
 *
 * Pre-requisito: tener FACTURACION_MASTER_KEY en .env.
 *   pnpm facturacion:master-key   # genera una nueva si no tienes
 *
 * Flags opcionales:
 *   --nombre-comercial "Empresa Demo"
 *   --mifact-base-url https://mifact.net.pe/xmifactapi   (default: demo, equivalente a https://demo.mifact.net.pe/api)
 *   --serie-factura F002
 *   --serie-boleta B002
 *   --dry-run    (muestra qué haría sin tocar la DB)
 */

import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cifrar, descifrar } from '../src/core/cifrado/cifrado';
import { ubigeoExiste, obtenerUbigeo } from '../src/core/sunat/ubigeos';

// ─── carga .env ───────────────────────────────────────────────────────────────
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  for (const linea of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*?)"?\s*$/);
    if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2] ?? '';
  }
}

// ─── parser manual de args ────────────────────────────────────────────────────
function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  const val = process.argv[idx + 1];
  return val && !val.startsWith('--') ? val : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

// ─── args ─────────────────────────────────────────────────────────────────────
const args = {
  tenant:              getArg('--tenant'),
  ruc:                 getArg('--ruc'),
  razonSocial:         getArg('--razon-social'),
  direccionFiscal:     getArg('--direccion-fiscal'),
  ubigeo:              getArg('--ubigeo'),
  mifactToken:         getArg('--mifact-token'),
  nombreComercial:     getArg('--nombre-comercial'),
  mifactBaseUrl:       getArg('--mifact-base-url') ?? 'https://demo.mifact.net.pe/api',
  serieFactura:        getArg('--serie-factura')   ?? 'F001',
  serieBoleta:         getArg('--serie-boleta')    ?? 'B001',
  dryRun:              hasFlag('--dry-run'),
};

// ─── validaciones ─────────────────────────────────────────────────────────────
const errores: string[] = [];

if (!args.tenant)          errores.push('Falta --tenant <código-tenant>');
if (!args.ruc)             errores.push('Falta --ruc <11 dígitos>');
if (!args.razonSocial)     errores.push('Falta --razon-social "..."');
if (!args.direccionFiscal) errores.push('Falta --direccion-fiscal "..."');
if (!args.ubigeo)          errores.push('Falta --ubigeo <6 dígitos>');
if (!args.mifactToken)     errores.push('Falta --mifact-token "..."');

// Validaciones de formato (solo si el valor está presente)
if (args.ruc && !/^\d{11}$/.test(args.ruc)) {
  errores.push(`--ruc inválido: "${args.ruc}" — debe ser exactamente 11 dígitos numéricos`);
}

if (args.ubigeo) {
  if (!/^\d{6}$/.test(args.ubigeo)) {
    errores.push(`--ubigeo inválido: "${args.ubigeo}" — debe ser exactamente 6 dígitos numéricos`);
  } else if (!ubigeoExiste(args.ubigeo)) {
    errores.push(`--ubigeo "${args.ubigeo}" no existe en el catálogo SUNAT`);
  }
}

if (args.mifactToken !== undefined && args.mifactToken.trim() === '') {
  errores.push('--mifact-token no puede estar vacío');
}

if (!/^https?:\/\//.test(args.mifactBaseUrl)) {
  errores.push(`--mifact-base-url inválida: "${args.mifactBaseUrl}" — debe comenzar con http:// o https://`);
}

if (!/^F\d{3}$/.test(args.serieFactura)) {
  errores.push(`--serie-factura inválida: "${args.serieFactura}" — formato: F seguido de 3 dígitos (ej. F001)`);
}

if (!/^B\d{3}$/.test(args.serieBoleta)) {
  errores.push(`--serie-boleta inválida: "${args.serieBoleta}" — formato: B seguido de 3 dígitos (ej. B001)`);
}

if (!process.env.FACTURACION_MASTER_KEY) {
  errores.push(
    'FACTURACION_MASTER_KEY no está en .env\n' +
    '  Ejecuta primero: pnpm facturacion:master-key\n' +
    '  Luego copia la línea generada a backend/.env'
  );
}

if (errores.length > 0) {
  console.error('\nErrores de validación:');
  for (const e of errores) console.error('  ✗ ' + e);
  console.error('');
  process.exit(1);
}

// ─── A partir de aquí los args están garantizados ─────────────────────────────
const tenant          = args.tenant!;
const ruc             = args.ruc!;
const razonSocial     = args.razonSocial!;
const direccionFiscal = args.direccionFiscal!;
const ubigeo          = args.ubigeo!;
const mifactToken     = args.mifactToken!;
const masterKey       = process.env.FACTURACION_MASTER_KEY!;
const schemaName      = 'tenant_' + tenant.replace(/-/g, '_');
const nombreComercial = args.nombreComercial ?? razonSocial;

// Datos del ubigeo para el resumen
const ubigeoData = obtenerUbigeo(ubigeo)!;
const ubigeoLabel = `${ubigeoData.departamento} / ${ubigeoData.provincia} / ${ubigeoData.distrito}`;

// ─── Resumen pre-ejecución ────────────────────────────────────────────────────
const LINEA = '═══════════════════════════════════════════════════════════════';
const tokenPreview = '**' + '*'.repeat(Math.min(10, mifactToken.length)) + '** (cifrado y guardado)';

console.log('');
console.log(LINEA);
console.log(`SETUP FACTURACIÓN ELECTRÓNICA — tenant ${tenant}${args.dryRun ? ' [DRY-RUN]' : ''}`);
console.log(LINEA);
console.log(`  RUC:               ${ruc}`);
console.log(`  Razón Social:      ${razonSocial}`);
console.log(`  Nombre Comercial:  ${nombreComercial}`);
console.log(`  Dirección fiscal:  ${direccionFiscal}`);
console.log(`  UBIGEO:            ${ubigeo} (${ubigeoLabel})`);
console.log(`  Mifact URL:        ${args.mifactBaseUrl}`);
console.log(`  Token Mifact:      ${tokenPreview}`);
console.log(`  Serie factura:     ${args.serieFactura}`);
console.log(`  Serie boleta:      ${args.serieBoleta}`);
console.log('');
console.log(`  Tenant schema:     ${schemaName}`);
console.log(`  Master key:        ✓ encontrada en .env`);
console.log(LINEA);
console.log('');

if (args.dryRun) {
  console.log('[DRY-RUN] Modo simulación — NO se tocará la base de datos.');
  console.log('');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const prisma = new PrismaClient();

  try {
    // Apuntar al schema del tenant
    await prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}"`);

    // ── 1. Buscar sucursal principal ──────────────────────────────────────────
    const sucursal = await (prisma.sucursal as any).findFirst({
      where: { esPrincipal: true, eliminadoEn: null },
    });

    if (!sucursal) {
      console.error(`✗ No se encontró una sucursal principal en el tenant "${tenant}".`);
      console.error('  Verifica que el tenant esté correctamente inicializado (seed, crear-tenant).');
      process.exit(1);
    }

    const sucursalId: string = sucursal.id;

    if (args.dryRun) {
      console.log(`[DRY-RUN] Sucursal principal encontrada: ${sucursal.nombre} (id: ${sucursalId})`);
    }

    // ── 2. Cifrar token ───────────────────────────────────────────────────────
    const tokenCifrado = cifrar(mifactToken, masterKey);

    // ── 3. Operaciones DB en transacción ──────────────────────────────────────
    if (args.dryRun) {
      // Verificar que el cifrado/descifrado funciona aunque no toquemos DB
      const tokenDescifrado = descifrar(tokenCifrado, masterKey);
      const smokeOk = tokenDescifrado === mifactToken;

      console.log('');
      console.log('[DRY-RUN] Operaciones que se ejecutarían:');
      console.log('');

      // ConfiguracionFacturacion
      const cfgExistente = await (prisma.configuracionFacturacion as any).findFirst();
      if (cfgExistente) {
        console.log(`  [DRY-RUN] UPDATE configuracion_facturacion (id: ${cfgExistente.id})`);
        console.log(`            ruc=${ruc}, razon_social="${razonSocial}", mifact_base_url="${args.mifactBaseUrl}"`);
      } else {
        console.log(`  [DRY-RUN] CREATE configuracion_facturacion`);
        console.log(`            ruc=${ruc}, razon_social="${razonSocial}", mifact_base_url="${args.mifactBaseUrl}"`);
      }

      // Series CPE
      const serieFacturaExistente = await (prisma.serieCpe as any).findFirst({
        where: { sucursalId, tipoCpe: 'factura', serie: args.serieFactura },
      });
      if (serieFacturaExistente) {
        console.log(`  [DRY-RUN] UPDATE series_cpe factura ${args.serieFactura} → activa=true (correlativoActual NO se toca)`);
      } else {
        console.log(`  [DRY-RUN] CREATE series_cpe factura ${args.serieFactura}, correlativoActual=0`);
      }

      const serieBoleta = await (prisma.serieCpe as any).findFirst({
        where: { sucursalId, tipoCpe: 'boleta', serie: args.serieBoleta },
      });
      if (serieBoleta) {
        console.log(`  [DRY-RUN] UPDATE series_cpe boleta ${args.serieBoleta} → activa=true (correlativoActual NO se toca)`);
      } else {
        console.log(`  [DRY-RUN] CREATE series_cpe boleta ${args.serieBoleta}, correlativoActual=0`);
      }

      console.log('');
      console.log(`  [DRY-RUN] Smoke test cifrado: ${smokeOk ? '✓ OK' : '✗ FALLÓ — revisar master key'}`);
      console.log('');
      console.log('[DRY-RUN] Fin de simulación. Corre sin --dry-run para aplicar.');
      console.log('');
      return;
    }

    // ─── Transacción real ─────────────────────────────────────────────────────
    let cfgId: string;
    let serieFacturaCorrelativo: number;
    let serieBoleta2Correlativo: number;

    await prisma.$transaction(async (tx) => {
      // ConfiguracionFacturacion
      const cfgExistente = await (tx.configuracionFacturacion as any).findFirst();

      const cfgData = {
        mifactTokenCifrado:      tokenCifrado,
        mifactBaseUrl:           args.mifactBaseUrl,
        ruc,
        razonSocial,
        nombreComercial,
        direccionFiscal,
        ubigeoFiscalCodigo:      ubigeo,
        formatoImpresion:        '001',
        enviarAutomaticoASunat:  true,
        retornarPdf:             true,
        retornarXmlEnvio:        false,
        retornarXmlCdr:          false,
      };

      let cfg: { id: string };
      if (cfgExistente) {
        cfg = await (tx.configuracionFacturacion as any).update({
          where: { id: cfgExistente.id },
          data: cfgData,
        });
      } else {
        cfg = await (tx.configuracionFacturacion as any).create({ data: cfgData });
      }
      cfgId = cfg.id;

      // SerieCpe — Factura
      const upsertedFactura = await (tx.serieCpe as any).upsert({
        where: {
          sucursalId_tipoCpe_serie: {
            sucursalId,
            tipoCpe: 'factura',
            serie:   args.serieFactura,
          },
        },
        create: {
          sucursalId,
          tipoCpe:           'factura',
          serie:             args.serieFactura,
          correlativoActual: 0,
          activa:            true,
        },
        update: {
          // NO resetear correlativoActual — solo re-activar si estaba inactiva
          activa: true,
        },
      });
      serieFacturaCorrelativo = upsertedFactura.correlativoActual;

      // SerieCpe — Boleta
      const upsertedBoleta = await (tx.serieCpe as any).upsert({
        where: {
          sucursalId_tipoCpe_serie: {
            sucursalId,
            tipoCpe: 'boleta',
            serie:   args.serieBoleta,
          },
        },
        create: {
          sucursalId,
          tipoCpe:           'boleta',
          serie:             args.serieBoleta,
          correlativoActual: 0,
          activa:            true,
        },
        update: {
          activa: true,
        },
      });
      serieBoleta2Correlativo = upsertedBoleta.correlativoActual;
    });

    // ── 4. Smoke test ─────────────────────────────────────────────────────────
    let smokeOk = false;
    let smokeError = '';
    try {
      const cfgGuardada = await (prisma.configuracionFacturacion as any).findFirst();
      const tokenRecuperado = descifrar(cfgGuardada.mifactTokenCifrado, masterKey);
      smokeOk = tokenRecuperado === mifactToken;
      if (!smokeOk) smokeError = 'El token descifrado no coincide con el original';
    } catch (err: unknown) {
      smokeError = err instanceof Error ? err.message : String(err);
    }

    // ── 5. Logging final ──────────────────────────────────────────────────────
    console.log(`✓ ConfiguracionFacturacion guardada (id: ${cfgId!})`);
    console.log(`✓ SerieCpe factura ${args.serieFactura} (correlativoActual=${serieFacturaCorrelativo!})`);
    console.log(`✓ SerieCpe boleta  ${args.serieBoleta} (correlativoActual=${serieBoleta2Correlativo!})`);

    if (smokeOk) {
      console.log('✓ Smoke test: token cifrado/descifrado OK');
    } else {
      console.warn(`⚠  Smoke test FALLÓ: ${smokeError}`);
      console.warn('   Verifica que FACTURACION_MASTER_KEY sea la misma que se usó para cifrar.');
    }

    console.log('');
    console.log(LINEA);
    console.log(`Tenant ${tenant} listo para emitir CPE`);
    console.log(LINEA);
    console.log('');
    console.log('Próximos pasos:');
    console.log('  1. Crear una venta normal en el POS');
    console.log('  2. El sistema auto-emite el CPE al confirmar');
    console.log('  3. Ver el estado:');
    console.log('       GET /api/v1/ventas/<id>/documento-electronico');
    console.log('     o consultar manualmente:');
    console.log('       POST /api/v1/ventas/<id>/consultar-estado-cpe');
    console.log('');

  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('');
  console.error('Error fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
