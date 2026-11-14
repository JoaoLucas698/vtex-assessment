import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { parseCorsOrigins } from '@shared/config/cors-origins';
import { AllExceptionsFilter } from '@shared/errors/all-exceptions.filter';

/** Configuração HTTP compartilhada entre `main.ts` e os testes e2e. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);
  if (corsOrigins.length > 0) app.enableCors({ origin: corsOrigins });

  const config = new DocumentBuilder()
    .setTitle('Catalog Consolidation API')
    .setDescription(
      'Consolidação de catálogo de marketplace: importação de produtos de sellers sem duplicar o catálogo.',
    )
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
  });
}
