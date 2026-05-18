export interface FraseRopa {
  texto: string;
  categoria: 'dato' | 'tip' | 'curiosidad';
}

export const FRASES_ROPA: FraseRopa[] = [
  { categoria: 'dato', texto: 'La industria de la moda mueve más de 2.5 billones de dólares al año a nivel global.' },
  { categoria: 'tip', texto: 'Etiquetá cada variante con código de barras: las ventas se aceleran 3x con escáner en el POS.' },
  { categoria: 'curiosidad', texto: 'Los probadores con buena iluminación cálida aumentan las conversiones hasta 25%.' },
  { categoria: 'dato', texto: 'El cliente promedio decide si entra a tu tienda en menos de 8 segundos al ver el escaparate.' },
  { categoria: 'tip', texto: 'Reponé el stock mínimo antes de que un best-seller se agote: perdés más por quiebre que por exceso.' },
  { categoria: 'curiosidad', texto: 'En Perú, el ticket promedio en tiendas de ropa fast-fashion es de S/ 85, según APEIM 2024.' },
  { categoria: 'tip', texto: 'Las variantes por talla y color en POS evitan el 90% de los errores de inventario.' },
  { categoria: 'dato', texto: 'Una prenda devuelta cuesta hasta el 30% de su precio de venta entre logística y reposición.' },
  { categoria: 'curiosidad', texto: 'Los colores oscuros venden más en invierno, pero los pasteles tienen mayor margen en primavera.' },
  { categoria: 'tip', texto: 'Cobrá con Yape/Plin: en Perú representan el 40% de los pagos retail bajo S/ 100.' },
  { categoria: 'dato', texto: 'El 73% de los compradores de ropa revisan stock online antes de visitar la tienda física.' },
  { categoria: 'curiosidad', texto: 'La talla M peruana equivale aprox. a una talla 38-40 europea — verificá tus tablas.' },
  { categoria: 'tip', texto: 'Combiná productos complementarios en el POS para aumentar el ticket promedio (cross-selling).' },
  { categoria: 'dato', texto: 'Las tiendas con WhatsApp Business venden 27% más que las que solo dependen del local físico.' },
  { categoria: 'curiosidad', texto: 'En el sector retail, el martes y miércoles son los días con menos ventas — usalos para inventariar.' },
  { categoria: 'tip', texto: 'Cerrá caja cada turno con arqueo: diferencias por encima de S/ 10 indican fugas o errores recurrentes.' },
  { categoria: 'dato', texto: 'El cliente recurrente gasta 67% más que uno nuevo. Construí tu base de clientes desde el primer ticket.' },
  { categoria: 'curiosidad', texto: 'El "Black Friday" peruano (Cyber Wow) supera los S/ 1,000 millones en transacciones cada año.' },
];
