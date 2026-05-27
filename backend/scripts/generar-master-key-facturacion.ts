/**
 * Genera una nueva FACTURACION_MASTER_KEY (32 bytes hex) y la imprime
 * con instrucciones para que el operador la copie al .env.
 *
 * NO escribe el .env automáticamente — el operador decide.
 *
 * Uso:
 *   pnpm facturacion:master-key
 */
import { randomBytes } from 'node:crypto';

const clave = randomBytes(32).toString('hex');

console.log('');
console.log('FACTURACION_MASTER_KEY=' + clave);
console.log('');
console.log('────────────────────────────────────────────────────────────');
console.log('Copiá la línea de arriba a backend/.env');
console.log('');
console.log('IMPORTANTE: si ya hay una FACTURACION_MASTER_KEY existente,');
console.log('NO la reemplaces — los tokens cifrados con la vieja clave');
console.log('dejarían de descifrarse y la facturación quedaría rota.');
console.log('────────────────────────────────────────────────────────────');
console.log('');
