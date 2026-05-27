import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Solo se permite modificar `activa`.
 * `serie`, `tipoCpe`, `correlativoActual` y `sucursalId` son inmutables post-creación:
 *   - serie/tipoCpe: cambiarlos rompe la continuidad fiscal.
 *   - correlativoActual: solo se modifica mediante asignarProximoCorrelativo durante emisión.
 */
export class ActualizarSerieCpeDto {
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
