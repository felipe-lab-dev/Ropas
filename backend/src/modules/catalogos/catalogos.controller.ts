import { Controller, Get, Header, Query } from '@nestjs/common';
import {
  buscarUbigeos,
  listarUbigeos,
  type Ubigeo,
} from '../../core/sunat/ubigeos';
import {
  listarUnidadesMedida,
  type UnidadMedidaSunat,
} from '../../core/sunat/unidades-medida';
import {
  CODIGO_TIPO_AFECTACION_IGV,
  type TipoAfectacionIgv,
} from '../../core/sunat/codigos';

// Etiquetas human-readable para los 19 tipos de afectación IGV (Catálogo SUNAT 07).
const ETIQUETAS_AFECTACION: Record<TipoAfectacionIgv, string> = {
  gravado_onerosa:                   'Gravado - Operación onerosa',
  gravado_retiro_premio:             'Gravado - Retiro por premio',
  gravado_retiro_donacion:           'Gravado - Retiro por donación',
  gravado_retiro:                    'Gravado - Retiro',
  gravado_retiro_publicidad:         'Gravado - Retiro por publicidad',
  gravado_bonificaciones:            'Gravado - Bonificaciones',
  gravado_retiro_trabajadores:       'Gravado - Retiro para trabajadores',
  gravado_ivap:                      'Gravado - IVAP',
  exonerado_onerosa:                 'Exonerado - Operación onerosa',
  exonerado_transferencia_gratuita:  'Exonerado - Transferencia gratuita',
  inafecto_onerosa:                  'Inafecto - Operación onerosa',
  inafecto_retiro_bonificacion:      'Inafecto - Retiro por bonificación',
  inafecto_retiro:                   'Inafecto - Retiro',
  inafecto_retiro_muestras:          'Inafecto - Retiro por muestras',
  inafecto_retiro_convenio:          'Inafecto - Retiro por convenio colectivo',
  inafecto_retiro_premio:            'Inafecto - Retiro por premio',
  inafecto_retiro_publicidad:        'Inafecto - Retiro por publicidad',
  inafecto_transf_gratuita_no_grav:  'Inafecto - Transferencia gratuita no gravada',
  exportacion:                       'Exportación',
};

@Controller('catalogos')
export class CatalogosController {
  /**
   * Ubigeos SUNAT — data pública, sin auth.
   * Cache-Control largo: los ubigeos son estáticos y cambian cada 5+ años.
   */
  @Get('ubigeos')
  @Header('Cache-Control', 'public, max-age=86400')
  listarUbigeos(
    @Query('q') q?: string,
    @Query('limite') limite?: string,
  ): { datos: readonly Ubigeo[] } {
    const lim = Math.min(parseInt(limite ?? '20', 10) || 20, 100);
    const datos =
      q && q.trim()
        ? buscarUbigeos(q, lim)
        : listarUbigeos().slice(0, lim);
    return { datos };
  }

  /**
   * Unidades de medida SUNAT (Catálogo 03) — Retail/ropa (~8 unidades).
   * Estático, cache 24h.
   */
  @Get('unidades-medida')
  @Header('Cache-Control', 'public, max-age=86400')
  listarUnidadesMedida(): { datos: UnidadMedidaSunat[] } {
    return { datos: listarUnidadesMedida() as UnidadMedidaSunat[] };
  }

  /**
   * Tipos de afectación IGV SUNAT (Catálogo 07) — 19 entradas.
   * Estático, cache 24h.
   */
  @Get('tipos-afectacion-igv')
  @Header('Cache-Control', 'public, max-age=86400')
  listarTiposAfectacionIgv(): {
    datos: Array<{ codigo: string; sunatCodigo: string; nombre: string }>;
  } {
    const datos = (Object.keys(CODIGO_TIPO_AFECTACION_IGV) as TipoAfectacionIgv[]).map(
      (codigo) => ({
        codigo,
        sunatCodigo: CODIGO_TIPO_AFECTACION_IGV[codigo],
        nombre: ETIQUETAS_AFECTACION[codigo],
      }),
    );
    return { datos };
  }
}
