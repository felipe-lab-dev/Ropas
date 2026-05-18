/**
 * SVG default para el logo 3D de bienvenida.
 *
 * IMPORTANTE: Three.js SVGLoader solo soporta <path>, <circle>, <rect>, etc.
 * NO soporta <text>. Para texto hay que convertir a paths con Illustrator
 * ("Crear contornos") / Figma ("Outline stroke") / herramientas online.
 *
 * Reglas de coloreado en `Logo3D` (basadas en bounding box):
 *  - maxX <= 520 → color primario (icono)
 *  - minY < 65   → color de texto secundario (resto del nombre)
 *  - resto       → color acento
 *
 * Este default es un monograma "R" con un vestido estilizado al lado.
 * El usuario puede reemplazarlo desde Configuración → Identidad de la tienda.
 */
export const DEFAULT_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 260">
  <!-- ═══ Icono — vestido estilizado (paths con maxX <= 520, color primario) ═══ -->
  <!-- Hanger gancho -->
  <path d="M 245 35 C 245 20, 270 20, 270 40 C 270 50, 260 55, 257 60 L 257 75 L 250 75 Z"/>
  <!-- Vestido (silueta acampanada) -->
  <path d="M 210 80 L 295 80 L 310 95 L 295 110 L 320 250 L 185 250 L 210 110 L 195 95 Z"/>
  <!-- Cuello en V -->
  <path d="M 248 80 L 252 80 L 257 100 L 253 105 L 250 105 L 247 100 Z" fill="#fff"/>

  <!-- ═══ Texto "ROPAS" — letras como paths geométricos (resto del viewBox) ═══ -->

  <!-- R -->
  <path d="M 560 55 L 560 250 L 605 250 L 605 175 L 635 175 L 680 250 L 730 250 L 680 170 C 715 158, 730 130, 730 105 C 730 70, 700 55, 660 55 Z M 605 95 L 655 95 C 675 95, 685 100, 685 115 C 685 130, 675 140, 655 140 L 605 140 Z"/>

  <!-- O -->
  <path d="M 850 50 C 790 50, 750 95, 750 152 C 750 209, 790 254, 850 254 C 910 254, 950 209, 950 152 C 950 95, 910 50, 850 50 Z M 850 95 C 885 95, 905 120, 905 152 C 905 184, 885 209, 850 209 C 815 209, 795 184, 795 152 C 795 120, 815 95, 850 95 Z"/>

  <!-- P -->
  <path d="M 985 55 L 985 250 L 1030 250 L 1030 185 L 1080 185 C 1120 185, 1150 160, 1150 120 C 1150 80, 1120 55, 1080 55 Z M 1030 95 L 1075 95 C 1095 95, 1105 105, 1105 120 C 1105 135, 1095 145, 1075 145 L 1030 145 Z"/>

  <!-- A -->
  <path d="M 1175 250 L 1225 250 L 1240 215 L 1325 215 L 1340 250 L 1390 250 L 1305 55 L 1260 55 Z M 1255 180 L 1310 180 L 1282 110 Z"/>

  <!-- S -->
  <path d="M 1485 110 C 1485 85, 1465 65, 1430 55 C 1395 50, 1355 60, 1340 90 C 1325 120, 1340 145, 1380 158 L 1420 170 C 1435 175, 1445 180, 1445 195 C 1445 215, 1420 220, 1395 215 C 1370 210, 1355 195, 1350 175 L 1308 185 C 1315 220, 1345 250, 1390 255 C 1440 260, 1490 245, 1495 200 C 1500 165, 1480 145, 1440 132 L 1402 122 C 1388 118, 1380 113, 1380 100 C 1380 88, 1395 80, 1415 82 C 1432 84, 1445 92, 1450 110 Z"/>
</svg>`;
