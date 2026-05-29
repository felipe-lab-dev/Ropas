import { Controller, Get } from '@nestjs/common';
import { Publico } from '../../modules/auth/auth.guard';

// Endpoint usado por el smoke test del workflow `.github/workflows/deploy.yml`
// y por el HEALTHCHECK del Dockerfile para detectar revisiones rotas.
// Sin auth — pero NO toca la DB ni datos de negocio.
@Controller('health')
export class HealthController {
  @Get()
  @Publico()
  ping() {
    return { ok: true, ts: new Date().toISOString() };
  }
}
