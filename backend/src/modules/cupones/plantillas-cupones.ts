/**
 * Plantillas de marketing brutal — campañas pre-armadas con copy,
 * diseño y reglas listas. El usuario solo confirma fechas y código.
 *
 * Cada plantilla retorna un objeto compatible con CrearCuponDto, salvo
 * `fechaInicio` / `fechaFin` que el caller debe completar.
 */

export type PlantillaCuponId =
  | 'bienvenida_vip'
  | 'reactivacion_urgente'
  | 'cumpleanios'
  | 'recompra_inteligente'
  | 'flash_sale';

export interface PlantillaCupon {
  id: PlantillaCuponId;
  emoji: string;
  titulo: string;
  copyMarketing: string;
  tagline: string;
  diasVigenciaSugeridos: number;
  config: {
    nombre: string;
    descripcion: string;
    tipoDescuento: 'porcentaje' | 'monto_fijo';
    valorDescuento: number;
    montoMinimoCompra: number | null;
    descuentoMaximo: number | null;
    usosMaximosPorCliente: number;
    usosMaximosTotal: number | null;
    segmento:
      | 'todos'
      | 'vip_aa'
      | 'vip_a'
      | 'vip_b'
      | 'vip_c'
      | 'lista_clientes'
      | 'nuevos_clientes'
      | 'reactivacion';
    aplicableA: 'toda_compra' | 'categorias' | 'productos';
    disenoColorPrimario: string;
    disenoColorSecundario: string;
    disenoMensaje: string;
    disenoEmoji: string;
    plantilla: PlantillaCuponId;
  };
}

