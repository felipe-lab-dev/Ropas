import { Test, TestingModule } from '@nestjs/testing';
import { CatalogosController } from './catalogos.controller';
import { listarUbigeos } from '../../core/sunat/ubigeos';
import { UNIDADES_MEDIDA } from '../../core/sunat/unidades-medida';
import { CODIGO_TIPO_AFECTACION_IGV } from '../../core/sunat/codigos';

describe('CatalogosController', () => {
  let controller: CatalogosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogosController],
    }).compile();

    controller = module.get<CatalogosController>(CatalogosController);
  });

  // ─── 1. Sin query → primeros 20 ubigeos ──────────────────────────────────

  it('sin query retorna los primeros 20 ubigeos', () => {
    const result = controller.listarUbigeos(undefined, undefined);
    expect(result.datos).toHaveLength(20);
    // Verifica que son los primeros de la lista completa
    const todos = listarUbigeos();
    expect(result.datos[0]).toEqual(todos[0]);
    expect(result.datos[19]).toEqual(todos[19]);
  });

  // ─── 2. Con query "mira" → solo distritos que contienen "mira" ───────────

  it('con query "mira" retorna solo ubigeos que contienen "mira" (case-insensitive)', () => {
    const result = controller.listarUbigeos('mira', undefined);
    expect(result.datos.length).toBeGreaterThan(0);
    for (const u of result.datos) {
      const haystack = `${u.distrito} ${u.provincia} ${u.departamento}`.toLowerCase();
      expect(haystack).toContain('mira');
    }
  });

  // ─── 3. limite=5 → retorna máximo 5 ──────────────────────────────────────

  it('con limite=5 retorna 5 registros', () => {
    const result = controller.listarUbigeos(undefined, '5');
    expect(result.datos).toHaveLength(5);
  });

  // ─── 4. limite=200 → clamped a 100 ───────────────────────────────────────

  it('con limite=200 retorna máximo 100 (clamped)', () => {
    const result = controller.listarUbigeos(undefined, '200');
    expect(result.datos.length).toBeLessThanOrEqual(100);
    expect(result.datos).toHaveLength(100);
  });

  // ─── 5. Unidades de medida — 8 items ─────────────────────────────────────

  it('listarUnidadesMedida retorna 8 items con shape { codigo, nombre, simbolo }', () => {
    const result = controller.listarUnidadesMedida();
    expect(result.datos).toHaveLength(UNIDADES_MEDIDA.length);
    // shape check
    for (const u of result.datos) {
      expect(u).toHaveProperty('codigo');
      expect(u).toHaveProperty('nombre');
      expect(u).toHaveProperty('simbolo');
      expect(typeof u.codigo).toBe('string');
      expect(typeof u.nombre).toBe('string');
      expect(typeof u.simbolo).toBe('string');
    }
    // NIU es la primera
    expect(result.datos[0]?.codigo).toBe('NIU');
  });

  // ─── 6. Tipos afectación IGV — 19 items ──────────────────────────────────

  it('listarTiposAfectacionIgv retorna 19 items con shape { codigo, sunatCodigo, nombre }', () => {
    const result = controller.listarTiposAfectacionIgv();
    const totalEsperado = Object.keys(CODIGO_TIPO_AFECTACION_IGV).length;
    expect(result.datos).toHaveLength(totalEsperado);
    expect(result.datos).toHaveLength(19);
    for (const t of result.datos) {
      expect(t).toHaveProperty('codigo');
      expect(t).toHaveProperty('sunatCodigo');
      expect(t).toHaveProperty('nombre');
      expect(typeof t.codigo).toBe('string');
      expect(typeof t.sunatCodigo).toBe('string');
      expect(typeof t.nombre).toBe('string');
    }
    // gravado_onerosa es el primero, código SUNAT '10'
    const primero = result.datos[0];
    expect(primero?.codigo).toBe('gravado_onerosa');
    expect(primero?.sunatCodigo).toBe('10');
    expect(primero?.nombre).toMatch(/onerosa/i);
  });

  // ─── 7. Tipos afectación IGV — sunatCodigos únicos ───────────────────────

  it('todos los sunatCodigos son únicos y no vacíos', () => {
    const result = controller.listarTiposAfectacionIgv();
    const codigos = result.datos.map(t => t.sunatCodigo);
    const unicos = new Set(codigos);
    expect(unicos.size).toBe(codigos.length);
    for (const c of codigos) {
      expect(c.length).toBeGreaterThan(0);
    }
  });
});
