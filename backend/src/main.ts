import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppExceptionFilter } from './core/errors/app-exception.filter';
import { RespuestaInterceptor } from './core/responses/respuesta.interceptor';

async function bootstrap() {
  const esProduccion = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: esProduccion ? ['error', 'warn', 'log'] : ['error', 'warn'],
  });

  // En prod redirigimos los logs internos de Nest a Pino para tener todo estructurado.
  // En dev los dejamos en el ConsoleLogger filtrado por `logger` arriba — así no aparece
  // el listado de ~300 "Mapped {...}" rutas al arrancar y la terminal queda legible.
  if (esProduccion) {
    app.useLogger(app.get(Logger));
  }
  const config = app.get(ConfigService);

  app.use(helmet());
  // CORS: orígenes explícitos via env + wildcard implícito para subdominios *.tienda.enkihubs.com
  // (cada tenant SaaS estrena su propio subdominio sin que tengamos que rebootear el backend).
  const origenesExplicitos = config
    .get<string>('CORS_ORIGIN', 'http://localhost:3000')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return cb(null, true);
      if (origenesExplicitos.includes(origin)) return cb(null, true);
      if (/^https:\/\/[a-z0-9-]+\.tienda\.enkihubs\.com$/.test(origin)) return cb(null, true);
      return cb(new Error(`Origen CORS no permitido: ${origin}`), false);
    },
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AppExceptionFilter());
  app.useGlobalInterceptors(new RespuestaInterceptor());

  const port = config.get<number>('PORT', 3001);
  await app.listen(port);
  app.get(Logger).log(`Ropas API escuchando en :${port}`);
}

bootstrap();
