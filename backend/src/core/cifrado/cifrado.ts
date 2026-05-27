/**
 * cifrado.ts — Helper AES-256-GCM para secretos de facturación electrónica.
 *
 * Formato del blob (base64):
 *   IV (12 bytes) || ciphertext || tag (16 bytes)
 *
 * La clave se deriva de la masterKey con scrypt para que una clave de baja
 * entropía no afecte la seguridad del cifrado. La sal es fija ("ropas-sunat")
 * porque la entropía real proviene de la masterKey (variable de entorno).
 */
import * as crypto from 'crypto';

const ALGORITMO = 'aes-256-gcm';
const SAL = 'ropas-sunat';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const CLAVE_BYTES = 32;

function derivarClave(claveMaestra: string): Buffer {
  return crypto.scryptSync(claveMaestra, SAL, CLAVE_BYTES);
}

/**
 * Cifra `texto` con AES-256-GCM usando la `claveMaestra`.
 * Retorna un string base64 con layout: IV(12) || ciphertext || tag(16).
 * Cada llamada genera un IV diferente → blobs distintos para el mismo input.
 */
export function cifrar(texto: string, claveMaestra: string): string {
  const clave = derivarClave(claveMaestra);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITMO, clave, iv);

  const ciphertext = Buffer.concat([
    cipher.update(texto, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const blob = Buffer.concat([iv, ciphertext, tag]);
  return blob.toString('base64');
}

/**
 * Descifra un blob producido por `cifrar`.
 * Lanza un error descriptivo si el blob está corrompido, el tag es inválido
 * o la clave es incorrecta.
 */
export function descifrar(blob: string, claveMaestra: string): string {
  let buffer: Buffer;
  try {
    buffer = Buffer.from(blob, 'base64');
  } catch {
    throw new Error('cifrado: el blob no es base64 válido');
  }

  // Mínimo: IV (12) + al menos 0 bytes de ciphertext + tag (16) = 28 bytes
  if (buffer.length < IV_BYTES + TAG_BYTES) {
    throw new Error(
      `cifrado: blob demasiado corto (${buffer.length} bytes, mínimo ${IV_BYTES + TAG_BYTES})`,
    );
  }

  const iv = buffer.subarray(0, IV_BYTES);
  const tag = buffer.subarray(buffer.length - TAG_BYTES);
  const ciphertext = buffer.subarray(IV_BYTES, buffer.length - TAG_BYTES);

  const clave = derivarClave(claveMaestra);

  try {
    const decipher = crypto.createDecipheriv(ALGORITMO, clave, iv);
    decipher.setAuthTag(tag);
    const texto = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return texto.toString('utf8');
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : String(err);
    throw new Error(`cifrado: autenticación GCM fallida — ${mensaje}`);
  }
}
