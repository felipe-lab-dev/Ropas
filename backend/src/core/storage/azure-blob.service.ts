import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';
import { ErrorAplicacion } from '../errors/errores';

/**
 * Servicio de Azure Blob Storage para activos del SaaS multi-tenant.
 *
 * Estructura de carpetas en el container `tenants-assets`:
 *   <tenant_code>/branding/logo.svg
 *   <tenant_code>/branding/favicon.png
 *   <tenant_code>/productos/<id>/principal.jpg
 *   <tenant_code>/comprobantes/<año>/<mes>/<id>.pdf
 *
 * Cada tenant solo puede leer/escribir bajo su propio prefijo.
 */
@Injectable()
export class AzureBlobService {
  private readonly logger = new Logger(AzureBlobService.name);
  private readonly client?: BlobServiceClient;
  private readonly containerName: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    const conn = this.config.get<string>('AZURE_STORAGE_CONNECTION');
    this.containerName = this.config.get<string>('AZURE_STORAGE_CONTAINER') ?? 'tenants-assets';
    const account = this.config.get<string>('AZURE_STORAGE_ACCOUNT') ?? '';
    this.publicBaseUrl = `https://${account}.blob.core.windows.net/${this.containerName}`;

    if (!conn) {
      this.logger.warn('AZURE_STORAGE_CONNECTION no configurado — upload deshabilitado.');
      return;
    }
    this.client = BlobServiceClient.fromConnectionString(conn);
  }

  private containerLista = false;

  /** Sube un buffer al blob `<tenant>/<ruta>` y devuelve la URL pública. */
  async subir(
    tenantCodigo: string,
    rutaRelativa: string,
    contenido: Buffer,
    contentType: string,
  ): Promise<string> {
    if (!this.client) {
      throw new ErrorAplicacion(500, 'Azure Storage no está configurado en el servidor');
    }
    const blobName = this.normalizarRuta(tenantCodigo, rutaRelativa);
    const container = this.client.getContainerClient(this.containerName);

    if (!this.containerLista) {
      await container.createIfNotExists({ access: 'blob' });
      this.containerLista = true;
    }

    const blob: BlockBlobClient = container.getBlockBlobClient(blobName);
    await blob.uploadData(contenido, {
      blobHTTPHeaders: { blobContentType: contentType, blobCacheControl: 'public, max-age=86400' },
    });

    return `${this.publicBaseUrl}/${blobName}`;
  }

  async eliminar(tenantCodigo: string, rutaRelativa: string): Promise<void> {
    if (!this.client) return;
    const blobName = this.normalizarRuta(tenantCodigo, rutaRelativa);
    const container = this.client.getContainerClient(this.containerName);
    await container.deleteBlob(blobName).catch(() => undefined);
  }

  /**
   * Sanitiza la ruta y la prefija con el código del tenant. Evita
   * traversal con ".." y caracteres peligrosos.
   */
  private normalizarRuta(tenantCodigo: string, ruta: string): string {
    const limpio = ruta
      .replace(/\.\./g, '')
      .replace(/[^a-zA-Z0-9._\-/]/g, '_')
      .replace(/^\/+/, '');
    const tenant = tenantCodigo.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!tenant) throw new ErrorAplicacion(400, 'Tenant inválido para subida de archivo');
    return `${tenant}/${limpio}`;
  }
}
