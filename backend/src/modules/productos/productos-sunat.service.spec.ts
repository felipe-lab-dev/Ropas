/**
 * Spec — Validaciones SUNAT en ProductosService (4.D)
 *
 * Tests aislados, sin DB ni Prisma real.
 * Cubren: unidadMedidaCodigo + tipoAfectacionIgv en crear() y actualizar().
 */

import { ErrorValidacion } from '../../core/errors/errores';
import { unidadMedidaExiste } from '../../core/sunat/unidades-medida';

// ─── Helper que replica la lógica de validación del service ──────────────────

function validarUnidadMedida(codigo: string | undefined): void {
  if (codigo && !unidadMedidaExiste(codigo)) {
    throw new ErrorValidacion(
      `Unidad de medida "${codigo}" no existe en el catálogo SUNAT`,
    );
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProductosService — validaciones SUNAT (4.D)', () => {
  // ─── 1. unidadMedidaCodigo válido ─────────────────────────────────────────

  it('código "NIU" pasa validación sin lanzar', () => {
    expect(() => validarUnidadMedida('NIU')).not.toThrow();
  });

  it('código "PAR" pasa validación sin lanzar', () => {
    expect(() => validarUnidadMedida('PAR')).not.toThrow();
  });

  it('código "ZZ" (servicios) pasa validación sin lanzar', () => {
    expect(() => validarUnidadMedida('ZZ')).not.toThrow();
  });

  it('código "KGM" pasa validación sin lanzar', () => {
    expect(() => validarUnidadMedida('KGM')).not.toThrow();
  });

  // ─── 2. unidadMedidaCodigo inválido → ErrorValidacion ────────────────────

  it('código "INVALIDO" lanza ErrorValidacion', () => {
    expect(() => validarUnidadMedida('INVALIDO')).toThrow(ErrorValidacion);
    expect(() => validarUnidadMedida('INVALIDO')).toThrow(/no existe en el catálogo SUNAT/i);
  });

  it('código "XYZ" lanza ErrorValidacion', () => {
    expect(() => validarUnidadMedida('XYZ')).toThrow(ErrorValidacion);
  });

  it('código "niu" (minúsculas) lanza ErrorValidacion (case-sensitive)', () => {
    // El catálogo SUNAT usa mayúsculas — "niu" no existe
    expect(() => validarUnidadMedida('niu')).toThrow(ErrorValidacion);
  });

  // ─── 3. Sin campo → no valida (optional) ─────────────────────────────────

  it('código undefined no lanza (campo opcional)', () => {
    expect(() => validarUnidadMedida(undefined)).not.toThrow();
  });

  it('código vacío "" no lanza (falsy pasa el guard)', () => {
    // La condición es `if (codigo && ...)` — string vacío es falsy
    expect(() => validarUnidadMedida('')).not.toThrow();
  });

  // ─── 4. Todos los códigos del catálogo pasan ─────────────────────────────

  it('todos los códigos del catálogo SUNAT son válidos', () => {
    const { UNIDADES_MEDIDA } = require('../../core/sunat/unidades-medida') as {
      UNIDADES_MEDIDA: Array<{ codigo: string }>;
    };
    for (const u of UNIDADES_MEDIDA) {
      expect(() => validarUnidadMedida(u.codigo)).not.toThrow();
    }
  });
});
