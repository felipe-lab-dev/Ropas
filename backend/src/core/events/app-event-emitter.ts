/**
 * AppEventEmitter — wrapper singleton sobre Node EventEmitter.
 *
 * Registrado como provider global en AppModule (o en el módulo que lo necesite).
 * Sustituye @nestjs/event-emitter evitando una dependencia extra.
 *
 * Uso:
 *   Emitir:  this.eventEmitter.emit('venta.creada', { ventaId, tenantCode });
 *   Escuchar: this.eventEmitter.on('venta.creada', handler);
 */
import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

@Injectable()
export class AppEventEmitter extends EventEmitter {
  constructor() {
    super();
    // Aumentar el límite para evitar warnings si hay muchos listeners
    this.setMaxListeners(50);
  }
}
