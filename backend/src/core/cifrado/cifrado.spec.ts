/**
 * Tests del helper de cifrado AES-256-GCM.
 *
 * Cubre: round-trip, tag inválido, clave incorrecta, texto vacío,
 * blob mal-formado, y no-determinismo del IV.
 */
import { cifrar, descifrar } from './cifrado';

const CLAVE = 'clave-maestra-de-prueba-32bytes!';
const CLAVE_OTRA = 'otra-clave-completamente-diferente';

describe('cifrado AES-256-GCM', () => {
  // ─── 1. Round-trip ────────────────────────────────────────────────────────

  describe('round-trip', () => {
    it('descifra correctamente un texto corto', () => {
      const original = 'Hola Mifact';
      expect(descifrar(cifrar(original, CLAVE), CLAVE)).toBe(original);
    });

    it('descifra correctamente un texto largo', () => {
      const original = 'a'.repeat(2000);
      expect(descifrar(cifrar(original, CLAVE), CLAVE)).toBe(original);
    });

    it('descifra correctamente texto con caracteres especiales', () => {
      const original = 'Facturación: ñoño ¿€$? 中文 \n\t\r\0';
      expect(descifrar(cifrar(original, CLAVE), CLAVE)).toBe(original);
    });

    it('round-trip con texto vacío', () => {
      expect(descifrar(cifrar('', CLAVE), CLAVE)).toBe('');
    });
  });

  // ─── 2. Tag inválido (manipulación de 1 byte) ─────────────────────────────

  it('lanza error con mensaje claro si el tag está corrompido', () => {
    const blob = cifrar('secreto', CLAVE);
    const buf = Buffer.from(blob, 'base64');
    // Corromper el último byte (parte del tag GCM)
    const lastIdx = buf.length - 1;
    buf[lastIdx] = (buf[lastIdx] ?? 0) ^ 0xff;
    const blobbad = buf.toString('base64');

    expect(() => descifrar(blobbad, CLAVE)).toThrow(/autenticación GCM fallida/i);
  });

  // ─── 3. Clave incorrecta → error ──────────────────────────────────────────

  it('lanza error con mensaje claro si la clave es incorrecta', () => {
    const blob = cifrar('secreto', CLAVE);
    expect(() => descifrar(blob, CLAVE_OTRA)).toThrow(/autenticación GCM fallida/i);
  });

  // ─── 4. Blob mal-formado ──────────────────────────────────────────────────

  it('lanza error si el blob es demasiado corto (menos de 28 bytes)', () => {
    // 27 bytes en base64
    const corto = Buffer.alloc(27).toString('base64');
    expect(() => descifrar(corto, CLAVE)).toThrow(/demasiado corto/i);
  });

  it('lanza error si el blob no es base64 válido', () => {
    // Buffer.from con base64 de un string inválido no lanza pero produce datos
    // incorrectos que fallarán en autenticación GCM o en el length check.
    // Usamos un string con caracteres claramente fuera de base64 + longitud < 28.
    expect(() => descifrar('!!!', CLAVE)).toThrow(/demasiado corto|base64|autenticación/i);
  });

  // ─── 5. No-determinismo del IV ────────────────────────────────────────────

  it('dos cifrados del mismo texto producen blobs distintos', () => {
    const texto = 'mismo texto';
    const blob1 = cifrar(texto, CLAVE);
    const blob2 = cifrar(texto, CLAVE);
    expect(blob1).not.toBe(blob2);
    // Pero ambos descifran correctamente
    expect(descifrar(blob1, CLAVE)).toBe(texto);
    expect(descifrar(blob2, CLAVE)).toBe(texto);
  });
});
