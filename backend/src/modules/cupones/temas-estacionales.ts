/**
 * Catálogo de temas estacionales para cupones del comerciante peruano-cusqueño.
 *
 * Cada tema define una paleta de colores, emoji y copy contextual para una
 * festividad/evento específico. Se aplica al cupón vía el campo `temaEstacional`
 * y, al guardar, hidrata automáticamente los campos de diseño visual.
 *
 * Catálogo generado por investigación cultural + marketing brutal el 2026-05-27.
 */

export type TemaCategoria =
  | 'festividad-cusco'
  | 'festividad-peru'
  | 'religiosa'
  | 'comercial-internacional'
  | 'comercial-peru'
  | 'estacional'
  | 'fecha-personal';

export type TemaFechaTipo = 'fija' | 'variable-pascua' | 'variable-mes' | 'variable-otro';

export interface TemaEstacional {
  id: string;
  nombre: string;
  categoria: TemaCategoria;
  fechaTipo: TemaFechaTipo;
  /** MM-DD si fechaTipo='fija' */
  fechaFija?: string;
  /** Mes principal (1-12) para variables por mes */
  mesEspecial?: number;
  /** Regla de cálculo en lenguaje natural para variables (informativa) */
  reglaCalculo?: string;
  descripcionCultural: string;
  emoji: string;
  emojiSecundario?: string;
  colorPrimario: string;
  colorSecundario: string;
  /** Copy de marketing para el campo disenoMensaje del cupón */
  mensajeCopy: string;
  /** Etiqueta de campaña (max ~60 chars) */
  nombreCampania: string;
  diasVigenciaSugeridos: number;
  descuentoSugeridoPct: number;
  segmentoSugerido:
    | 'todos'
    | 'vip_aa'
    | 'vip_a'
    | 'vip_b'
    | 'nuevos_clientes'
    | 'reactivacion';
}