export const PLANTILLAS_CUPONES: Record<PlantillaCuponId, PlantillaCupon> = {
  bienvenida_vip: {
    id: 'bienvenida_vip',
    emoji: '👑',
    titulo: 'Bienvenida VIP',
    tagline: 'Recompensa a tus mejores clientes desde el primer momento',
    copyMarketing:
      'Cuando un cliente alcanza el nivel A o AA, automaticemos un regalo. ' +
      'Demuestra que ves su valor antes que la competencia.',
    diasVigenciaSugeridos: 7,
    config: {
      nombre: 'Bienvenida VIP — gracias por tu confianza',
      descripcion:
        'Cupón de bienvenida para clientes recién clasificados como VIP. ' +
        'Recompensa exclusiva, vigencia corta para generar acción inmediata.',
      tipoDescuento: 'porcentaje',
      valorDescuento: 30,
      montoMinimoCompra: 100,
      descuentoMaximo: 200,
      usosMaximosPorCliente: 1,
      usosMaximosTotal: null,
      segmento: 'vip_a',
      aplicableA: 'toda_compra',
      disenoColorPrimario: '#d97706',
      disenoColorSecundario: '#451a03',
      disenoMensaje: 'Gracias por elegirnos siempre. Esto es solo el comienzo.',
      disenoEmoji: '👑',
      plantilla: 'bienvenida_vip',
    },
  },

  reactivacion_urgente: {
    id: 'reactivacion_urgente',
    emoji: '💀',
    titulo: 'Reactivación urgente',
    tagline: 'Recupera clientes que se enfriaron — antes de que sea tarde',
    copyMarketing:
      'Clientes que no compran en 60+ días. El cupón con vencimiento agresivo ' +
      'reduce la fricción mental: actúa ahora o pierdes la oportunidad.',
    diasVigenciaSugeridos: 3,
    config: {
      nombre: 'Te extrañamos — vuelve con un regalo',
      descripcion:
        'Cupón agresivo para clientes inactivos. Vencimiento corto (72h) y descuento alto ' +
        'crean urgencia que vence el bloqueo de la indecisión.',
      tipoDescuento: 'porcentaje',
      valorDescuento: 25,
      montoMinimoCompra: 80,
      descuentoMaximo: 150,
      usosMaximosPorCliente: 1,
      usosMaximosTotal: null,
      segmento: 'reactivacion',
      aplicableA: 'toda_compra',
      disenoColorPrimario: '#dc2626',
      disenoColorSecundario: '#450a0a',
      disenoMensaje: 'Solo 72 horas. Vence pronto y no se renueva.',
      disenoEmoji: '⏳',
      plantilla: 'reactivacion_urgente',
    },
  },

  cumpleanios: {
    id: 'cumpleanios',
    emoji: '🎂',
    titulo: 'Cumpleaños del cliente',
    tagline: 'Convierte un dato CRM en una venta emocional',
    copyMarketing:
      'Tu sistema ya guarda la fecha de nacimiento. Úsala. Un cupón que llega ' +
      'el mes del cumpleaños tiene 4x más conversión que uno genérico.',
    diasVigenciaSugeridos: 30,
    config: {
      nombre: 'Feliz cumpleaños — regalo de la casa',
      descripcion:
        'Cupón emocional vinculado al mes del cumpleaños del cliente. ' +
        'Sin condiciones agresivas — el mensaje es agradecimiento, no presión.',
      tipoDescuento: 'porcentaje',
      valorDescuento: 20,
      montoMinimoCompra: 50,
      descuentoMaximo: 100,
      usosMaximosPorCliente: 1,
      usosMaximosTotal: null,
      segmento: 'todos',
      aplicableA: 'toda_compra',
      disenoColorPrimario: '#ec4899',
      disenoColorSecundario: '#500724',
      disenoMensaje: 'Hoy se celebra que existes. Date un gusto, va por la casa.',
      disenoEmoji: '🎂',
      plantilla: 'cumpleanios',
    },
  },

  recompra_inteligente: {
    id: 'recompra_inteligente',
    emoji: '🛒',
    titulo: 'Recompra inteligente',
    tagline: 'Sube el ticket promedio de tus clientes recurrentes',
    copyMarketing:
      'Identificá clientes que compran chico y empújalos al siguiente nivel. ' +
      'Monto mínimo alto = forzás a sumar piezas que en frío no comprarían.',
    diasVigenciaSugeridos: 14,
    config: {
      nombre: 'Llévate más, paga menos',
      descripcion:
        'Cupón orientado a aumentar ticket promedio. Monto mínimo alto fuerza ' +
        'a agregar piezas adicionales — el descuento solo se desbloquea al superar el umbral.',
      tipoDescuento: 'porcentaje',
      valorDescuento: 15,
      montoMinimoCompra: 250,
      descuentoMaximo: 80,
      usosMaximosPorCliente: 2,
      usosMaximosTotal: null,
      segmento: 'vip_b',
      aplicableA: 'toda_compra',
      disenoColorPrimario: '#0891b2',
      disenoColorSecundario: '#083344',
      disenoMensaje: 'Tu próxima compra tiene un premio si te animás.',
      disenoEmoji: '🛍️',
      plantilla: 'recompra_inteligente',
    },
  },

  flash_sale: {
    id: 'flash_sale',
    emoji: '⚡',
    titulo: 'Flash sale 24h',
    tagline: 'Genera tráfico de pico cuando tu local lo necesita',
    copyMarketing:
      'Para martes muertos, fin de temporada o liquidación de stock estancado. ' +
      'Vencimiento de 24h + cantidad limitada activa FOMO real.',
    diasVigenciaSugeridos: 1,
    config: {
      nombre: 'FLASH 24h — descuento de pánico',
      descripcion:
        'Cupón masivo con vencimiento de 24h y stock limitado. Ideal para mover ' +
        'inventario estancado o llenar el local en horarios bajos.',
      tipoDescuento: 'porcentaje',
      valorDescuento: 35,
      montoMinimoCompra: null,
      descuentoMaximo: 250,
      usosMaximosPorCliente: 1,
      usosMaximosTotal: 50,
      segmento: 'todos',
      aplicableA: 'toda_compra',
      disenoColorPrimario: '#f59e0b',
      disenoColorSecundario: '#451a03',
      disenoMensaje: '24 horas. 50 cupones. Cuando se acaban, se acaban.',
      disenoEmoji: '⚡',
      plantilla: 'flash_sale',
    },
  },
};

export const PLANTILLAS_LISTA: PlantillaCupon[] = Object.values(PLANTILLAS_CUPONES);

/**
 * Genera un código alfanumérico legible tipo VERANO25-A3F2.
 * No usa caracteres ambiguos (0/O, 1/I/L).
 */
export function generarCodigoCupon(prefijo?: string): string {
  const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const sufijo = Array.from({ length: 5 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)],
  ).join('');
  const pre = (prefijo ?? 'CUP').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return `${pre}-${sufijo}`;
}
