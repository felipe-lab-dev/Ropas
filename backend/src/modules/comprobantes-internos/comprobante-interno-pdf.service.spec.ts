import {
  ComprobanteInternoPdfService,
  DatosPdfNotaCredito,
  DatosPdfVenta,
} from './comprobante-interno-pdf.service';

/**
 * El servicio genera PDFs con pdfkit (fuentes Helvetica built-in, sin registro
 * de fuentes del sistema). Los tests verifican que la salida sea un Buffer PDF
 * válido (firma `%PDF`) y no vacío para los casos de uso reales: venta interna,
 * nota de crédito, moneda extranjera y venta sin cliente.
 */
describe('ComprobanteInternoPdfService', () => {
  let service: ComprobanteInternoPdfService;

  const emisor = {
    ruc: '20123456789',
    razonSocial: 'Lorem Store S.A.C.',
    nombreComercial: 'Lorem Store',
    direccionFiscal: 'Av. Siempre Viva 123, Lima',
  };

  const ventaBase: DatosPdfVenta = {
    emisor,
    tienda: 'Lorem Store',
    sucursalNombre: 'Tienda Principal',
    sucursalDireccion: 'Av. Siempre Viva 123',
    numero: 'V-000123',
    fecha: new Date('2026-05-30T15:00:00Z'),
    moneda: 'PEN',
    clienteNombre: 'Juan Pérez',
    clienteDocumento: 'DNI 70498300',
    vendedorNombre: 'María Vendedora',
    estado: 'pagada',
    notas: 'Entrega en tienda',
    impuestos: 0,
    items: [
      { descripcion: 'Polo algodón talla M', cantidad: 2, precioUnitario: 35, subtotal: 70 },
      { descripcion: 'Pantalón jean talla 32', cantidad: 1, precioUnitario: 89.9, subtotal: 89.9 },
    ],
    subtotal: 159.9,
    descuento: 9.9,
    total: 150,
    pagos: [{ medio: 'efectivo', monto: 150 }],
  };

  const ncBase: DatosPdfNotaCredito = {
    emisor,
    tienda: 'Lorem Store',
    sucursalNombre: 'Tienda Principal',
    sucursalDireccion: 'Av. Siempre Viva 123',
    numero: 'NC-000045',
    fecha: new Date('2026-05-30T16:00:00Z'),
    moneda: 'PEN',
    clienteNombre: 'Juan Pérez',
    clienteDocumento: 'DNI 70498300',
    motivo: 'Devolución por talla incorrecta',
    ventaOriginalNumero: 'NV-000123',
    emitidaPorNombre: 'María Vendedora',
    items: [
      { descripcion: 'Polo algodón talla M', cantidad: 1, precioUnitario: 35, subtotal: 35 },
    ],
    subtotal: 35,
    total: 35,
  };

  beforeEach(() => {
    service = new ComprobanteInternoPdfService();
  });

  const esPdfValido = (buffer: Buffer) => {
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  };

  it('genera un PDF válido para una nota de venta', async () => {
    esPdfValido(await service.generarPdfVenta(ventaBase));
  });

  it('genera un PDF válido para una nota de crédito', async () => {
    esPdfValido(await service.generarPdfNotaCredito(ncBase));
  });

  it('soporta moneda extranjera (USD) sin romper', async () => {
    esPdfValido(await service.generarPdfVenta({ ...ventaBase, moneda: 'USD' }));
  });

  it('genera el PDF aunque la venta no tenga cliente ni pagos', async () => {
    esPdfValido(
      await service.generarPdfVenta({
        ...ventaBase,
        clienteNombre: null,
        clienteDocumento: null,
        pagos: [],
        notas: null,
      }),
    );
  });

  it('genera el PDF de NC sin venta original ni emisor', async () => {
    esPdfValido(
      await service.generarPdfNotaCredito({
        ...ncBase,
        ventaOriginalNumero: null,
        emitidaPorNombre: null,
      }),
    );
  });

  it('genera el PDF aunque el tenant no tenga datos de emisor (sin RUC)', async () => {
    esPdfValido(await service.generarPdfVenta({ ...ventaBase, emisor: null }));
  });

  it('mantiene el comprobante en una sola página (el pie no debe paginar)', async () => {
    const buffer = await service.generarPdfVenta(ventaBase);
    const raw = buffer.toString('latin1');
    expect(raw).toContain('/Count 1');
    expect(raw).not.toContain('/Count 2');
  });
});
