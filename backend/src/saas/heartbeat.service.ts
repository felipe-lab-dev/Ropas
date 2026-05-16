import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EnkiClient } from './enki.client';

@Injectable()
export class HeartbeatService {
  private readonly logger = new Logger(HeartbeatService.name);

  constructor(
    private readonly enki: EnkiClient,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async enviarHeartbeat(): Promise<void> {
    if (this.config.get<string>('ENKI_OFFLINE') === 'true') return;

    try {
      await this.enki.heartbeat({
        uptimeSegundos: process.uptime(),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        nodeVersion: process.version,
      });
      this.logger.debug('Heartbeat enviado a ENKI');
    } catch (err) {
      this.logger.warn({ err }, 'Heartbeat ENKI falló');
    }
  }
}
