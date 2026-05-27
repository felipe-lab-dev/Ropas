/**
 * Tests del CpeBuilderService.
 * Golden file: facturacion/…/Factura_con_IGV_TRADICIONAL.txt
 * Contiene comentarios JS (// …) que no son JSON válido — se eliminan antes de parsear.
 */
import * as fs from 'fs';
import * as path from 'path';
import { CpeBuilderService } from './cpe-builder.service';
import { ConstruirCpeInput, MifactCpePayload } from './types';

// ─── Helper: strip JS comments del "JSON con comentarios" de Mifact ──────────

/**
 * Elimina comentarios `// …` de un texto respetando los que están dentro de strings.
 * Implementación simple de máquina de estados: recorre char a char.
 */
function stripJsComments(src: string): string {
  let result = '';
  let i = 0;
  while (i < src.length) {
    // Dentro de un string: copiar hasta la comilla de cierre (respetando escapes)
    if (src[i] === '"') {
      result += src[i++];
      while (i < src.length) {
        if (src[i] === '\\') {
          result += src[i++]; // escape char
          result += src[i++]; // escaped char
          continue;
        }
        if (src[i] === '"') {
          result += src[i++];
          break;
        }
        result += src[i++];
      }
      continue;
    }
    // Comentario de línea: descartar hasta fin de línea
    if (src[i] === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    result += src[i++];
  }
  return result;
}

/**
 * Carga y parsea un golden file desde la carpeta `facturacion/` del repo.
 * El test vive en backend/src/modules/facturacion-electronica/cpe-builder/,
 * así que facturacion/ está 5 directorios arriba.
 */
function cargarGolden(filename: string): MifactCpePayload {
  const goldenDir = path.resolve(
    __dirname,
    '..', '..', '..', '..', '..', // salir de backend/src/modules/facturacion-electronica/cpe-builder
    'facturacion',
    'integracionConJson_FV_BV_NC_ND',
    'Ejemplos Archivos JSON UBL 2_1',
  );
  const raw = fs.readFileSync(path.join(goldenDir, filename), 'utf-8');
  return JSON.parse(stripJsComments(raw)) as MifactCpePayload;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CpeBuilderService', () => {
  const servicio = new CpeBuilderService();

  describe('construirFactura', () => {
    it('construye JSON Mifact para factura tradicional con IGV', () => {
      const expected = cargarGolden('Factura_con_IGV_TRADICIONAL.txt');

      const input: ConstruirCpeInput = {
        token: 'gN8zNRBV+/FVxTLwdaZx0w==',
        emisor: {
          ruc: '20100100100',
          razonSocial: 'empresa demo',
          nombreComercial: 'mi nombre comercial es demo',
          ubigeo: '103040',
          direccionFiscal: 'avenida abcd',
          codigoAnexo: '0000',
        },
        receptor: {
          tipoDocumento: 'ruc',
          numeroDocumento: '20601847834',
          razonSocial: 'osys company sac',
          direccion: 'direccion del cliente',
        },
        venta: {
          tipoCpe: 'factura',
          serie: 'F004',
          correlativo: '00000031',
          fechaEmision: '2020-02-19',
          moneda: 'PEN',
          tipoCambio: '1.000',
          correoCliente: 'mifact@outlook.com',
          montoTotalGravado: '1000.00',
          montoTotalIgv: '180.00',
          montoTotal: '1180.00',
          codigoPuntoVenta: 'jmifact',
          codigoTipoOperacionSunat: '0101',
          placa: 'HNT384',
          items: [
            {
              codigo: 'BCF-RR01',
              unidadMedida: 'NIU',
              cantidad: '1',
              precioSinIgv: '500',
              precioConIgv: '590',
              valorVentaItem: '500',
              montoPrecioVentaItem: '590',
              tipoAfectacionIgv: 'gravado_onerosa',
              porcentajeIgv: '18',
              montoIgvItem: '90',
              descripcion: 'AUTO TOYOTA YARIS 2018',
            },
            {
              codigo: 'BCF-RR02',
              unidadMedida: 'NIU',
              cantidad: '1',
              precioSinIgv: '500',
              precioConIgv: '590',
              valorVentaItem: '500',
              montoPrecioVentaItem: '590',
              tipoAfectacionIgv: 'gravado_onerosa',
              porcentajeIgv: '18',
              montoIgvItem: '90',
              descripcion: 'DETALLE DEL PRODUCTO 2',
            },
          ],
          datosAdicionales: [
            {
              codigoTipo: '05',
              descripcion: 'texto para alguna observación',
            },
          ],
        },
        opciones: {
          enviarASunat: true,
          retornarXmlEnvio: true,
          retornarXmlCdr: false,
          retornarPdf: false,
          formatoImpresion: '001',
        },
      };

      expect(servicio.construirFactura(input)).toEqual(expected);
    });
  });
});