export const TEMAS_ESTACIONALES: TemaEstacional[] = [
  // ─────── FESTIVIDADES CUSQUEÑAS ───────
  {
    id: 'inti-raymi',
    nombre: 'Inti Raymi · Fiesta del Sol',
    categoria: 'festividad-cusco',
    fechaTipo: 'fija',
    fechaFija: '06-24',
    mesEspecial: 6,
    descripcionCultural:
      'Fiesta del Sol inca celebrada el 24 de junio en Sacsayhuamán. Es la festividad más importante del calendario cusqueño, declarada Patrimonio Cultural de la Nación. Honra al Inti (sol) en el solsticio de invierno andino.',
    emoji: '☀️',
    emojiSecundario: '🌅',
    colorPrimario: '#C84B1F',
    colorSecundario: '#D4A017',
    mensajeCopy: 'Solo por Inti Raymi — descuento solar de 25%. Vence el 24 a medianoche, como el Sol que se va.',
    nombreCampania: 'Descuento Solar Inti Raymi',
    diasVigenciaSugeridos: 7,
    descuentoSugeridoPct: 25,
    segmentoSugerido: 'todos',
  },
  {
    id: 'dia-del-cusco',
    nombre: 'Día del Cusco · Mes Jubilar',
    categoria: 'festividad-cusco',
    fechaTipo: 'fija',
    fechaFija: '06-24',
    mesEspecial: 6,
    reglaCalculo: 'Todo el mes de junio, intensificar del 20 al 30',
    descripcionCultural:
      'Junio entero es el mes jubilar del Cusco: serenata al Cusco (23 jun), pasacalle universitario, corso magisterial, y el 24 como día central. La ciudad se viste de rojo y blanco, la bandera del Tahuantinsuyo flamea en cada esquina. Comercio aumenta 40-60%.',
    emoji: '🌈',
    emojiSecundario: '🏛️',
    colorPrimario: '#B8341B',
    colorSecundario: '#E8A53D',
    mensajeCopy: 'El Cusco celebra y tu tienda también. 30% off en toda la colección durante el mes jubilar. Porque somos cusqueños.',
    nombreCampania: 'Mes Jubilar del Cusco',
    diasVigenciaSugeridos: 30,
    descuentoSugeridoPct: 30,
    segmentoSugerido: 'todos',
  },
  {
    id: 'corpus-christi-cusco',
    nombre: 'Corpus Christi del Cusco',
    categoria: 'festividad-cusco',
    fechaTipo: 'variable-pascua',
    reglaCalculo: 'Jueves siguiente al 9.º domingo después de Pascua',
    descripcionCultural:
      'La procesión más importante del Cusco, 60 días después del Domingo de Pascua. Quince santos y vírgenes salen de sus parroquias hacia la Catedral. Sincretismo entre catolicismo y tradición inca. Se come chiriuchu.',
    emoji: '✝️',
    emojiSecundario: '👑',
    colorPrimario: '#B8860B',
    colorSecundario: '#8B1A1A',
    mensajeCopy: 'Corpus Christi en Cusco merece vestir bien. 20% off en prendas elegantes para acompañar las procesiones.',
    nombreCampania: 'Corpus Christi Cusqueño',
    diasVigenciaSugeridos: 10,
    descuentoSugeridoPct: 20,
    segmentoSugerido: 'todos',
  },
  {
    id: 'senor-temblores',
    nombre: 'Señor de los Temblores · Patrón Jurado',
    categoria: 'festividad-cusco',
    fechaTipo: 'variable-pascua',
    reglaCalculo: 'Lunes de Semana Santa',
    descripcionCultural:
      'Lunes Santo. El Taytacha de los Temblores, Cristo moreno patrón del Cusco. Tras el terremoto de 1650, el virrey lo declaró Patrón Jurado. Procesión cubierto de flores ñucchu (rojas). Devoción profunda del pueblo cusqueño.',
    emoji: '🙏',
    emojiSecundario: '🌹',
    colorPrimario: '#8B0000',
    colorSecundario: '#4A0E0E',
    mensajeCopy: 'Lunes Santo en Cusco. El Taytacha cuida al Cusco, nosotros cuidamos tu bolsillo: 20% off en ropa formal.',
    nombreCampania: 'Señor de los Temblores',
    diasVigenciaSugeridos: 5,
    descuentoSugeridoPct: 20,
    segmentoSugerido: 'todos',
  },
  {
    id: 'virgen-carmen-paucartambo',
    nombre: 'Virgen del Carmen de Paucartambo',
    categoria: 'festividad-cusco',
    fechaTipo: 'fija',
    fechaFija: '07-16',
    mesEspecial: 7,
    descripcionCultural:
      'Del 15 al 17 de julio en Paucartambo. La Mamacha Carmen es venerada con 19 comparsas de danzantes (qhapaq qolla, saqra, contradanza). Patrimonio Cultural de la Humanidad UNESCO.',
    emoji: '💃',
    emojiSecundario: '🎭',
    colorPrimario: '#7B2D8E',
    colorSecundario: '#FFD700',
    mensajeCopy: 'Mamacha Carmen baja del cielo. 25% off en prendas con color y vida, como las comparsas de Paucartambo.',
    nombreCampania: 'Mamacha del Carmen',
    diasVigenciaSugeridos: 6,
    descuentoSugeridoPct: 25,
    segmentoSugerido: 'todos',
  },
  {
    id: 'santuranticuy',
    nombre: 'Santuranticuy · Mercado Tradicional 24-Dic',
    categoria: 'festividad-cusco',
    fechaTipo: 'fija',
    fechaFija: '12-24',
    mesEspecial: 12,
    descripcionCultural:
      'Literalmente "venta de santos" en quechua. El 24 de diciembre la Plaza de Armas se llena de artesanos vendiendo figuras del Niño Manuelito, retablos, musgo, ichu, sahumerios. La feria navideña más antigua de América.',
    emoji: '👶',
    emojiSecundario: '🌟',
    colorPrimario: '#C9302C',
    colorSecundario: '#2E7D32',
    mensajeCopy: 'Santuranticuy: el Cusco arma su nacimiento. Tú armás tu look navideño con 30% off. Solo el 24 hasta medianoche.',
    nombreCampania: 'Santuranticuy Cusqueño',
    diasVigenciaSugeridos: 3,
    descuentoSugeridoPct: 30,
    segmentoSugerido: 'todos',
  },
  {
    id: 'carnaval-cusqueno',
    nombre: 'Carnaval Cusqueño',
    categoria: 'festividad-cusco',
    fechaTipo: 'variable-pascua',
    reglaCalculo: 'Sábado a martes antes del Miércoles de Ceniza',
    descripcionCultural:
      'Febrero/marzo, 47 días antes de Pascua. En Cusco el carnaval es agua, talco, mistura, serpentinas y yunzas (árbol adornado que se corta bailando). Comunidades campesinas hacen pago a la tierra.',
    emoji: '🎊',
    emojiSecundario: '💦',
    colorPrimario: '#E91E63',
    colorSecundario: '#FFEB3B',
    mensajeCopy: 'Carnaval cusqueño: agua, talco y rebajas. 25% off en prendas alegres para bailar la yunza.',
    nombreCampania: 'Carnaval Cusqueño',
    diasVigenciaSugeridos: 10,
    descuentoSugeridoPct: 25,
    segmentoSugerido: 'todos',
  },
  {
    id: 'san-sebastian-cusco',
    nombre: 'Fiesta de San Sebastián',
    categoria: 'festividad-cusco',
    fechaTipo: 'fija',
    fechaFija: '01-20',
    mesEspecial: 1,
    descripcionCultural:
      '20 de enero. Fiesta patronal del distrito de San Sebastián (Cusco) con danzas típicas, corrida de toros, fuegos artificiales. Una de las festividades de barrio más auténticas, menos turística que Inti Raymi.',
    emoji: '🎆',
    emojiSecundario: '⛪',
    colorPrimario: '#D2691E',
    colorSecundario: '#FFFFFF',
    mensajeCopy: 'Fiesta de San Sebastián: el barrio celebra. 20% off para vecinos sansebastianos y todo Cusco.',
    nombreCampania: 'San Sebastián Cusqueño',
    diasVigenciaSugeridos: 5,
    descuentoSugeridoPct: 20,
    segmentoSugerido: 'todos',
  },
  {
    id: 'semana-turismo-cusco',
    nombre: 'Semana del Turismo en Cusco',
    categoria: 'festividad-cusco',
    fechaTipo: 'fija',
    fechaFija: '09-27',
    mesEspecial: 9,
    descripcionCultural:
      'Tercera o cuarta semana de septiembre, alrededor del Día Mundial del Turismo. Cusco hace ferias, gastronomía, danzas en Plaza de Armas, ingresos gratuitos a museos. Cierre simbólico de temporada alta.',
    emoji: '🏔️',
    emojiSecundario: '🦙',
    colorPrimario: '#1E88E5',
    colorSecundario: '#D4A017',
    mensajeCopy: 'Semana del Turismo en Cusco. 20% off en ropa de viaje y casual andino. Para recibir al turista y para vos.',
    nombreCampania: 'Semana del Turismo Cusco',
    diasVigenciaSugeridos: 8,
    descuentoSugeridoPct: 20,
    segmentoSugerido: 'todos',
  },
  {
    id: 'senor-huanca',
    nombre: 'Señor de Huanca',
    categoria: 'festividad-cusco',
    fechaTipo: 'fija',
    fechaFija: '09-14',
    mesEspecial: 9,
    descripcionCultural:
      '14 de septiembre. Santuario del Señor de Huanca (San Salvador, Calca). Una de las peregrinaciones más importantes del sur andino. Miles caminan desde Cusco subiendo cerros.',
    emoji: '⛪',
    emojiSecundario: '🕯️',
    colorPrimario: '#6B4423',
    colorSecundario: '#DAA520',
    mensajeCopy: 'Señor de Huanca: peregriná y agradecé. 18% off en ropa cómoda para el camino.',
    nombreCampania: 'Señor de Huanca',
    diasVigenciaSugeridos: 7,
    descuentoSugeridoPct: 18,
    segmentoSugerido: 'todos',
  },
  {
    id: 'wanchaq-aniversario',
    nombre: 'Aniversario de Wanchaq',
    categoria: 'festividad-cusco',
    fechaTipo: 'fija',
    fechaFija: '06-06',
    mesEspecial: 6,
    descripcionCultural:
      '6 de junio. Distrito comercial y moderno de Cusco. Aniversario con corso, festival gastronómico. Es donde vive buena parte de la clase media cusqueña.',
    emoji: '🎉',
    emojiSecundario: '🏙️',
    colorPrimario: '#43A047',
    colorSecundario: '#FBC02D',
    mensajeCopy: 'Wanchaq está de aniversario. 15% off para wanchainos y todo Cusco.',
    nombreCampania: 'Aniversario Wanchaq',
    diasVigenciaSugeridos: 4,
    descuentoSugeridoPct: 15,
    segmentoSugerido: 'todos',
  },

  // ─────── FESTIVIDADES PERUANAS NACIONALES ───────
  {
    id: 'fiestas-patrias',
    nombre: 'Fiestas Patrias 🇵🇪',
    categoria: 'festividad-peru',
    fechaTipo: 'fija',
    fechaFija: '07-28',
    mesEspecial: 7,
    descripcionCultural:
      'Aniversario de la Independencia del Perú (1821). 28 julio mensaje presidencial, 29 parada militar. Feriado largo, viajes internos, comercio en pico máximo. Todos visten rojo y blanco.',
    emoji: '🇵🇪',
    emojiSecundario: '🎆',
    colorPrimario: '#D91023',
    colorSecundario: '#FFFFFF',
    mensajeCopy: 'Fiestas Patrias: vestí de rojo y blanco. 35% off en toda la colección del 26 al 30 de julio. Porque el Perú se siente.',
    nombreCampania: 'Perú de Fiesta',
    diasVigenciaSugeridos: 7,
    descuentoSugeridoPct: 35,
    segmentoSugerido: 'todos',
  },
  {
    id: 'ano-nuevo',
    nombre: 'Año Nuevo',
    categoria: 'festividad-peru',
    fechaTipo: 'fija',
    fechaFija: '12-31',
    mesEspecial: 12,
    descripcionCultural:
      '31 diciembre - 1 enero. En Perú se viste de amarillo (suerte), se da la vuelta a la manzana con maletas (viajes), se quema el muñeco. Cusqueños suben a Sacsayhuamán a esperar.',
    emoji: '🎆',
    emojiSecundario: '🥂',
    colorPrimario: '#0A0E27',
    colorSecundario: '#D4AF37',
    mensajeCopy: 'Año Nuevo en dorado. 30% off en ropa para recibir el año. Amarillo de suerte incluido.',
    nombreCampania: 'Año Nuevo Dorado',
    diasVigenciaSugeridos: 7,
    descuentoSugeridoPct: 30,
    segmentoSugerido: 'todos',
  },
  {
    id: 'navidad',
    nombre: 'Navidad',
    categoria: 'festividad-peru',
    fechaTipo: 'fija',
    fechaFija: '12-25',
    mesEspecial: 12,
    descripcionCultural:
      '24-25 diciembre. Noche Buena con pavo, panetón, chocolate caliente. En Cusco coincide con Santuranticuy. Mes de mayor venta del año para retail.',
    emoji: '🎄',
    emojiSecundario: '🎁',
    colorPrimario: '#C9302C',
    colorSecundario: '#1B5E20',
    mensajeCopy: 'Navidad ya llegó. 30% off para regalar y regalarte. Hasta el 24 a las 8pm, no esperés más.',
    nombreCampania: 'Navidad Peruana',
    diasVigenciaSugeridos: 15,
    descuentoSugeridoPct: 30,
    segmentoSugerido: 'todos',
  },
  {
    id: 'dia-madre',
    nombre: 'Día de la Madre',
    categoria: 'festividad-peru',
    fechaTipo: 'variable-mes',
    mesEspecial: 5,
    reglaCalculo: 'Segundo domingo de mayo',
    descripcionCultural:
      'Segundo domingo de mayo. En Perú se celebra fuerte: almuerzo familiar, regalo obligatorio. Florerías y tiendas de ropa son los más buscados.',
    emoji: '🌹',
    emojiSecundario: '💗',
    colorPrimario: '#E91E63',
    colorSecundario: '#D4AF37',
    mensajeCopy: 'Día de la Madre se merece más. 25% off para regalarle algo que sí use. Porque mamá no quiere otra licuadora.',
    nombreCampania: 'Para Mamá',
    diasVigenciaSugeridos: 14,
    descuentoSugeridoPct: 25,
    segmentoSugerido: 'todos',
  },
  {
    id: 'dia-padre',
    nombre: 'Día del Padre',
    categoria: 'festividad-peru',
    fechaTipo: 'variable-mes',
    mesEspecial: 6,
    reglaCalculo: 'Tercer domingo de junio',
    descripcionCultural:
      'Tercer domingo de junio. En Cusco coincide con mes jubilar — papá cusqueño celebra doble. Camisas, polos y pantalones son los productos top.',
    emoji: '👔',
    emojiSecundario: '🍻',
    colorPrimario: '#1A237E',
    colorSecundario: '#37474F',
    mensajeCopy: 'Día del Padre sin vueltas. 25% off en camisas, polos y pantalones. Lo que papá sí va a usar.',
    nombreCampania: 'Para Papá',
    diasVigenciaSugeridos: 12,
    descuentoSugeridoPct: 25,
    segmentoSugerido: 'todos',
  },
  {
    id: 'dia-nino',
    nombre: 'Día del Niño',
    categoria: 'festividad-peru',
    fechaTipo: 'variable-mes',
    mesEspecial: 8,
    reglaCalculo: 'Tercer domingo de agosto',
    descripcionCultural:
      'Tercer domingo de agosto en Perú. Padres regalan ropa y juguetes. Polos, vestidos infantiles y deportivas son los más buscados.',
    emoji: '🎈',
    emojiSecundario: '🧸',
    colorPrimario: '#42A5F5',
    colorSecundario: '#FFC107',
    mensajeCopy: 'Día del Niño: 25% off en toda la línea kids. Vestilo lindo, ellos crecen rápido.',
    nombreCampania: 'Para los chibolos',
    diasVigenciaSugeridos: 10,
    descuentoSugeridoPct: 25,
    segmentoSugerido: 'todos',
  },
  {
    id: 'dia-trabajo',
    nombre: 'Día del Trabajo',
    categoria: 'festividad-peru',
    fechaTipo: 'fija',
    fechaFija: '05-01',
    mesEspecial: 5,
    descripcionCultural:
      '1 de mayo. Feriado nacional. Comercio mantiene actividad — feriado largo permite compras. Asociado al inicio de campaña Día de la Madre.',
    emoji: '💪',
    emojiSecundario: '⚒️',
    colorPrimario: '#C62828',
    colorSecundario: '#212121',
    mensajeCopy: 'Día del Trabajador: descansá y vestite bien. 20% off por feriado, solo el 1 y 2 de mayo.',
    nombreCampania: 'Feriado del Trabajador',
    diasVigenciaSugeridos: 3,
    descuentoSugeridoPct: 20,
    segmentoSugerido: 'todos',
  },
  {
    id: 'combate-angamos',
    nombre: 'Combate de Angamos',
    categoria: 'festividad-peru',
    fechaTipo: 'fija',
    fechaFija: '10-08',
    mesEspecial: 10,
    descripcionCultural:
      '8 de octubre. Feriado nacional. Conmemoración del Almirante Miguel Grau. Feriado puente que se aprovecha para compras.',
    emoji: '⚓',
    emojiSecundario: '🇵🇪',
    colorPrimario: '#0D47A1',
    colorSecundario: '#D91023',
    mensajeCopy: 'Feriado de Angamos: 18% off honrando a Grau. Compra rápido, el feriado es solo un día.',
    nombreCampania: 'Feriado Angamos',
    diasVigenciaSugeridos: 3,
    descuentoSugeridoPct: 18,
    segmentoSugerido: 'todos',
  },
  {
    id: 'dia-cancion-criolla',
    nombre: 'Halloween / Día de la Canción Criolla',
    categoria: 'festividad-peru',
    fechaTipo: 'fija',
    fechaFija: '10-31',
    mesEspecial: 10,
    descripcionCultural:
      '31 de octubre coincide Halloween y Día de la Canción Criolla. Doble celebración: niños disfrazados, adultos en peñas criollas. En Cusco más Halloween que criolla.',
    emoji: '🎃',
    emojiSecundario: '🎶',
    colorPrimario: '#E65100',
    colorSecundario: '#212121',
    mensajeCopy: 'Halloween o Criolla, vos elegís. 22% off en outfits para disfrazarte o para zapatear.',
    nombreCampania: 'Halloween Criollo',
    diasVigenciaSugeridos: 5,
    descuentoSugeridoPct: 22,
    segmentoSugerido: 'todos',
  },

  // ─────── RELIGIOSAS ───────
  {
    id: 'senor-milagros',
    nombre: 'Señor de los Milagros · Mes Morado',
    categoria: 'religiosa',
    fechaTipo: 'fija',
    fechaFija: '10-18',
    mesEspecial: 10,
    descripcionCultural:
      'Octubre entero es el Mes Morado. Procesiones del Señor de los Milagros (Cristo Moreno de Pachacamilla, Lima) los días 18, 19 y 28. Anticuchos, turrón de Doña Pepa. Sahumerios morados en todo el país.',
    emoji: '💜',
    emojiSecundario: '🕯️',
    colorPrimario: '#4A148C',
    colorSecundario: '#D4AF37',
    mensajeCopy: 'Mes Morado: vestí de fe. 22% off en prendas color morado y oscuras durante todo octubre.',
    nombreCampania: 'Mes Morado',
    diasVigenciaSugeridos: 25,
    descuentoSugeridoPct: 22,
    segmentoSugerido: 'todos',
  },
  {
    id: 'semana-santa',
    nombre: 'Semana Santa',
    categoria: 'religiosa',
    fechaTipo: 'variable-pascua',
    reglaCalculo: 'Semana antes del Domingo de Pascua',
    descripcionCultural:
      'Semana móvil entre marzo y abril. Jueves y Viernes Santo son feriados nacionales. Procesiones en todo el país. En Cusco se mezcla con Señor de los Temblores. Tradición de los 7 platos.',
    emoji: '✝️',
    emojiSecundario: '🕊️',
    colorPrimario: '#6A1B9A',
    colorSecundario: '#D4AF37',
    mensajeCopy: 'Semana Santa: tiempo de reflexión y rebaja. 20% off en prendas elegantes para procesiones.',
    nombreCampania: 'Semana Santa',
    diasVigenciaSugeridos: 8,
    descuentoSugeridoPct: 20,
    segmentoSugerido: 'todos',
  },
  {
    id: 'santa-rosa-lima',
    nombre: 'Santa Rosa de Lima',
    categoria: 'religiosa',
    fechaTipo: 'fija',
    fechaFija: '08-30',
    mesEspecial: 8,
    descripcionCultural:
      '30 de agosto. Patrona de Lima, Perú y América. Feriado nacional. Procesión en Lima, veneración en todo el país.',
    emoji: '🌹',
    emojiSecundario: '⛪',
    colorPrimario: '#AD1457',
    colorSecundario: '#FFFFFF',
    mensajeCopy: 'Santa Rosa nos une al Perú entero. 18% off por feriado. Compra bonito, vestí devoto.',
    nombreCampania: 'Santa Rosa de Lima',
    diasVigenciaSugeridos: 3,
    descuentoSugeridoPct: 18,
    segmentoSugerido: 'todos',
  },

  // ─────── COMERCIALES INTERNACIONALES ───────
  {
    id: 'san-valentin',
    nombre: 'San Valentín · Amor y Amistad',
    categoria: 'comercial-internacional',
    fechaTipo: 'fija',
    fechaFija: '02-14',
    mesEspecial: 2,
    descripcionCultural:
      '14 de febrero. En Perú se celebra como Día del Amor y la Amistad — se incluye a amigos. Regalos de ropa, peluches, chocolates.',
    emoji: '❤️',
    emojiSecundario: '💐',
    colorPrimario: '#C2185B',
    colorSecundario: '#F8BBD0',
    mensajeCopy: 'San Valentín: regalale ropa, no chocolates que engordan. 25% off del 10 al 14. El amor se viste bien.',
    nombreCampania: 'San Valentín',
    diasVigenciaSugeridos: 6,
    descuentoSugeridoPct: 25,
    segmentoSugerido: 'todos',
  },
  {
    id: 'black-friday',
    nombre: 'Black Friday',
    categoria: 'comercial-internacional',
    fechaTipo: 'variable-mes',
    mesEspecial: 11,
    reglaCalculo: 'Último viernes de noviembre',
    descripcionCultural:
      'Último viernes de noviembre. Importado desde USA, ahora es FUERTE en Perú. Pico digital del año, segundo solo a Navidad.',
    emoji: '⚡',
    emojiSecundario: '🛍️',
    colorPrimario: '#000000',
    colorSecundario: '#FF6F00',
    mensajeCopy: 'Black Friday de verdad: 50% off por 24 horas. No prometemos, te lo damos. Vence viernes a medianoche.',
    nombreCampania: 'Black Friday Real',
    diasVigenciaSugeridos: 3,
    descuentoSugeridoPct: 50,
    segmentoSugerido: 'todos',
  },
  {
    id: 'cyber-monday',
    nombre: 'Cyber Monday',
    categoria: 'comercial-internacional',
    fechaTipo: 'variable-mes',
    mesEspecial: 11,
    reglaCalculo: 'Lunes siguiente al Black Friday',
    descripcionCultural:
      'Lunes siguiente a Black Friday. Originalmente solo digital, ahora extiende los descuentos del fin de semana.',
    emoji: '💻',
    emojiSecundario: '🛒',
    colorPrimario: '#1A237E',
    colorSecundario: '#FF6F00',
    mensajeCopy: 'Cyber Monday: segunda oportunidad. 40% off online por 24 horas. No te quedes mirando otra vez.',
    nombreCampania: 'Cyber Monday',
    diasVigenciaSugeridos: 2,
    descuentoSugeridoPct: 40,
    segmentoSugerido: 'todos',
  },
  {
    id: 'dia-mujer',
    nombre: 'Día Internacional de la Mujer',
    categoria: 'comercial-internacional',
    fechaTipo: 'fija',
    fechaFija: '03-08',
    mesEspecial: 3,
    descripcionCultural:
      '8 de marzo. En Perú ha crecido en relevancia última década. Tiendas de ropa femenina con campañas especiales con mensaje de empoderamiento.',
    emoji: '💜',
    emojiSecundario: '✊',
    colorPrimario: '#7B1FA2',
    colorSecundario: '#F48FB1',
    mensajeCopy: 'Día de la Mujer: vestí tu fuerza. 25% off en toda la línea mujer. Para regalarte vos misma, sin esperar.',
    nombreCampania: 'Día de la Mujer',
    diasVigenciaSugeridos: 5,
    descuentoSugeridoPct: 25,
    segmentoSugerido: 'todos',
  },

  // ─────── COMERCIALES PERÚ ───────
  {
    id: 'cyber-wow',
    nombre: 'Cyber Wow Perú',
    categoria: 'comercial-peru',
    fechaTipo: 'variable-otro',
    reglaCalculo: 'Fechas anunciadas por CAPECE (marzo, julio, octubre)',
    descripcionCultural:
      'Campaña nacional de comercio electrónico peruano organizada por CAPECE. Varias veces al año. Marcas peruanas grandes participan con descuentos reales. Es el Black Friday a la peruana.',
    emoji: '🔥',
    emojiSecundario: '💥',
    colorPrimario: '#E91E63',
    colorSecundario: '#FFC107',
    mensajeCopy: 'Cyber Wow Perú: 3 días de descuentos brutales. Hasta 45% off, no esperés que se acabe el stock.',
    nombreCampania: 'Cyber Wow',
    diasVigenciaSugeridos: 4,
    descuentoSugeridoPct: 45,
    segmentoSugerido: 'todos',
  },

  // ─────── ESTACIONALES ───────
  {
    id: 'vuelta-colegio',
    nombre: 'Vuelta al Colegio',
    categoria: 'estacional',
    fechaTipo: 'variable-mes',
    mesEspecial: 3,
    descripcionCultural:
      'Marzo en Perú. Inicio del año escolar. Padres compran uniformes, buzos, polos blancos. Tiendas de ropa con línea escolar y juvenil tienen pico de ventas.',
    emoji: '🎒',
    emojiSecundario: '📚',
    colorPrimario: '#1976D2',
    colorSecundario: '#FBC02D',
    mensajeCopy: 'Vuelta al cole sin sustos. 20% off en buzos, polos y prendas escolares.',
    nombreCampania: 'Back to School',
    diasVigenciaSugeridos: 21,
    descuentoSugeridoPct: 20,
    segmentoSugerido: 'todos',
  },
  {
    id: 'temporada-alta-cusco',
    nombre: 'Temporada Alta Turística Cusco',
    categoria: 'estacional',
    fechaTipo: 'fija',
    fechaFija: '04-15',
    mesEspecial: 4,
    descripcionCultural:
      'Mediados de abril a fines de octubre. Turistas extranjeros llegan a Cusco. Aumenta venta de ropa térmica, ponchos, chompas de alpaca, prendas con motivos andinos.',
    emoji: '🦙',
    emojiSecundario: '🌄',
    colorPrimario: '#6D4C41',
    colorSecundario: '#D4A017',
    mensajeCopy: 'Llegó la temporada alta a Cusco. 15% off en línea andina y abrigos. Para vender al turista y para abrigarte vos.',
    nombreCampania: 'Temporada Alta Cusco',
    diasVigenciaSugeridos: 14,
    descuentoSugeridoPct: 15,
    segmentoSugerido: 'todos',
  },
  {
    id: 'fin-temporada-liquidacion',
    nombre: 'Liquidación Fin de Temporada',
    categoria: 'estacional',
    fechaTipo: 'variable-mes',
    reglaCalculo: 'Marzo (cierre verano) y septiembre (cierre invierno)',
    descripcionCultural:
      'Cambios estacionales: fin de invierno (septiembre) y fin de verano (febrero-marzo). Tiendas liquidan stock viejo para hacer espacio a la nueva colección. Descuentos profundos.',
    emoji: '🏷️',
    emojiSecundario: '📦',
    colorPrimario: '#D32F2F',
    colorSecundario: '#212121',
    mensajeCopy: 'Liquidación fin de temporada: hasta 60% off para vaciar el almacén. Cuando se acaba, se acaba. No vuelve.',
    nombreCampania: 'Liquidación Total',
    diasVigenciaSugeridos: 15,
    descuentoSugeridoPct: 50,
    segmentoSugerido: 'todos',
  },

  // ─────── FECHA PERSONAL ───────
  {
    id: 'cumpleanos-cliente',
    nombre: 'Cumpleaños del Cliente',
    categoria: 'fecha-personal',
    fechaTipo: 'variable-otro',
    reglaCalculo: 'Fecha de nacimiento del cliente; activar 1 día antes, vence 7 días después',
    descripcionCultural:
      'Fecha personal de cada cliente registrado. Enviar cupón exclusivo el día o semana del cumpleaños genera fidelización alta. Tasa de conversión supera 3× el promedio.',
    emoji: '🎂',
    emojiSecundario: '🎁',
    colorPrimario: '#E91E63',
    colorSecundario: '#FFC107',
    mensajeCopy: 'Feliz cumpleaños! Tu regalo: 30% off en lo que elijas, válido toda tu semana. Nadie merece más que vos hoy.',
    nombreCampania: 'Cumpleaños Cliente',
    diasVigenciaSugeridos: 7,
    descuentoSugeridoPct: 30,
    segmentoSugerido: 'todos',
  },
];

/**
 * Devuelve el tema por ID, o `null` si no existe.
 */
export function obtenerTema(id: string | null | undefined): TemaEstacional | null {
  if (!id) return null;
  return TEMAS_ESTACIONALES.find(t => t.id === id) ?? null;
}

/**
 * Devuelve los temas que están "activos" en el mes dado (mesEspecial = mes
 * o categoría 'estacional' que matchea). Útil para sugerir en la UI.
 */
export function temasDelMes(mes: number): TemaEstacional[] {
  return TEMAS_ESTACIONALES.filter(t => t.mesEspecial === mes);
}

/**
 * IDs válidos para uso en validación de DTOs.
 */
export const TEMAS_IDS = TEMAS_ESTACIONALES.map(t => t.id) as readonly string[];
