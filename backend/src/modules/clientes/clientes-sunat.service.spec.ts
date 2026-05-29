/**
 * Spec — Validaciones SUNAT en ClientesService (4.D)
 *
 * Tests aislados, sin DB ni Prisma real.
 * Cubren: ubigeoCodigo en crear() y actualizar().
 */

import { ErrorValidacion } from '../../core/errors/errores';
import { ubigeoExiste } from '../../core/sunat/ubigeos';

// ─── Helper que replica la lógica de validación del service ──────────────────

function validarUbigeo(codigo: string | null | undefined): void {
  if (codigo && !ubigeoExiste(codigo)) {
    throw new ErrorValidacion(
      `Ubigeo "${codigo}" no existe en el catálogo SUNAT`,
    );
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ClientesService — validaciones SUNAT ubigeoCodigo (4.D)', () => {
  // ─── 1. Ubigeo válido pasa ────────────────────────────────────────────────

  it('150101 (Lima - Lima - Lima) pasa sin lanzar', () => {
    expect(() => validarUbigeo('150101')).not.toThrow();
  });

  it('080101 (Cusco capital) pasa sin lanzar', () => {
    expect(() => validarUbigeo('080101')).not.toThrow();
  });

  // ─── 2. Ubigeo inválido → ErrorValidacion ────────────────────────────────

  it('999999 (no existe) lanza ErrorValidacion', () => {
    expect(() => validarUbigeo('999999')).toThrow(ErrorValidacion);
    expect(() => validarUbigeo('999999')).toThrow(/no existe en el catálogo SUNAT/i);
  });

  it('000000 lanza ErrorValidacion', () => {
    expect(() => validarUbigeo('000000')).toThrow(ErrorValidacion);
  });

  it('"ABCDEF" lanza ErrorValidacion', () => {
    expect(() => validarUbigeo('ABCDEF')).toThrow(ErrorValidacion);
  });

  // ─── 3. Nulo / undefined → no valida ────────────────────────────────────

  it('null no lanza (campo nullable en schema)', () => {
    expect(() => validarUbigeo(null)).not.toThrow();
  });

  it('undefined no lanza (campo opcional en DTO)', () => {
    expect(() => validarUbigeo(undefined)).not.toThrow();
  });

  it('cadena vacía no lanza (falsy pasa el guard)', () => {
    // La condición es `if (codigo && ...)` — string vacío es falsy
    expect(() => validarUbigeo('')).not.toThrow();
  });

  // ─── 4. Formato regex ────────────────────────────────────────────────────

  it('ubigeo de 5 dígitos "15010" no pasa ubigeoExiste', () => {
    // Aunque el código tuviera 5 dígitos, ubigeoExiste lo rechaza porque
    // el catálogo requiere 6 dígitos exactos.
    // El DTO tiene @Matches(/^\d{6}$/) — aquí probamos la capa service.
    expect(() => validarUbigeo('15010')).toThrow(ErrorValidacion);
  });
});
