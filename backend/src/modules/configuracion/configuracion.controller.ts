import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { AzureBlobService } from '../../core/storage/azure-blob.service';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { ErrorValidacion } from '../../core/errors/errores';

@Controller('configuracion')
@UseGuards(AuthGuard)
export class ConfiguracionController {
  constructor(private readonly blob: AzureBlobService) {}

  /**
   * Sube el logo SVG de la tienda al blob storage del tenant.
   * Path final: <tenant>/branding/logo.svg
   *
   * Sin límite de tamaño — Azure Blob soporta hasta 5 TiB por blob.
   * Multer está configurado sin maxFileSize (FileInterceptor default).
   */
  @Post('logo')
  @RequierePermiso('configuracion:editar')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: Infinity } }))
  async subirLogo(
    @UploadedFile() archivo: Express.Multer.File,
    @Tenant() ctx: TenantContext,
  ) {
    if (!archivo) {
      throw new ErrorValidacion('No se recibió archivo');
    }
    const contenido = archivo.buffer.toString('utf-8');
    if (!contenido.includes('<svg')) {
      throw new ErrorValidacion('El archivo no parece ser un SVG válido');
    }
    const url = await this.blob.subir(
      ctx.codigo,
      'branding/logo.svg',
      archivo.buffer,
      'image/svg+xml',
    );
    return { exito: true, datos: { url, contenido }, mensaje: 'Logo actualizado' };
  }
}
